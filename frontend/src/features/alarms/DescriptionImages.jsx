import { convertFileSrc } from "@tauri-apps/api/core";
import { Close } from "../../shared/components/Icons.jsx";
import "./DescriptionImages.css";

/* The pictures pasted into a description. The first one is the event's cell picture unless one was picked with the Picture button. */
export default function DescriptionImages({ paths, onRemove }) {
  if (paths.length === 0) return null;

  return (
    <div className="desc-images">
      <p className="desc-images-hint">Pictures in the description. The first one is the cell picture, unless you pick one below.</p>
      <div className="desc-images-row">
        {paths.map((path, i) => (
          <div key={path} className={`desc-image${i === 0 ? " desc-image-first" : ""}`}>
            <img src={convertFileSrc(path)} alt={`Description picture ${i + 1}`} />
            <button
              type="button"
              className="desc-image-remove"
              aria-label={`Remove picture ${i + 1}`}
              title="Remove"
              onClick={() => onRemove(path)}
            >
              <Close size={12} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}