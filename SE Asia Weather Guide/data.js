/**
 * Southeast Asia — Monthly Climate Data
 * Representative capital-city weather for 11 countries.
 * Temperatures in °C, rainfall in mm.
 * Month indices are 0-based (0 = January … 11 = December).
 */

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const MONTH_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

const COUNTRIES = {

  /* ── Thailand (Bangkok) ─────────────────────────────────── */
  thailand: {
    name: 'Thailand',
    emoji: '🇹🇭',
    capital: 'Bangkok',
    months: [
      { temp_high: 32, temp_low: 21, rainfall_mm: 9 },
      { temp_high: 33, temp_low: 23, rainfall_mm: 30 },
      { temp_high: 34, temp_low: 25, rainfall_mm: 29 },
      { temp_high: 35, temp_low: 26, rainfall_mm: 65 },
      { temp_high: 34, temp_low: 26, rainfall_mm: 220 },
      { temp_high: 33, temp_low: 25, rainfall_mm: 149 },
      { temp_high: 33, temp_low: 25, rainfall_mm: 155 },
      { temp_high: 32, temp_low: 25, rainfall_mm: 197 },
      { temp_high: 32, temp_low: 24, rainfall_mm: 344 },
      { temp_high: 32, temp_low: 24, rainfall_mm: 242 },
      { temp_high: 32, temp_low: 23, rainfall_mm: 48 },
      { temp_high: 31, temp_low: 21, rainfall_mm: 10 },
    ],
    bestMonths: [10, 11, 0, 1, 2],
    notes: 'Nov–Feb offers cool, dry weather. The south coast has a different monsoon schedule.',
  },

  /* ── Vietnam (Hanoi) ────────────────────────────────────── */
  vietnam: {
    name: 'Vietnam',
    emoji: '🇻🇳',
    capital: 'Hanoi',
    months: [
      { temp_high: 20, temp_low: 14, rainfall_mm: 18 },
      { temp_high: 21, temp_low: 15, rainfall_mm: 26 },
      { temp_high: 23, temp_low: 18, rainfall_mm: 44 },
      { temp_high: 27, temp_low: 21, rainfall_mm: 90 },
      { temp_high: 32, temp_low: 25, rainfall_mm: 189 },
      { temp_high: 33, temp_low: 26, rainfall_mm: 240 },
      { temp_high: 33, temp_low: 26, rainfall_mm: 288 },
      { temp_high: 32, temp_low: 26, rainfall_mm: 318 },
      { temp_high: 31, temp_low: 25, rainfall_mm: 265 },
      { temp_high: 29, temp_low: 22, rainfall_mm: 131 },
      { temp_high: 25, temp_low: 18, rainfall_mm: 43 },
      { temp_high: 22, temp_low: 15, rainfall_mm: 23 },
    ],
    bestMonths: [9, 10, 11, 1, 2, 3],
    notes: 'Vietnam spans many climate zones. The north is cool in winter; the south stays warm year-round.',
  },

  /* ── Cambodia (Phnom Penh) ──────────────────────────────── */
  cambodia: {
    name: 'Cambodia',
    emoji: '🇰🇭',
    capital: 'Phnom Penh',
    months: [
      { temp_high: 32, temp_low: 22, rainfall_mm: 7 },
      { temp_high: 33, temp_low: 23, rainfall_mm: 10 },
      { temp_high: 35, temp_low: 24, rainfall_mm: 40 },
      { temp_high: 35, temp_low: 25, rainfall_mm: 77 },
      { temp_high: 34, temp_low: 25, rainfall_mm: 124 },
      { temp_high: 33, temp_low: 25, rainfall_mm: 155 },
      { temp_high: 33, temp_low: 25, rainfall_mm: 171 },
      { temp_high: 32, temp_low: 25, rainfall_mm: 160 },
      { temp_high: 32, temp_low: 24, rainfall_mm: 224 },
      { temp_high: 31, temp_low: 24, rainfall_mm: 257 },
      { temp_high: 31, temp_low: 23, rainfall_mm: 127 },
      { temp_high: 31, temp_low: 22, rainfall_mm: 45 },
    ],
    bestMonths: [10, 11, 0, 1, 2],
    notes: 'Nov–Feb is dry with comfortable temperatures. Angkor Wat is best visited early morning.',
  },

  /* ── Laos (Vientiane) ───────────────────────────────────── */
  laos: {
    name: 'Laos',
    emoji: '🇱🇦',
    capital: 'Vientiane',
    months: [
      { temp_high: 28, temp_low: 15, rainfall_mm: 8 },
      { temp_high: 31, temp_low: 17, rainfall_mm: 15 },
      { temp_high: 34, temp_low: 20, rainfall_mm: 34 },
      { temp_high: 35, temp_low: 23, rainfall_mm: 82 },
      { temp_high: 33, temp_low: 24, rainfall_mm: 246 },
      { temp_high: 32, temp_low: 25, rainfall_mm: 280 },
      { temp_high: 31, temp_low: 25, rainfall_mm: 272 },
      { temp_high: 31, temp_low: 24, rainfall_mm: 334 },
      { temp_high: 31, temp_low: 24, rainfall_mm: 297 },
      { temp_high: 31, temp_low: 22, rainfall_mm: 78 },
      { temp_high: 29, temp_low: 19, rainfall_mm: 11 },
      { temp_high: 28, temp_low: 16, rainfall_mm: 3 },
    ],
    bestMonths: [10, 11, 0, 1],
    notes: 'The cool dry season (Nov–Feb) is ideal. Northern mountains are cooler year-round.',
  },

  /* ── Myanmar (Yangon) ───────────────────────────────────── */
  myanmar: {
    name: 'Myanmar',
    emoji: '🇲🇲',
    capital: 'Yangon',
    months: [
      { temp_high: 32, temp_low: 18, rainfall_mm: 5 },
      { temp_high: 35, temp_low: 19, rainfall_mm: 3 },
      { temp_high: 36, temp_low: 22, rainfall_mm: 7 },
      { temp_high: 37, temp_low: 24, rainfall_mm: 15 },
      { temp_high: 33, temp_low: 25, rainfall_mm: 303 },
      { temp_high: 30, temp_low: 25, rainfall_mm: 547 },
      { temp_high: 30, temp_low: 24, rainfall_mm: 559 },
      { temp_high: 30, temp_low: 24, rainfall_mm: 602 },
      { temp_high: 30, temp_low: 25, rainfall_mm: 368 },
      { temp_high: 32, temp_low: 24, rainfall_mm: 206 },
      { temp_high: 32, temp_low: 22, rainfall_mm: 60 },
      { temp_high: 32, temp_low: 19, rainfall_mm: 7 },
    ],
    bestMonths: [10, 11, 0, 1],
    notes: 'Nov–Feb is dry and cooler. The monsoon (Jun–Sep) brings very heavy rain to Yangon.',
  },

  /* ── Malaysia (Kuala Lumpur) ─────────────────────────────── */
  malaysia: {
    name: 'Malaysia',
    emoji: '🇲🇾',
    capital: 'Kuala Lumpur',
    months: [
      { temp_high: 32, temp_low: 23, rainfall_mm: 170 },
      { temp_high: 33, temp_low: 23, rainfall_mm: 165 },
      { temp_high: 33, temp_low: 23, rainfall_mm: 240 },
      { temp_high: 33, temp_low: 24, rainfall_mm: 260 },
      { temp_high: 33, temp_low: 24, rainfall_mm: 204 },
      { temp_high: 33, temp_low: 24, rainfall_mm: 130 },
      { temp_high: 32, temp_low: 23, rainfall_mm: 127 },
      { temp_high: 32, temp_low: 23, rainfall_mm: 155 },
      { temp_high: 32, temp_low: 23, rainfall_mm: 188 },
      { temp_high: 32, temp_low: 23, rainfall_mm: 253 },
      { temp_high: 32, temp_low: 23, rainfall_mm: 288 },
      { temp_high: 32, temp_low: 23, rainfall_mm: 234 },
    ],
    bestMonths: [5, 6, 7, 0, 1],
    notes: 'The east and west coasts have opposite monsoon seasons. KL is year-round warm.',
  },

  /* ── Singapore ──────────────────────────────────────────── */
  singapore: {
    name: 'Singapore',
    emoji: '🇸🇬',
    capital: 'Singapore',
    months: [
      { temp_high: 30, temp_low: 24, rainfall_mm: 234 },
      { temp_high: 31, temp_low: 24, rainfall_mm: 164 },
      { temp_high: 32, temp_low: 24, rainfall_mm: 185 },
      { temp_high: 32, temp_low: 24, rainfall_mm: 179 },
      { temp_high: 32, temp_low: 25, rainfall_mm: 172 },
      { temp_high: 31, temp_low: 25, rainfall_mm: 162 },
      { temp_high: 31, temp_low: 24, rainfall_mm: 155 },
      { temp_high: 31, temp_low: 24, rainfall_mm: 176 },
      { temp_high: 31, temp_low: 24, rainfall_mm: 170 },
      { temp_high: 32, temp_low: 24, rainfall_mm: 197 },
      { temp_high: 31, temp_low: 24, rainfall_mm: 254 },
      { temp_high: 31, temp_low: 24, rainfall_mm: 269 },
    ],
    bestMonths: [1, 2, 5, 6, 7],
    notes: 'Warm and humid year-round. Feb–Mar is the driest period.',
  },

  /* ── Indonesia (Jakarta) ────────────────────────────────── */
  indonesia: {
    name: 'Indonesia',
    emoji: '🇮🇩',
    capital: 'Jakarta',
    months: [
      { temp_high: 30, temp_low: 24, rainfall_mm: 350 },
      { temp_high: 30, temp_low: 24, rainfall_mm: 300 },
      { temp_high: 31, temp_low: 24, rainfall_mm: 211 },
      { temp_high: 32, temp_low: 24, rainfall_mm: 147 },
      { temp_high: 32, temp_low: 24, rainfall_mm: 106 },
      { temp_high: 32, temp_low: 24, rainfall_mm: 58 },
      { temp_high: 32, temp_low: 23, rainfall_mm: 44 },
      { temp_high: 32, temp_low: 23, rainfall_mm: 43 },
      { temp_high: 33, temp_low: 24, rainfall_mm: 25 },
      { temp_high: 33, temp_low: 24, rainfall_mm: 56 },
      { temp_high: 32, temp_low: 24, rainfall_mm: 110 },
      { temp_high: 31, temp_low: 24, rainfall_mm: 217 },
    ],
    bestMonths: [4, 5, 6, 7, 8],
    notes: 'Dry season (May–Sep) is best. Bali has a slightly different pattern from Java.',
  },

  /* ── Philippines (Manila) ───────────────────────────────── */
  philippines: {
    name: 'Philippines',
    emoji: '🇵🇭',
    capital: 'Manila',
    months: [
      { temp_high: 30, temp_low: 21, rainfall_mm: 23 },
      { temp_high: 31, temp_low: 21, rainfall_mm: 13 },
      { temp_high: 33, temp_low: 22, rainfall_mm: 16 },
      { temp_high: 34, temp_low: 24, rainfall_mm: 33 },
      { temp_high: 34, temp_low: 25, rainfall_mm: 130 },
      { temp_high: 33, temp_low: 25, rainfall_mm: 254 },
      { temp_high: 31, temp_low: 25, rainfall_mm: 432 },
      { temp_high: 31, temp_low: 25, rainfall_mm: 475 },
      { temp_high: 31, temp_low: 24, rainfall_mm: 356 },
      { temp_high: 31, temp_low: 24, rainfall_mm: 234 },
      { temp_high: 31, temp_low: 23, rainfall_mm: 145 },
      { temp_high: 30, temp_low: 22, rainfall_mm: 66 },
    ],
    bestMonths: [11, 0, 1, 2, 3, 4],
    notes: 'Dec–Feb is the cool dry season. Typhoon season runs Jun–Nov.',
  },

  /* ── Brunei (Bandar Seri Begawan) ───────────────────────── */
  brunei: {
    name: 'Brunei',
    emoji: '🇧🇳',
    capital: 'Bandar Seri Begawan',
    months: [
      { temp_high: 30, temp_low: 23, rainfall_mm: 292 },
      { temp_high: 31, temp_low: 23, rainfall_mm: 159 },
      { temp_high: 32, temp_low: 23, rainfall_mm: 122 },
      { temp_high: 33, temp_low: 23, rainfall_mm: 193 },
      { temp_high: 33, temp_low: 24, rainfall_mm: 234 },
      { temp_high: 33, temp_low: 24, rainfall_mm: 211 },
      { temp_high: 33, temp_low: 24, rainfall_mm: 178 },
      { temp_high: 33, temp_low: 23, rainfall_mm: 228 },
      { temp_high: 32, temp_low: 23, rainfall_mm: 255 },
      { temp_high: 32, temp_low: 23, rainfall_mm: 313 },
      { temp_high: 31, temp_low: 23, rainfall_mm: 340 },
      { temp_high: 31, temp_low: 23, rainfall_mm: 348 },
    ],
    bestMonths: [1, 2, 3],
    notes: 'Feb–Apr sees the least rainfall. Hot and humid year-round.',
  },

  /* ── Timor-Leste (Dili) ─────────────────────────────────── */
  timorleste: {
    name: 'Timor-Leste',
    emoji: '🇹🇱',
    capital: 'Dili',
    months: [
      { temp_high: 31, temp_low: 24, rainfall_mm: 150 },
      { temp_high: 31, temp_low: 24, rainfall_mm: 145 },
      { temp_high: 31, temp_low: 24, rainfall_mm: 130 },
      { temp_high: 31, temp_low: 24, rainfall_mm: 75 },
      { temp_high: 31, temp_low: 23, rainfall_mm: 25 },
      { temp_high: 30, temp_low: 22, rainfall_mm: 10 },
      { temp_high: 29, temp_low: 21, rainfall_mm: 8 },
      { temp_high: 29, temp_low: 20, rainfall_mm: 5 },
      { temp_high: 31, temp_low: 21, rainfall_mm: 7 },
      { temp_high: 32, temp_low: 22, rainfall_mm: 20 },
      { temp_high: 33, temp_low: 24, rainfall_mm: 70 },
      { temp_high: 32, temp_low: 24, rainfall_mm: 130 },
    ],
    bestMonths: [4, 5, 6, 7, 8, 9, 10],
    notes: 'The dry season (May–Nov) offers the best weather. Remote and less touristy.',
  },
};

export { COUNTRIES };
export { MONTH_NAMES };
export { MONTH_SHORT };
