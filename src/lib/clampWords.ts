/** First `limit` words of a prompt, plus whether anything was trimmed. */
export function clampWords(text: string, limit = 25): { text: string; truncated: boolean } {
  const source = (text || "").trim();
  const words = source.split(/\s+/).filter((w) => w.length > 0);
  if (words.length <= limit) return { text: source, truncated: false };
  return { text: words.slice(0, limit).join(" ") + "…", truncated: true };
}
