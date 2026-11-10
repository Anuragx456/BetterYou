const IMAGE_ROOT_DIR = 'betteryou_images/';

// In-memory virtual filesystem for web and unit test environments
const virtualFileStore = new Map<string, string>();
let fsModule: typeof import('expo-file-system/legacy') | null = null;
let hasCheckedFs = false;

export function resetVirtualImageStore(): void {
  virtualFileStore.clear();
}

async function getFileSystem() {
  if (hasCheckedFs) return fsModule;
  hasCheckedFs = true;

  if (typeof window === 'undefined' && !(globalThis as Record<string, unknown>).nativeCallSyncHook) {
    return null;
  }

  try {
    fsModule = await import('expo-file-system/legacy');
  } catch {
    fsModule = null;
  }
  return fsModule;
}

function getDocumentDirectory(): string {
  // If native expo-file-system is loaded:
  if (fsModule?.documentDirectory) {
    return fsModule.documentDirectory;
  }
  return 'file:///app_documents/';
}

/**
 * Initializes the image storage directories inside documentDirectory.
 */
export async function ensureImageDirectories(): Promise<void> {
  const fs = await getFileSystem();
  if (!fs || !fs.documentDirectory) return;

  const root = fs.documentDirectory + IMAGE_ROOT_DIR;
  const mealsDir = root + 'meals/';
  const productsDir = root + 'products/';

  try {
    const rootInfo = await fs.getInfoAsync(root);
    if (!rootInfo.exists) {
      await fs.makeDirectoryAsync(root, { intermediates: true });
    }
    const mealsInfo = await fs.getInfoAsync(mealsDir);
    if (!mealsInfo.exists) {
      await fs.makeDirectoryAsync(mealsDir, { intermediates: true });
    }
    const productsInfo = await fs.getInfoAsync(productsDir);
    if (!productsInfo.exists) {
      await fs.makeDirectoryAsync(productsDir, { intermediates: true });
    }
  } catch {
    // Ignore if directory already exists
  }
}

/**
 * Moves or copies a captured/temporary image to persistent documentDirectory.
 * Returns the relative path (e.g. "betteryou_images/meals/meal_12345.jpg").
 */
export async function saveImageToDocuments(
  tempUri: string,
  folder: 'meals' | 'products' = 'meals'
): Promise<string> {
  if (!tempUri) {
    throw new Error('No image URI provided to saveImageToDocuments.');
  }

  const filename = `${folder}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.jpg`;
  const relativePath = `${IMAGE_ROOT_DIR}${folder}/${filename}`;

  const fs = await getFileSystem();
  if (!fs || !fs.documentDirectory) {
    // Virtual storage fallback
    virtualFileStore.set(relativePath, tempUri);
    return relativePath;
  }

  await ensureImageDirectories();
  const destinationUri = fs.documentDirectory + relativePath;

  try {
    await fs.copyAsync({
      from: tempUri,
      to: destinationUri,
    });
    // Clean up temporary capture/manipulated file from cache immediately
    if (tempUri.includes('cache') || tempUri.includes('ImageManipulator')) {
      fs.deleteAsync(tempUri, { idempotent: true }).catch(() => {});
    }
    return relativePath;
  } catch (err: unknown) {
    console.warn(`[imageManager] Failed to copy image to documentDirectory: ${err}`);
    return tempUri;
  }
}

/**
 * Resolves a relative path to a full file URI, verifying file existence.
 * Returns null if missing so UI components handle missing files gracefully.
 */
export async function resolveImageUri(relativePath?: string | null): Promise<string | null> {
  if (!relativePath || relativePath.trim() === '') {
    return null;
  }

  const clean = relativePath.trim();

  // Already a full remote or local URI (legacy fallback)
  if (clean.startsWith('http://') || clean.startsWith('https://')) {
    return clean;
  }

  const fs = await getFileSystem();
  if (!fs || !fs.documentDirectory) {
    if (virtualFileStore.has(clean)) {
      return virtualFileStore.get(clean) ?? null;
    }
    if (clean.startsWith('file://')) {
      return clean;
    }
    return null;
  }

  const fullUri = clean.startsWith('file://') ? clean : fs.documentDirectory + clean;

  try {
    const info = await fs.getInfoAsync(fullUri);
    if (info.exists) {
      return fullUri;
    }
    return null; // Missing file handled gracefully
  } catch {
    return null;
  }
}

/**
 * Synchronous resolver that prepends documentDirectory without file-existence check
 * for immediate image rendering in FlatLists/components.
 */
export function getFullImageUri(relativePath?: string | null): string | null {
  if (!relativePath || relativePath.trim() === '') return null;
  const clean = relativePath.trim();
  if (clean.startsWith('file://') || clean.startsWith('http://') || clean.startsWith('https://')) {
    return clean;
  }
  return getDocumentDirectory() + clean;
}

/**
 * Deletes a persisted image by its relative path.
 */
export async function deletePersistedImage(relativePath?: string | null): Promise<void> {
  if (!relativePath) return;

  virtualFileStore.delete(relativePath);

  const fs = await getFileSystem();
  if (!fs || !fs.documentDirectory) return;

  const fullUri = relativePath.startsWith('file://')
    ? relativePath
    : fs.documentDirectory + relativePath;

  try {
    const info = await fs.getInfoAsync(fullUri);
    if (info.exists) {
      await fs.deleteAsync(fullUri, { idempotent: true });
    }
  } catch {
    // Ignore deletion errors
  }
}

/**
 * Cleanup job for orphan images:
 * Scans documentDirectory/betteryou_images/ and deletes any file not present in validRelativePaths.
 */
export async function cleanupOrphanImages(
  validRelativePaths: string[]
): Promise<{ scanned: number; deleted: number }> {
  const validSet = new Set(validRelativePaths.map((p) => p.trim()));

  const fs = await getFileSystem();
  if (!fs || !fs.documentDirectory) {
    let deletedCount = 0;
    for (const key of Array.from(virtualFileStore.keys())) {
      if (!validSet.has(key)) {
        virtualFileStore.delete(key);
        deletedCount++;
      }
    }
    return { scanned: validSet.size, deleted: deletedCount };
  }

  let scanned = 0;
  let deleted = 0;

  const folders: ('meals' | 'products')[] = ['meals', 'products'];
  for (const folder of folders) {
    const dir = `${fs.documentDirectory}${IMAGE_ROOT_DIR}${folder}/`;
    try {
      const info = await fs.getInfoAsync(dir);
      if (!info.exists || !info.isDirectory) continue;

      const fileList = await fs.readDirectoryAsync(dir);
      for (const filename of fileList) {
        scanned++;
        const rel = `${IMAGE_ROOT_DIR}${folder}/${filename}`;
        if (!validSet.has(rel)) {
          try {
            await fs.deleteAsync(dir + filename, { idempotent: true });
            deleted++;
          } catch {
            // Ignore individual delete error
          }
        }
      }
    } catch {
      // Ignore directory scan error
    }
  }

  return { scanned, deleted };
}
