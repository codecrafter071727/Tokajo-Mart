/** Must match POD_MAX_BYTES on the server */
export const PHOTO_MAX_BYTES = 1_500_000;

/** Bytes a base64 string decodes to, without decoding it. */
export function base64Bytes(base64: string): number {
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return Math.floor((base64.length * 3) / 4) - padding;
}

/** A JPEG starts with FF D8 FF, which is "/9j/" in base64. */
export const isJpegBase64 = (base64: string) => base64.startsWith("/9j/");

/** Strips a data: URL prefix if the camera or file picker added one. */
export function stripDataUrl(value: string): string {
  const comma = value.indexOf(",");
  return value.startsWith("data:") && comma > 0 ? value.slice(comma + 1) : value;
}

/** Checks a photo before upload and says what is wrong in words a rider understands. */
export function checkPhoto(base64: string): string | null {
  if (!isJpegBase64(base64)) return "Use a photo from the camera (JPEG).";
  if (base64Bytes(base64) > PHOTO_MAX_BYTES) return "That photo is too large. Take it again.";
  return null;
}
