/**
 * Picks a CameraView picture size whose long edge is near 1024px.
 * The vision optimizer emits a 1024px JPEG, so a larger capture is decoded twice.
 * Sizes come from CameraView.getAvailablePictureSizesAsync and look like "1280x720".
 */
const TARGET_LONG_EDGE = 1024;
const MAX_LONG_EDGE = 1280;
const MIN_LONG_EDGE = 960;

/** Intermediate JPEG quality. optimizeImageForAiVision recompresses the file. */
export const CAPTURE_JPEG_QUALITY = 0.55;

interface ParsedPictureSize {
  raw: string;
  longEdge: number;
}

function parsePictureSize(raw: string): ParsedPictureSize | null {
  const match = raw.match(/(\d+)\s*[x×]\s*(\d+)/i);
  if (!match) return null;
  const width = Number(match[1]);
  const height = Number(match[2]);
  if (!width || !height) return null;
  return { raw, longEdge: Math.max(width, height) };
}

export function pickPictureSize(sizes: readonly string[]): string | undefined {
  const parsed = sizes
    .map((size) => parsePictureSize(size))
    .filter((size): size is ParsedPictureSize => size !== null);

  if (parsed.length === 0) return undefined;

  const inRange = parsed.filter(
    (size) => size.longEdge <= MAX_LONG_EDGE && size.longEdge >= MIN_LONG_EDGE
  );
  const pool = inRange.length > 0 ? inRange : parsed;
  pool.sort(
    (a, b) =>
      Math.abs(a.longEdge - TARGET_LONG_EDGE) - Math.abs(b.longEdge - TARGET_LONG_EDGE)
  );
  return pool[0].raw;
}

export async function selectPreferredPictureSize(
  camera: { getAvailablePictureSizesAsync: () => Promise<string[]> } | null
): Promise<string | undefined> {
  if (!camera) return undefined;
  try {
    const sizes = await camera.getAvailablePictureSizesAsync();
    return pickPictureSize(sizes);
  } catch {
    return undefined;
  }
}
