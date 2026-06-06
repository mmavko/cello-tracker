// ── theme.js ─────────────────────────────────────────────────────────────────
// The Collection treasure: a "world concert tour" (UX §4.2). Pure swappable data —
// emoji + name + a one-line fact, plus `costPoints`, a *cumulative* lifetime-points
// threshold at which the tile unlocks. Tiles are sorted ascending by costPoints
// (the first, "home", is free at 0).
//
// Phase 1 ships this ~9-tile testing subset (enough to exercise unlock thresholds).
// The full multi-year list (~76 tiles, banded cost curve — UX §4.2 "Sizing") is
// authored before the Phase 2 collection view; the engine is count-agnostic, so
// growing this list touches no code.

export const WORLD_TOUR = [
  { id: "home",    emoji: "🏠", name: "Your practice room", costPoints: 0,   fact: "Where every tour begins." },
  { id: "cremona", emoji: "🎻", name: "Cremona",            costPoints: 40,  fact: "Where Stradivari built his violins and cellos." },
  { id: "paris",   emoji: "🗼", name: "Paris",              costPoints: 90,  fact: "Home of the Conservatoire de Paris." },
  { id: "vienna",  emoji: "🏛️", name: "Vienna",             costPoints: 160, fact: 'The Musikverein\'s "Golden Hall."' },
  { id: "milan",   emoji: "🎭", name: "Milan",              costPoints: 250, fact: "La Scala, the world's most famous opera house." },
  { id: "prague",  emoji: "🏰", name: "Prague",             costPoints: 360, fact: "Where Mozart premiered Don Giovanni." },
  { id: "newyork", emoji: "🗽", name: "New York",           costPoints: 500, fact: "Carnegie Hall — how do you get there? practice." },
  { id: "sydney",  emoji: "🌉", name: "Sydney",             costPoints: 680, fact: "The Opera House on the harbour." },
  { id: "tokyo",   emoji: "🏯", name: "Tokyo",              costPoints: 900, fact: "Suntory Hall, a jewel box of sound." },
];
