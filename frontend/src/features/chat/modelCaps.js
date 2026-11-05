/*
What a chosen Ollama model can do. Only one thing matters to the chat today: can it see pictures.

The backend can say so for certain. If chat.models.list() returns `vision`, an array with the
names of the installed models that report the "vision" capability (Ollama's /api/show lists
`capabilities`), that array is the answer. Without it, a model whose name is a known vision
family counts as yes, and anything else is unknown. Unknown is not a no, so it is never blocked.
*/

const VISION_NAME = /vision|llava|bakllava|moondream|minicpm-v|gemma3|qwen[\d.]*-?vl|llama4/i;
/* Small gemma3 sizes are text only */
const TEXT_ONLY_NAME = /gemma3:(1b|270m)/i;

const bare = (name) => name.replace(/:latest$/, "");

/* true, false, or null when nobody knows */
export function canSeeImages(models, name) {
  if (!name) return null;
  const listed = models?.vision;
  if (Array.isArray(listed)) return listed.some((v) => bare(v) === bare(name));
  if (TEXT_ONLY_NAME.test(name)) return null;
  return VISION_NAME.test(name) ? true : null;
}

/* A download may be reported as a bare name or as {name, percent} */
export const pullName = (p) => (typeof p === "string" ? p : p.name);
export const pullPercent = (p) => (typeof p === "object" && Number.isFinite(p.percent) ? Math.round(p.percent) : null);