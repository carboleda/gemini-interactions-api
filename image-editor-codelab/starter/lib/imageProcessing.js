import sharp from "sharp";

// The Interactions API caps inline `sources[].content` at 1 MiB of base64
// text (verified against the live API), not 1MB of raw image bytes. Base64
// inflates size by 4/3, so the check below must happen post-encoding —
// comparing the raw buffer length against 1MB (as before) let images through
// that were actually ~1.33MB once base64-encoded, causing 400 invalid_request.
const MAX_BASE64_CHARS = 1000 * 1024;
const WIDTH_STEPS = [1920, 1600, 1200, 900, 700, 500];

/**
 * Compresses an image buffer to a JPEG under MAX_BASE64_CHARS once
 * base64-encoded, trying decreasing widths until it fits.
 */
export async function compressImage(buffer) {
  for (const width of WIDTH_STEPS) {
    const out = await sharp(buffer)
      .rotate()
      .resize({ width, withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer();

    const base64 = out.toString("base64");
    if (base64.length < MAX_BASE64_CHARS) {
      return { buffer: out, base64 };
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
