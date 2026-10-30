import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

/**
 * Downscales and compresses camera captures and gallery selections before
 * sending to Gemini Vision API.
 *
 * Uses the modern SDK 58 ImageManipulator API.
 * Throws on failure so callers can prompt the user to retry,
 * preventing silent fallback to fake demo data.
 */
export async function optimizeImageForAiVision(
  uri: string,
  maxWidth: number = 1024
): Promise<{ uri: string; base64: string }> {
  if (!uri) {
    throw new Error('No image URI provided to image optimizer.');
  }

  const context = ImageManipulator.manipulate(uri);
  context.resize({ width: maxWidth });
  const imageRef = await context.renderAsync();
  const result = await imageRef.saveAsync({
    compress: 0.72,
    format: SaveFormat.JPEG,
    base64: true,
  });

  if (!result.base64) {
    throw new Error('Image optimizer failed to generate base64 payload.');
  }

  return {
    uri: result.uri,
    base64: result.base64,
  };
}
