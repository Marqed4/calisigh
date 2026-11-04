import { pastedImages } from "../../shared/lib/api.js";

const MAX_PICTURES = 20;

function readBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/*
The pictures on the clipboard, or [] when the paste is text so a normal paste still works.
Call it inside the paste event itself: the clipboard is gone once the handler returns.
*/
export function pastedPictureFiles(event) {
  const data = event.clipboardData;
  if (!data || data.getData("text/plain")) return [];
  return Array.from(data.items ?? [])
    .filter(item => item.kind === "file" && item.type.startsWith("image/"))
    .map(item => item.getAsFile())
    .filter(Boolean);
}

/* Saves each picture in the Calisigh folder and gives back the new paths. Throws with a readable message. */
export async function savePastedFiles(files, alreadyHave) {
  if (alreadyHave + files.length > MAX_PICTURES) throw new Error(`Up to ${MAX_PICTURES} pictures per description.`);
  const paths = [];
  for (const file of files) paths.push(await pastedImages.upload(await readBase64(file), file.type));
  return paths;
}