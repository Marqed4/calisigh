import { open } from "@tauri-apps/plugin-dialog";
import { convertFileSrc } from "@tauri-apps/api/core";
import { Image } from "./Icons.jsx";

/* Attach or remove a picture; onChange gets the chosen file path, or "" when removed */
export default function PicturePicker({ path, onChange }) {
  async function pick() {
    const chosen = await open({
      multiple: false,
      filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "gif", "webp"] }],
    });
    if (chosen) onChange(chosen);
  }

  return (
    <div className="alarm-picture">
      {path ? (
        <>
          <img className="alarm-picture-preview" src={convertFileSrc(path)} alt="Attached" />
          <button type="button" className="btn" onClick={() => onChange("")}>Remove picture</button>
        </>
      ) : (
        <button type="button" className="btn" onClick={pick}>
          <Image size={14} />&nbsp;Add picture
        </button>
      )}
    </div>
  );
}
