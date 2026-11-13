import assert from "node:assert/strict";
import test from "node:test";
import { amountMatches, formatMoney, formatTotals, sumAmounts } from "./money.js";

test("signed currency amounts retain their sign and source positions", () => {
  const text = "Refund -$50 and +€1,250.25";
  assert.deepEqual(
    amountMatches(text).map(({ index, text: amount, symbol, cents }) => ({ index, text: amount, symbol, cents })),
    [
      { index: 7, text: "-$50", symbol: "$", cents: -5000 },
      { index: 16, text: "+€1,250.25", symbol: "€", cents: 125025 },
    ],
  );
});

test("negative totals subtract and format the sign before the currency symbol", () => {
  assert.equal(formatMoney("$", -5050), "-$50.50");
  assert.equal(
    formatTotals(sumAmounts([{ title: "Refund -$50", desc: "Fee +$5 and https://example.test/-$99" }])),
    "-$45",
  );
});
