"""
Quiet Instrumentation — plate I.
"AI Trading Assistant" announcement plate, 3:4 vertical.

The hero gesture is an equity curve; beneath it hangs its underwater (drawdown)
mirror, rendered as a dense field of hairline ticks. Rendered at 2x and
downsampled with Lanczos for plate-crisp edges.
"""
import math
from PIL import Image, ImageDraw, ImageFont

FONTS = ("/Users/gordon/Library/Application Support/Claude/local-agent-mode-sessions/"
         "skills-plugin/810b423d-eee3-4bcc-926d-505e4c292376/"
         "9bacb61e-7c1b-4581-9b0a-f46b69452dd2/skills/canvas-design/canvas-fonts")

SS = 2                      # supersample factor
W, H = 1500 * SS, 2000 * SS  # 3:4
M = 118 * SS                 # outer margin

INK      = (23, 20, 15)      # warm near-black ground
PAPER    = (251, 250, 248)
SIGNAL   = (255, 90, 31)     # Signal Orange
MUTED    = (128, 118, 105)   # annotation grey
FAINT    = (68, 61, 51)      # rules / major ticks
FAINTER  = (49, 44, 36)      # minor tick field

img = Image.new("RGB", (W, H), INK)
d = ImageDraw.Draw(img)

def f(name, size):
    return ImageFont.truetype(f"{FONTS}/{name}", int(size * SS))

BRIC_B = lambda s: f("BricolageGrotesque-Bold.ttf", s)
BRIC_R = lambda s: f("BricolageGrotesque-Regular.ttf", s)
MONO   = lambda s: f("GeistMono-Regular.ttf", s)
MONO_B = lambda s: f("GeistMono-Bold.ttf", s)

def tw(txt, font, tr=0.0):
    """width of txt with letterspacing tr (px, pre-SS)."""
    w = d.textlength(txt, font=font)
    return w + tr * SS * max(0, len(txt) - 1)

def track(xy, txt, font, fill, tr=0.0, anchor="la"):
    """Draw letterspaced text. anchor: la (left), ma (centre), ra (right)."""
    x, y = xy
    total = tw(txt, font, tr)
    if anchor[0] == "m":
        x -= total / 2
    elif anchor[0] == "r":
        x -= total
    for ch in txt:
        d.text((x, y), ch, font=font, fill=fill, anchor="l" + anchor[1])
        x += d.textlength(ch, font=font) + tr * SS

# ── the signal ───────────────────────────────────────────────────────────────
# A deterministic ascending equity curve with a real drawdown. Control points
# are hand-set; Catmull-Rom through them, then a whisper of jitter so the line
# reads as plotted data rather than a vector flourish.
CTRL = [(0.00, 0.06), (0.10, 0.15), (0.19, 0.12), (0.28, 0.30), (0.36, 0.41),
        (0.44, 0.33), (0.52, 0.24), (0.60, 0.45), (0.68, 0.58), (0.75, 0.54),
        (0.83, 0.72), (0.91, 0.86), (1.00, 1.00)]

def catmull(pts, n=1400):
    p = [pts[0]] + list(pts) + [pts[-1]]
    out = []
    for i in range(len(p) - 3):
        p0, p1, p2, p3 = p[i], p[i+1], p[i+2], p[i+3]
        for j in range(n // (len(p) - 3)):
            t = j / (n // (len(p) - 3))
            t2, t3 = t*t, t*t*t
            x = 0.5*((2*p1[0]) + (-p0[0]+p2[0])*t + (2*p0[0]-5*p1[0]+4*p2[0]-p3[0])*t2 + (-p0[0]+3*p1[0]-3*p2[0]+p3[0])*t3)
            y = 0.5*((2*p1[1]) + (-p0[1]+p2[1])*t + (2*p0[1]-5*p1[1]+4*p2[1]-p3[1])*t2 + (-p0[1]+3*p1[1]-3*p2[1]+p3[1])*t3)
            out.append((x, y))
    out.append(pts[-1])
    return out

curve = catmull(CTRL)
curve = [(x, y + 0.0065 * math.sin(x * 47.0) * math.cos(x * 13.0)) for x, y in curve]

# plot frame — the vertical rhythm is calibrated: title block, a measured rest,
# then the instrument occupying the optical centre, then the foot.
PL, PR = M, W - M
PT, PB = int(H * 0.395), int(H * 0.630)         # equity band
UT = PB + int(64 * SS)                          # rest for the axis indices
UB = UT + int(132 * SS)                         # underwater band

def px(t):  return PL + t * (PR - PL)
def py(v):  return PB - v * (PB - PT)

# baseline rule
d.line([(PL, PB), (PR, PB)], fill=FAINT, width=max(1, int(1.1 * SS)))

# ── tick field: the tape reading (dense accumulation of marks) ───────────────
N = 168
for i in range(N + 1):
    t = i / N
    x = px(t)
    v = curve[min(int(t * (len(curve) - 1)), len(curve) - 1)][1]
    y = py(v)
    major = (i % 12 == 0)
    d.line([(x, PB), (x, y)], fill=FAINTER if not major else FAINT,
           width=max(1, int((1.0 if not major else 1.4) * SS)))

# ── underwater (drawdown) mirror ─────────────────────────────────────────────
peak, dd = -9, []
for x, v in curve:
    peak = max(peak, v)
    dd.append((x, v - peak))          # ≤ 0
worst = min(v for _, v in dd) or -1e-6
d.line([(PL, UT), (PR, UT)], fill=FAINT, width=max(1, int(1.1 * SS)))
for i in range(N + 1):
    t = i / N
    x = px(t)
    v = dd[min(int(t * (len(dd) - 1)), len(dd) - 1)][1]
    h = (v / worst) * (UB - UT)
    if h > 0.4:
        d.line([(x, UT), (x, UT + h)], fill=(74, 40, 26) if h > (UB - UT) * 0.45 else FAINTER,
               width=max(1, int(1.0 * SS)))

# ── the hero line ────────────────────────────────────────────────────────────
pts = [(px(x), py(v)) for x, v in curve]
d.line(pts, fill=SIGNAL, width=max(2, int(3.4 * SS)), joint="curve")

# terminal node
ex, ey = pts[-1]
d.ellipse([ex - 9*SS, ey - 9*SS, ex + 9*SS, ey + 9*SS], fill=INK, outline=SIGNAL, width=int(2.6*SS))
d.ellipse([ex - 3.2*SS, ey - 3.2*SS, ex + 3.2*SS, ey + 3.2*SS], fill=SIGNAL)

# trough marker — the single whisper of signal elsewhere
ti = min(range(len(dd)), key=lambda i: dd[i][1])
tx = px(curve[ti][0])
d.line([(tx, UT), (tx, UB)], fill=SIGNAL, width=max(1, int(1.3 * SS)))

# ── registration marks ───────────────────────────────────────────────────────
def reg(x, y, r=13 * SS, col=FAINT):
    d.line([(x - r, y), (x + r, y)], fill=col, width=max(1, int(1.1 * SS)))
    d.line([(x, y - r), (x, y + r)], fill=col, width=max(1, int(1.1 * SS)))

for rx in (M, W - M):
    for ry in (M, H - M):
        reg(rx, ry)

# ── typography ───────────────────────────────────────────────────────────────
# eyebrow
track((M, int(H * 0.088)), "MARKET MAKERS FX", MONO(15), MUTED, tr=5.4)
track((W - M, int(H * 0.088)), "MEMBERS ONLY", MONO(15), SIGNAL, tr=5.4, anchor="ra")
d.line([(M, int(H * 0.112)), (W - M, int(H * 0.112))], fill=FAINTER, width=max(1, int(1.1 * SS)))

# hero
hero = BRIC_B(96)
y0 = int(H * 0.150)
d.text((M, y0), "AI TRADING", font=hero, fill=PAPER)
d.text((M, y0 + int(104 * SS)), "ASSISTANT", font=hero, fill=PAPER)

# subhead — one whisper line
track((M, y0 + int(232 * SS)), "YOUR EDGE, MEASURED.", MONO(17), SIGNAL, tr=4.2)

# plate annotations (technician's marginalia)
track((M, PT - int(46 * SS)), "FIG. I — EQUITY, CUMULATIVE", MONO(13), MUTED, tr=3.4)
track((W - M, PT - int(46 * SS)), "MT5 · AUTO-SYNCED", MONO(13), MUTED, tr=3.4, anchor="ra")
track((M, UB + int(26 * SS)), "FIG. II — DRAWDOWN, UNDERWATER", MONO(13), MUTED, tr=3.4)
track((W - M, UB + int(26 * SS)), "PEAK-TO-TROUGH", MONO(13), MUTED, tr=3.4, anchor="ra")

# axis indices — seated in the rest between the two plates, never crowding either
for i in range(0, N + 1, 24):
    t = i / N
    track((px(t), PB + int(21 * SS)), f"{i:03d}", MONO(11), FAINT, tr=1.6, anchor="ma")

# ── foot: the three movements, as instrument readings ────────────────────────
fy = int(H * 0.812)
d.line([(M, fy), (W - M, fy)], fill=FAINTER, width=max(1, int(1.1 * SS)))
cols = [("01", "CONNECT", "read-only"),
        ("02", "MEASURE", "every trade"),
        ("03", "COACH", "AI review")]
cw = (W - 2 * M) / 3
for i, (num, label, sub) in enumerate(cols):
    cx = M + cw * i + int(4 * SS)
    track((cx, fy + int(30 * SS)), num, MONO_B(14), SIGNAL, tr=2.6)
    d.text((cx, fy + int(60 * SS)), label, font=BRIC_B(27), fill=PAPER)
    track((cx, fy + int(104 * SS)), sub.upper(), MONO(12), MUTED, tr=2.6)

# ── colophon — seated INSIDE the margin, level with the lower registration ───
track((M, H - M - int(46 * SS)), "PLATE I / QUIET INSTRUMENTATION", MONO(12), FAINT, tr=3.0)
track((W - M, H - M - int(46 * SS)), "APP.MARKETMAKERSFX.NET", MONO(12), MUTED, tr=3.0, anchor="ra")

out = img.resize((W // SS, H // SS), Image.LANCZOS)
out.save("/Users/gordon/Documents/Claude/mmfx-member-app/docs/mockups/ata-announcement.png")
print("saved", out.size)
