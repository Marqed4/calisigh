import { forwardRef, useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { amountMatches } from "./money.js";
import { splitUrls } from "./urls.js";
import "./HighlightInput.css";

/* Whatever shapes the text must match the field exactly, or the colours drift off the letters */
const MIRRORED = [
  "fontFamily", "fontSize", "fontWeight", "fontStyle", "letterSpacing", "wordSpacing", "textTransform",
  "textIndent", "tabSize", "lineHeight", "paddingTop", "paddingRight", "paddingBottom", "paddingLeft",
  "borderTopWidth", "borderRightWidth", "borderBottomWidth", "borderLeftWidth",
];

/* Web addresses and currency amounts, coloured only (no bold, no size change) so the letters stay aligned */
function highlight(text) {
  const out = [];
  for (const piece of splitUrls(text)) {
    if (piece.kind === "url") {
      out.push(<span key={`u${piece.index}`} className="hl-url">{piece.text}</span>);
      continue;
    }
    let last = 0;
    for (const m of amountMatches(piece.text)) {
      if (m.index > last) out.push(piece.text.slice(last, m.index));
      const className = m.text.startsWith("-") ? "hl-money hl-money-negative" : "hl-money";
      out.push(<span key={`m${piece.index + m.index}`} className={className}>{m.text}</span>);
      last = m.index + m.text.length;
    }
    if (last < piece.text.length) out.push(piece.text.slice(last));
  }
  return out;
}

/*
A text field that colours amounts and links while you type. The real field keeps its own
look, caret and selection, with its text made invisible; a copy of the text, coloured, is
laid exactly over it. multiline gives a textarea, otherwise a one line input.
value is required: the field's own letters are invisible, so without it nothing would show.
*/
const HighlightInput = forwardRef(function HighlightInput(
  { multiline = false, value, className = "", wrapClassName = "", ...rest }, ref
) {
  const field = useRef(null);
  const back = useRef(null);

  /* Stable between renders, so a caller's own ref is not cleared and set again on every keystroke */
  const setRefs = useCallback((node) => {
    field.current = node;
    if (typeof ref === "function") ref(node);
    else if (ref) ref.current = node;
  }, [ref]);

  function sync() {
    const f = field.current;
    const b = back.current;
    if (!f || !b) return;
    const cs = getComputedStyle(f);
    for (const prop of MIRRORED) b.style[prop] = cs[prop];
    const bars = f.offsetWidth - f.clientWidth - parseFloat(cs.borderLeftWidth) - parseFloat(cs.borderRightWidth);
    if (bars > 0) b.style.paddingRight = `${parseFloat(cs.paddingRight) + bars}px`;
    if (!multiline) {
      b.style.lineHeight = `${f.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom)}px`;
    }
    b.scrollTop = f.scrollTop;
    b.scrollLeft = f.scrollLeft;
  }

  useLayoutEffect(sync, [value]);

  useEffect(() => {
    if (!field.current || typeof ResizeObserver === "undefined") return undefined;
    const watcher = new ResizeObserver(sync);
    watcher.observe(field.current);
    return () => watcher.disconnect();
  }, []);

  /* Keep the caller's own handlers, and re-align after anything that can scroll the field */
  const chain = (name) => (e) => { rest[name]?.(e); sync(); };
  const props = {
    ...rest,
    ref: setRefs,
    value,
    className: `${className} hl-field`,
    onScroll: chain("onScroll"),
    onSelect: chain("onSelect"),
    onKeyUp: chain("onKeyUp"),
    onClick: chain("onClick"),
  };

  return (
    <div className={`hl-wrap ${wrapClassName}`}>
      {multiline ? <textarea {...props} /> : <input type="text" {...props} />}
      <div ref={back} className={`hl-back ${multiline ? "hl-back-multi" : "hl-back-single"}`} aria-hidden="true">
        {highlight(value ?? "")}
        {multiline ? "\n" : null}
      </div>
    </div>
  );
});

export default HighlightInput;
