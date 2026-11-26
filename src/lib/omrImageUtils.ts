const IMAGE_EXT_REGEX = /\.(jpe?g|png|webp|heic|heif|bmp|gif)$/i;
const STANDARD_WEB_MIMES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);

/**
 * Identify image uploads reliably even when mobile browsers omit `file.type`.
 */
export function isLikelyImageFile(file: File | null | undefined): boolean {
  if (!file) return false;
  if (file.type && file.type.toLowerCase().startsWith("image/")) return true;
  if ((!file.type || file.type === "application/octet-stream") && IMAGE_EXT_REGEX.test(file.name || "")) {
    return true;
  }
  return false;
}

/**
 * Identify PDF uploads cleanly across mobile and desktop browsers.
 */
export function isPdfFile(file: File | null | undefined): boolean {
  if (!file) return false;
  return (
    file.type === "application/pdf" ||
    (file.name || "").toLowerCase().endsWith(".pdf")
  );
}

/**
 * Downscale a canvas proportionally so its longest edge never exceeds `maxEdge`.
 */
export function scaleCanvasIfNeeded(
  sourceCanvas: HTMLCanvasElement,
  maxEdge: number = 1600
): HTMLCanvasElement {
  const longest = Math.max(sourceCanvas.width, sourceCanvas.height);
  if (longest <= maxEdge || longest === 0) return sourceCanvas;

  const scale = maxEdge / longest;
  const targetW = Math.max(1, Math.round(sourceCanvas.width * scale));
  const targetH = Math.max(1, Math.round(sourceCanvas.height * scale));

  const out = document.createElement("canvas");
  out.width = targetW;
  out.height = targetH;
  const ctx = out.getContext("2d");
  if (!ctx) return sourceCanvas;
  ctx.drawImage(sourceCanvas, 0, 0, targetW, targetH);
  return out;
}

function loadFileToImage(file: File): Promise<{ width: number; height: number; drawSource: CanvasImageSource; cleanup: () => void }> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve({
        width: img.naturalWidth || img.width,
        height: img.naturalHeight || img.height,
        drawSource: img,
        cleanup: () => URL.revokeObjectURL(objectUrl),
      });
    };
    img.onerror = async () => {
      URL.revokeObjectURL(objectUrl);
      if (typeof createImageBitmap === "function") {
        try {
          const bmp = await createImageBitmap(file);
          resolve({
            width: bmp.width,
            height: bmp.height,
            drawSource: bmp,
            cleanup: () => bmp.close(),
          });
          return;
        } catch (err) {
          reject(err);
          return;
        }
      }
      reject(new Error("Could not decode uploaded image"));
    };
    img.src = objectUrl;
  });
}

/**
 * Compress and resize high-resolution / oversized / non-standard mobile photos into
 * JPEG (max edge 1600px, quality 0.85) so uploads stay well below serverless body limits.
 */
export async function prepareOmrImageFile(
  file: File,
  opts: {
    maxEdge?: number;
    quality?: number;
    sizeThresholdBytes?: number;
  } = {}
): Promise<File> {
  if (!file || typeof document === "undefined" || isPdfFile(file) || !isLikelyImageFile(file)) {
    return file;
  }

  const maxEdge = opts.maxEdge ?? 1600;
  const quality = opts.quality ?? 0.85;
  const sizeThresholdBytes = opts.sizeThresholdBytes ?? 1024 * 1024;
  const mime = (file.type || "").toLowerCase();
  const isStandardWebMime = STANDARD_WEB_MIMES.has(mime);

  try {
    const decoded = await loadFileToImage(file);
    try {
      const { width, height, drawSource } = decoded;
      const maxDim = Math.max(width, height);
      if (maxDim === 0) return file;

      const needsCompression =
        file.size > sizeThresholdBytes ||
        !isStandardWebMime ||
        maxDim > maxEdge;

      if (!needsCompression) {
        return file;
      }

      const scale = maxDim > maxEdge ? maxEdge / maxDim : 1;
      const targetW = Math.max(1, Math.round(width * scale));
      const targetH = Math.max(1, Math.round(height * scale));

      const canvas = document.createElement("canvas");
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext("2d");
      if (!ctx) return file;

      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, targetW, targetH);
      ctx.drawImage(drawSource, 0, 0, targetW, targetH);

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", quality)
      );
      if (!blob) return file;

      const baseName = (file.name || "omr-sheet").replace(/\.[^.]+$/, "");
      return new File([blob], `${baseName}.jpg`, {
        type: "image/jpeg",
        lastModified: file.lastModified || Date.now(),
      });
    } finally {
      decoded.cleanup();
    }
  } catch {
    return file;
  }
}
