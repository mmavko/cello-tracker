# Polish backlog

Non-blocking UI/UX polish noticed during reviews — none affect correctness, so they
don't gate a phase. Knock these out in a batch when convenient (a good "Phase 5/6
also-touches-this-view" companion). This is a living checklist, not a spec; delete
items as they're done. History/rationale for *why* something shipped a certain way
lives in `.chronicles/`, not here.

## Parent area (Phase 4 — `app/parent.js` / `app/parent.html`)

- [ ] **Sub-4-digit PIN submit is a silent no-op.** Entering <4 digits then
  Unlock/Enter does nothing with no feedback (`parent.js` `submit()` returns early on
  `val.length !== 4`). Add a hint or disable the button until 4 digits.
- [ ] **Confirm-mismatch shows no message.** A mismatched "Confirm PIN" just shakes
  and resets to "Create a PIN" — no "PINs didn't match, try again" text. Add a line.
- [ ] **Live readout "Day" omits the test-offset indicator.** The test panel shows
  `(+N)` when the clock is advanced; the parent readout shows only the bare date.
  Mirror the `(+N)` so a tainted/offset state is obvious here too (cosmetic).

## Home (Phase 5 — `app/views/home.js`)

- [ ] **"best N" + "🌟 your best ever" persist through a growing streak.** While a
  streak grows, `current === longest` every day, so the flourish is a constant label
  (and "best 5" is redundant next to "5 days in a row"). Make it a *moment*: gate the
  🌟 to the day a record is actually set, and/or only show "best N" when
  `longest > current` (a past record worth chasing).
