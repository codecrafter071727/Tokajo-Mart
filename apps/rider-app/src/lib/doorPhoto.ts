import { ApiError, authedUpload, REAL_BACKEND } from "./api";
import { checkPhoto } from "./photoChecks";

export {
  base64Bytes,
  checkPhoto,
  isJpegBase64,
  PHOTO_MAX_BYTES,
  stripDataUrl,
} from "./photoChecks";

export async function uploadDoorPhoto(
  deliveryId: string,
  base64: string,
  onProgress: (fraction: number) => void,
): Promise<void> {
  const problem = checkPhoto(base64);
  if (problem) throw new ApiError(problem, 400);
  // Demo mode has no server: pretend it went through so the flow can be tried
  if (!REAL_BACKEND) {
    onProgress(1);
    return;
  }
  await authedUpload(
    `/v1/delivery/${deliveryId}/pod`,
    { contentType: "image/jpeg", imageBase64: base64 },
    onProgress,
  );
}
