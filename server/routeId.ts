/**
 * Conversation ids from `:id`. One parser for the chat and audio routers.
 * Returns null for anything that is not a positive integer so callers can
 * respond 400 instead of querying with NaN.
 */
export function parseRouteId(
  value: string | string[] | undefined,
): number | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw !== "string" || !/^[1-9]\d*$/.test(raw)) return null;
  const id = Number(raw);
  if (!Number.isSafeInteger(id)) return null;
  return id;
}
