import { moneyPattern } from "../lib/money.js";
import "./Money.css";

/* Text with currency amounts ("$50", "€1,200.50") picked out in the money colour */
export default function Money({ text }) {
  if (!text) return null;
  const parts = [];
  let last = 0;
  for (const m of text.matchAll(moneyPattern())) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    parts.push(
      <span key={m.index} className="money">
        <span className="money-symbol">{m[0][0]}</span>{m[0].slice(1)}
      </span>
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
}
