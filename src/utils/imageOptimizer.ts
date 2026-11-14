/**
 * Downscales and compresses camera captures and gallery selections before
 * sending to Gemini Vision API.
 *
 * Uses the SDK 58 ImageManipulator API. maxWidth downsamples while decoding
 * so the full sensor bitmap is not held, then the image is saved at 1024px
 * JPEG 0.72 plus a 256px thumbnail for list rows.
 * Throws on failure so callers can prompt the user to retry,
 * preventing silent fallback to fake demo data.
 */

export interface OptimizedVisionImage {
  uri: string;
  base64: string;
  thumbnailUri?: string;
}

interface Releasable {
  release?: () => void;
}

function releaseNative(resource: Releasable | null | undefined): void {
  try {
    resource?.release?.();
  } catch {
    // The native image was already released.
  }
}

export async function optimizeImageForAiVision(
  uri: string,
  maxWidth: number = 1024
): Promise<OptimizedVisionImage> {
  if (!uri) {
    throw new Error('No image URI provided to image optimizer.');
  }

  const { ImageManipulator, SaveFormat } = await import('expo-image-manipulator');
  const context = ImageManipulator.manipulate(uri, { maxWidth });
  let imageRef: Releasable | null = null;

  try {
    context.resize({ width: maxWidth });
    const rendered = await context.renderAsync();
    imageRef = rendered;
    const result = await rendered.saveAsync({
      compress: 0.72,
      format: SaveFormat.JPEG,
      base64: true,
    });

    if (!result.base64) {
      throw new Error('Image optimizer failed to generate base64 payload.');
    }

    let thumbnailUri: string | undefined;
    let thumbRef: Releasable | null = null;
    try {
      context.reset().resize({ width: 256 });
      const thumbRendered = await context.renderAsync();
      thumbRef = thumbRendered;
      const thumb = await thumbRendered.saveAsync({
        compress: 0.7,
        format: SaveFormat.JPEG,
        base64: false,
      });
      thumbnailUri = thumb.uri;
    } catch {
      thumbnailUri = undefined;
    } finally {
      releaseNative(thumbRef);
    }

    return {
      uri: result.uri,
      base64: result.base64,
      thumbnailUri,
    };
  } finally {
    releaseNative(imageRef);
    releaseNative(context);
  }
}
