import sharp from "sharp";

const MAX_BYTES = 1024 * 1024; // 1MB
const WIDTH_STEPS = [1920, 1600, 1200, 900, 700, 500];

/**
 * Compresses an image buffer to a JPEG under MAX_BYTES, trying decreasing
 * widths until it fits (Gemini inline sources have a strict size limit).
 */
export async function compressImage(buffer) {
  for (const width of WIDTH_STEPS) {
    const out = await sharp(buffer)
      .rotate()
      .resize({ width, withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer();

    if (out.length < MAX_BYTES) {
      return { buffer: out, base64: out.toString("base64") };
    }
  }

  // Last resort: aggressive quality drop at the smallest width.
  const fallback = await sharp(buffer)
    .rotate()
    .resize({ width: WIDTH_STEPS.at(-1), withoutEnlargement: true })
    .jpeg({ quality: 60 })
    .toBuffer();

  return { buffer: fallback, base64: fallback.toString("base64") };
}

/**
 * Downscales an image for cheap/fast content analysis (prompt suggestions).
 */
export async function resizeForAnalysis(buffer, maxSize = 512) {
  const out = await sharp(buffer)
    .rotate()
    .resize({
      width: maxSize,
      height: maxSize,
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality: 80 })
    .toBuffer();

  return { buffer: out, base64: out.toString("base64") };
}
