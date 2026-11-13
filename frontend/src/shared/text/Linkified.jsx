import { openUrl } from "@tauri-apps/plugin-opener";
import Money from "./Money.jsx";
import { splitUrls } from "./urls.js";

/* Text with its web addresses turned into links that open in the default browser, and its currency amounts highlighted. Only http and https are linked. */
export default function Linkified({ text }) {
  if (!text) return null;

  return splitUrls(text).map((piece) => {
    if (piece.kind === "text") return <Money key={piece.index} text={piece.text} />;
    const url = piece.text;
    const stop = (e) => {
      e.preventDefault();
      e.stopPropagation();
    };
    return (
      <a
        key={piece.index}
        href={url}
        className="link"
        title={url}
        onClick={(e) => {
          stop(e);
          openUrl(url).catch((err) => console.warn("Could not open link", url, err));
        }}
        onAuxClick={stop}
      >
        {url}
      </a>
    );
  });
}
