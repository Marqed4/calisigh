import { amountMatches } from "./money.js";
import "./Money.css";

/* Text with currency amounts ("$50", "€1,200.50") picked out in the money colour */
export default function Money({ text }) {
  if (!text) return null;
  const parts = [];
  let last = 0;
  for (const m of amountMatches(text)) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const symbolIndex = m.text.indexOf(m.symbol);
    parts.push(
      <span key={m.index} className={`money${m.text.startsWith("-") ? " money-negative" : ""}`}>
        {m.text.slice(0, symbolIndex)}
        <span className="money-symbol">{m.symbol}</span>{m.text.slice(symbolIndex + m.symbol.length)}
      </span>
    );
    last = m.index + m.text.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
}
