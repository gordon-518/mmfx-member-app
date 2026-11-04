// The written Know Your Style report's six headings and its compliance footer,
// in the language the report is written in. The model is told to use these
// exact strings and the report is validated against them
// (src/lib/kys/prompt.ts, src/lib/kys/validation.ts). The English footer is
// the reviewed wording: a report in another language carries it as well.
export const kysReport = {
  read: "The read",
  wellDone: "What you do well",
  leak: "The leak costing you money",
  onGold: "How it shows up on XAU/USD",
  fix: "Your fix this week",
  finalNote: "Final note",
  footer: "Forex and CFD trading involves substantial risk of loss and is not suitable for all investors. This assessment is for educational purposes and is not financial advice.",
} as const;
