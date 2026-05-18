/**
 * Client-side image compression before upload-to-s3.
 * Re-encodes to JPEG at ~0.6 quality (≈50% smaller in practice) and
 * caps the longest edge at 2000px so phone photos shrink dramatically.
 *
 * - Non-image files (PDF/Office) are returned unchanged.
 * - Very small images (<200KB) are returned unchanged.
 * - HEIC/unsupported decoding falls back to the original file.
 */
export async function compressImage(
  file: File,
  opts: { quality?: number; maxEdge?: number; minBytes?: number } = {}
): Promise<File> {
  const { quality = 0.6, maxEdge = 2000, minBytes = 200 * 1024 } = opts;

  if (!file || !file.type?.startsWith('image/')) return file;
  if (file.type === 'image/gif') return file; // preserve animations
  if (file.size <= minBytes) return file;

  try {
    const bitmap = await createImageBitmap(file).catch(() => null);
    let width: number, height: number;
    let drawSource: CanvasImageSource;

    if (bitmap) {
      width = bitmap.width;
      height = bitmap.height;
      drawSource = bitmap;
    } else {
      // Fallback via HTMLImageElement (e.g. Safari edge cases)
      const url = URL.createObjectURL(file);
      try {
        const img = await new Promise<HTMLImageElement>((resolve, reject) => {
          const i = new Image();
          i.onload = () => resolve(i);
          i.onerror = reject;
          i.src = url;
        });
        width = img.naturalWidth;
        height = img.naturalHeight;
        drawSource = img;
      } finally {
        URL.revokeObjectURL(url);
      }
    }

    if (!width || !height) return file;

    // Scale down if longest edge exceeds maxEdge
    const scale = Math.min(1, maxEdge / Math.max(width, height));
    const targetW = Math.round(width * scale);
    const targetH = Math.round(height * scale);

    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(drawSource, 0, 0, targetW, targetH);

    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', quality)
    );
    if (!blob) return file;

    // If compression didn't actually help, keep the original
    if (blob.size >= file.size) return file;

    const newName = file.name.replace(/\.[^.]+$/, '') + '.jpg';
    const compressed = new File([blob], newName, {
      type: 'image/jpeg',
      lastModified: Date.now(),
    });

    // eslint-disable-next-line no-console
    console.log(
      `[compressImage] ${file.name}: ${(file.size / 1024).toFixed(0)}KB -> ${(compressed.size / 1024).toFixed(0)}KB (${Math.round((1 - compressed.size / file.size) * 100)}% smaller)`
    );

    return compressed;
  } catch (err) {
    console.warn('[compressImage] failed, using original:', err);
    return file;
  }
}
