/** Parse the first JSON object out of a model reply, tolerating prose or code
 *  fences around it. Returns null when nothing parseable is found. */
export function parseJsonObject(raw: string): Record<string, unknown> | null {
  try {
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start === -1 || end === -1) return null;
    const parsed = JSON.parse(raw.slice(start, end + 1));
    return typeof parsed === 'object' && parsed !== null
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}
