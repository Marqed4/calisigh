/*
Web addresses written in event text. One place knows the pattern, so the links, the typing
highlight and the money total all agree on where an address starts and ends.
Only http and https count. Anything after the address that is just punctuation stays plain text.
*/
const URL_PATTERN = /https?:\/\/[^\s<>"]+/gi;
const SCHEME = /^https?:\/\//i;
const ALWAYS_TRAILING = new Set([".", ",", ";", ":", "!", "?", "'", '"']);
const CLOSERS = { ")": "(", "]": "[" };

const countOf = (text, ch) => text.split(ch).length - 1;

/* Drops sentence punctuation from the end, and a closing bracket only when nothing opened it,
   so "(see https://a.com)." loses ")." but "https://en.wikipedia.org/wiki/Cat_(disambiguation)" keeps its ")". */
export function trimUrl(raw) {
  let end = raw.length;
  while (end > 0) {
    const ch = raw[end - 1];
    if (ALWAYS_TRAILING.has(ch)) {
      end -= 1;
      continue;
    }
    const opener = CLOSERS[ch];
    if (opener) {
      const body = raw.slice(0, end);
      if (countOf(body, ch) > countOf(body, opener)) {
        end -= 1;
        continue;
      }
    }
    break;
  }
  return raw.slice(0, end);
}

/*
Splits text into pieces, in order: { kind: "text", text, index } or { kind: "url", text, index }.
index is where the piece starts in the original text, so it is a stable React key.
A url piece is exactly the clickable part.
*/
export function splitUrls(text) {
  const out = [];
  if (!text) return out;
  let last = 0;
  for (const m of text.matchAll(URL_PATTERN)) {
    const url = trimUrl(m[0]);
    if (url.length <= SCHEME.exec(m[0])[0].length) continue; /* just "https://" and nothing after it */
    if (m.index > last) out.push({ kind: "text", text: text.slice(last, m.index), index: last });
    out.push({ kind: "url", text: url, index: m.index });
    last = m.index + url.length;
  }
  if (last < text.length) out.push({ kind: "text", text: text.slice(last), index: last });
  return out;
}
