import { openUrl } from "@tauri-apps/plugin-opener";
import Money from "./Money.jsx";

const URL_PATTERN = /(https?:\/\/[^\s<>"]+)/g;
const TRAILING_PUNCTUATION = /[.,;:!?)\]'"]+$/;

/* Text with its web addresses turned into links that open in the default browser, and its currency amounts highlighted. Only http and https are linked. */
export default function Linkified({ text }) {
  if (!text) return null;

  return text.split(URL_PATTERN).map((part, i) => {
    if (i % 2 === 0) return <Money key={i} text={part} />;
    const url = part.replace(TRAILING_PUNCTUATION, "");
    const rest = part.slice(url.length);
    return (
      <span key={i}>
        <a
          href={url}
          className="link"
          title={url}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            openUrl(url).catch(() => {});
          }}
        >
          {url}
        </a>
        {rest}
      </span>
    );
  });
}
