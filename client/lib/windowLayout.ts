/**
 * Live window layout for iPhone Duo (P6).
 *
 * Outer and inner displays resize the same window mid-session. Read size with
 * `useWindowDimensions()` (or these pure helpers at event time). Do not cache
 * `Dimensions.get` at module load.
 */

export const READABLE_MAX_WIDTH = 560;

/**
 * Shorter side at or above this length is treated as a regular size class.
 * Duo inner is regular/regular (~626pt on the short side). Outer phones stay
 * under it.
 */
export const REGULAR_SIZE_CLASS_MIN = 600;

export type DisplayClass = "compact" | "regular";
export type WindowWidthBucket = "<500" | "500-800" | ">800";

export const readableColumn = {
  width: "100%" as const,
  maxWidth: READABLE_MAX_WIDTH,
  alignSelf: "center" as const,
};

export function displayClassForWindow(
  width: number,
  height: number,
): DisplayClass {
  return Math.min(width, height) >= REGULAR_SIZE_CLASS_MIN
    ? "regular"
    : "compact";
}

export function windowWidthBucket(width: number): WindowWidthBucket {
  if (width < 500) return "<500";
  if (width <= 800) return "500-800";
  return ">800";
}

/** Near-square and landscape windows crop full-bleed `cover` heroes. */
export function heroResizeMode(
  width: number,
  height: number,
): "cover" | "contain" {
  if (height <= 0) return "cover";
  return width / height >= 0.85 ? "contain" : "cover";
}

/**
 * Model identifier for analytics. Prefer expo-device `modelId` (iOS
 * `iPhone15,2`). Android leaves `modelId` null, so fall back to `modelName`
 * (`Pixel 8`), never the user-assigned device name.
 */
export function formatDeviceModel(
  modelId: string | null | undefined,
  modelName: string | null | undefined,
): string {
  const id = typeof modelId === "string" ? modelId.trim() : "";
  const name = typeof modelName === "string" ? modelName.trim() : "";
  const value = id || name;
  if (!value || value.length > 64) return "unknown";
  return value;
}

export function contentInsets(
  insets: { top: number; bottom: number; left: number; right: number },
  base: { top: number; bottom: number; horizontal: number },
) {
  return {
    paddingTop: insets.top + base.top,
    paddingBottom: insets.bottom + base.bottom,
    paddingLeft: insets.left + base.horizontal,
    paddingRight: insets.right + base.horizontal,
  };
}
