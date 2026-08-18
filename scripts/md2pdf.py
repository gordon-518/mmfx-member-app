#!/usr/bin/env python3
"""Markdown -> branded HTML -> PDF (via headless Chrome).

Purpose-built for the MMFX agency pack: supports the exact Markdown subset used
there (headings, tables, lists, blockquotes, fenced code, inline code/bold/
italic/links, hr, emoji). No third-party deps.
"""
import html as _html
import re
import subprocess
import sys
from pathlib import Path

CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

CSS = """
@page { size: A4; margin: 16mm 14mm 18mm; }
*{box-sizing:border-box}
body{
  font-family:'Hanken Grotesk',-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;
  color:#1a1714; line-height:1.62; font-size:10.6pt; margin:0;
  -webkit-print-color-adjust:exact; print-color-adjust:exact;
}
h1,h2,h3,h4{font-family:'Bricolage Grotesque',Georgia,serif;line-height:1.18;letter-spacing:-.01em;margin:0 0 .4em}
h1{font-size:25pt;font-weight:800;margin-top:0;padding-bottom:.35em;border-bottom:3px solid #ff5a1f}
h2{font-size:15.5pt;font-weight:800;margin-top:1.5em;color:#1a1714;
   padding-left:.5em;border-left:4px solid #ff5a1f}
h3{font-size:12.4pt;font-weight:700;margin-top:1.25em;color:#c2410c}
h4{font-size:11pt;font-weight:700;margin-top:1em}
p{margin:.55em 0}
a{color:#c2410c;text-decoration:none;border-bottom:1px solid #ffd9c7}
strong{font-weight:700;color:#1a1714}
em{font-style:italic}
code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.87em;
     background:#f6f1ea;border:1px solid #ece7e0;border-radius:4px;padding:.08em .34em;color:#8a3a10}
pre{background:#1a1714;color:#f7f3ee;border-radius:9px;padding:12px 14px;overflow:hidden;
    font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:8.9pt;line-height:1.5;
    white-space:pre-wrap;word-break:break-word;margin:.8em 0}
pre code{background:none;border:none;color:inherit;padding:0;font-size:inherit}
table{width:100%;border-collapse:collapse;margin:.85em 0;font-size:9.5pt;page-break-inside:avoid}
th{background:#1a1714;color:#fff;text-align:left;padding:7px 9px;font-weight:700;font-size:9pt}
td{border-bottom:1px solid #ece7e0;padding:6px 9px;vertical-align:top}
tr:nth-child(even) td{background:#fbfaf8}
blockquote{margin:.9em 0;padding:10px 14px;background:#fff6f1;
           border-left:4px solid #ff5a1f;border-radius:0 8px 8px 0}
blockquote p{margin:.25em 0}
ul,ol{margin:.5em 0 .7em;padding-left:1.35em}
li{margin:.28em 0}
hr{border:none;border-top:1px solid #ece7e0;margin:1.5em 0}
.brandbar{display:flex;align-items:center;gap:9px;margin-bottom:1.6em;
          padding-bottom:.8em;border-bottom:1px solid #ece7e0}
.brandbar .mark{width:22px;height:22px;border-radius:6px;background:#ff5a1f;display:inline-block}
.brandbar .name{font-family:'Bricolage Grotesque',Georgia,serif;font-weight:800;font-size:11.5pt}
.brandbar .name span{color:#ff5a1f}
.brandbar .doc{margin-left:auto;font-size:8.6pt;color:#79716a;text-transform:uppercase;letter-spacing:.09em}
h2,h3{page-break-after:avoid}
"""

FONTS = ("https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,700;12..96,800"
         "&family=Hanken+Grotesk:wght@400;500;700&display=swap")


def inline(t: str) -> str:
    t = _html.escape(t)
    t = re.sub(r'`([^`]+)`', lambda m: f"<code>{m.group(1)}</code>", t)
    t = re.sub(r'\[([^\]]+)\]\(([^)]+)\)', r'<a href="\2">\1</a>', t)
    t = re.sub(r'\*\*([^*]+)\*\*', r'<strong>\1</strong>', t)
    t = re.sub(r'(?<!\*)\*([^*\n]+)\*(?!\*)', r'<em>\1</em>', t)
    return t


def convert(md: str) -> str:
    lines = md.split("\n")
    out, i = [], 0
    list_stack = []  # 'ul' | 'ol'

    def close_lists():
        while list_stack:
            out.append(f"</{list_stack.pop()}>")

    while i < len(lines):
        ln = lines[i]

        # fenced code
        if ln.startswith("```"):
            close_lists()
            i += 1
            buf = []
            while i < len(lines) and not lines[i].startswith("```"):
                buf.append(_html.escape(lines[i])); i += 1
            i += 1
            out.append("<pre><code>" + "\n".join(buf) + "</code></pre>")
            continue

        # table
        if ln.strip().startswith("|") and i + 1 < len(lines) and re.match(r'^\s*\|[\s:|-]+\|\s*$', lines[i + 1]):
            close_lists()
            cells = lambda r: [c.strip() for c in r.strip().strip("|").split("|")]
            head = cells(ln); i += 2
            rows = []
            while i < len(lines) and lines[i].strip().startswith("|"):
                rows.append(cells(lines[i])); i += 1
            out.append("<table><thead><tr>" + "".join(f"<th>{inline(c)}</th>" for c in head) + "</tr></thead><tbody>")
            for r in rows:
                out.append("<tr>" + "".join(f"<td>{inline(c)}</td>" for c in r) + "</tr>")
            out.append("</tbody></table>")
            continue

        # heading
        m = re.match(r'^(#{1,6})\s+(.*)$', ln)
        if m:
            close_lists()
            lvl = len(m.group(1))
            out.append(f"<h{lvl}>{inline(m.group(2))}</h{lvl}>")
            i += 1; continue

        # hr
        if re.match(r'^\s*---+\s*$', ln):
            close_lists(); out.append("<hr>"); i += 1; continue

        # blockquote (consecutive)
        if ln.lstrip().startswith(">"):
            close_lists()
            buf = []
            while i < len(lines) and lines[i].lstrip().startswith(">"):
                buf.append(lines[i].lstrip()[1:].strip()); i += 1
            out.append("<blockquote>" + "".join(f"<p>{inline(b)}</p>" for b in buf if b) + "</blockquote>")
            continue

        # list item
        m = re.match(r'^(\s*)([-*]|\d+\.)\s+(.*)$', ln)
        if m:
            kind = "ol" if m.group(2)[0].isdigit() else "ul"
            depth = len(m.group(1)) // 2
            while len(list_stack) > depth + 1:
                out.append(f"</{list_stack.pop()}>")
            if len(list_stack) == depth:
                out.append(f"<{kind}>"); list_stack.append(kind)
            elif list_stack and list_stack[-1] != kind:
                out.append(f"</{list_stack.pop()}>"); out.append(f"<{kind}>"); list_stack.append(kind)
            # absorb wrapped continuation lines so bold/links spanning a line
            # break still match, and the list isn't closed mid-way (which would
            # restart <ol> numbering at 1)
            item = [m.group(3)]
            i += 1
            while i < len(lines) and lines[i].strip() and not re.match(
                    r'^(#{1,6}\s|\s*[-*]\s|\s*\d+\.\s|>|```|\s*\|)', lines[i]) \
                    and not re.match(r'^\s*---+\s*$', lines[i]):
                item.append(lines[i].strip()); i += 1
            out.append(f"<li>{inline(' '.join(item))}</li>")
            continue

        # blank
        if not ln.strip():
            close_lists(); i += 1; continue

        # paragraph (join continuation lines)
        buf = [ln.strip()]; i += 1
        while i < len(lines) and lines[i].strip() and not re.match(
                r'^(#{1,6}\s|\s*[-*]\s|\s*\d+\.\s|>|```|\s*\|)', lines[i]) and not re.match(r'^\s*---+\s*$', lines[i]):
            buf.append(lines[i].strip()); i += 1
        close_lists()
        out.append(f"<p>{inline(' '.join(buf))}</p>")

    close_lists()
    return "\n".join(out)


def build(md_path: Path, out_pdf: Path, label: str):
    body = convert(md_path.read_text())
    bar = (f'<div class="brandbar"><span class="mark"></span>'
           f'<span class="name">Market Makers <span>FX</span></span>'
           f'<span class="doc">{_html.escape(label)}</span></div>')
    doc = (f'<!doctype html><meta charset="utf-8"><title>{_html.escape(md_path.stem)}</title>'
           f'<link rel="stylesheet" href="{FONTS}"><style>{CSS}</style>{bar}{body}')
    tmp = out_pdf.with_suffix(".html")
    tmp.write_text(doc)
    subprocess.run([CHROME, "--headless", "--disable-gpu", "--no-pdf-header-footer",
                    f"--print-to-pdf={out_pdf}", "--virtual-time-budget=6000", tmp.as_uri()],
                   check=True, capture_output=True)
    tmp.unlink()
    return out_pdf


if __name__ == "__main__":
    src, dst = Path(sys.argv[1]).resolve(), Path(sys.argv[2]).resolve()
    label = sys.argv[3] if len(sys.argv) > 3 else "Agency Pack"
    build(src, dst, label)
    print(f"✓ {dst.name}")
