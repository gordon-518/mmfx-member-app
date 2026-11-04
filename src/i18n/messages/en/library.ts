// The library page. Book titles are the PDFs' own (English) titles and stay
// as they are; categories and blurbs are by key / slug.
export const library = {
  eyebrow: "Library · {n} eBooks",
  title: "The MM Library",
  subtitle: "The written system and reference set — read in your browser or download. Pairs with the course; keep the cheat sheets open while you trade.",
  contentNote: "The eBooks are written in English.",
  flagship: "Flagship · {category}",
  rest: "The rest of the shelf",
  read: "Read",
  download: "Download",
  readInBrowser: "Read in browser",
  downloadPdf: "Download PDF",
  categories: {
    complete: "Complete system",
    core: "Core",
    quickStart: "Quick-start",
  },
  books: {
    "mm-system-ebook": {
      blurb: "The full written system, start to finish — every stage of the workflow in one reference you can keep coming back to.",
      inside: {
        a: "Bias → zone → trigger → risk → manage",
        b: "Worked gold (XAU/USD) examples",
        c: "The full decision framework, end to end",
      },
    },
    "five-stage-workflow": {
      blurb: "The MM System end to end — bias, zone, trigger, risk, manage.",
    },
    "decision-trees-invalidation": {
      blurb: "When the thesis breaks — where the stop sits and why.",
    },
    "cheat-sheets-quick-reference": {
      blurb: "The desk reference for sessions, levels, and checklists.",
    },
  },
} as const;
