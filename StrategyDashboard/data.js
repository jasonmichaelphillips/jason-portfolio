/** Fallback analyst targets when live API is unavailable (update periodically). */
const TARGETS = [
  { firm: 'Benchmark', analyst: 'Mark Palmer', target: 570, date: '2026-05-06' },
  { firm: 'TD Cowen', analyst: 'Lance Vitanza', target: 395, date: '2026-05-07' },
  { firm: 'BTIG', analyst: 'Andrew Harte', target: 350, date: '2026-05-06' },
  { firm: 'Mizuho', analyst: 'Dan Dolev', target: 320, date: '2026-02-17' },
  { firm: 'Citigroup', analyst: 'Peter Christiansen', target: 260, date: '2026-03-18' },
  { firm: 'Canaccord Genuity', analyst: 'Joseph Vafi', target: 224, date: '2026-05-07' },
  { firm: 'Cantor Fitzgerald', analyst: 'Ramsey El-Assal', target: 212, date: '2026-04-21' },
  { firm: 'HC Wainwright', analyst: 'Mike Colonnese', target: 475, date: '2025-11-03' },
  { firm: 'Bernstein', analyst: 'Gautam Chhugani', target: 450, date: '2025-12-08' },
  { firm: 'Wells Fargo', analyst: 'Cerena Chen', target: 54, date: '2025-09-30' },
];

/** Quarterly diluted shares (M) — used when Strategy treasury history has &lt;2 points. */
const SHARES = [
  { q: "Q4'24", shares: 221.6 },
  { q: "Q1'25", shares: 252.0 },
  { q: "Q2'25", shares: 279.0 },
  { q: "Q3'25", shares: 297.0 },
  { q: "Q4'25", shares: 318.0 },
  { q: "Q1'26", shares: 333.9 },
];
