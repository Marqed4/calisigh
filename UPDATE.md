# Text highlighting update

The highlighting feature now treats signed currency amounts consistently:

- `-$50` is highlighted as a negative amount and subtracts from totals.
- `+$5` is highlighted as a positive amount.
- Negative amounts use the danger color; positive amounts keep the existing money color.
- Amount-like text inside a URL remains excluded from totals.

Changed `frontend/src/shared/text/money.js`, `Money.jsx`, `Money.css`, `HighlightInput.jsx` and `HighlightInput.css`. Added `frontend/src/shared/text/money.test.js`. Updated `frontend/CONTEXT.md`.

Validation completed:

- `node --test frontend\src\shared\text\money.test.js`: 2 tests passed.
- `npm run build` from `frontend/`: passed. Vite reported a non-blocking chunking warning for a Tauri window module imported both dynamically and statically.

Not yet checked in the running Tauri app. This report is disposable and can be removed when no longer needed.
