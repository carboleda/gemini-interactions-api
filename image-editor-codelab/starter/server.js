import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import multer from "multer";

import { compressImage, resizeForAnalysis } from "./lib/imageProcessing.js";
import * as progressBus from "./lib/sseProgressBus.js";
import * as geminiAgent from "./lib/geminiAgent.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;

const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
});

app.use(express.static(path.join(__dirname, "public")));

app.get("/api/edit/events/:requestId", (req, res) => {
  progressBus.subscribe(req.params.requestId, req, res);
});

app.post("/api/edit", upload.single("image"), async (req, res) => {
  const body = req.body || {};
  const requestId = body.requestId;
  try {
    const sessionId = body.sessionId;
    const prompt = (body.prompt || "").trim();
    if (!prompt) {
      throw new Error("El prompt de edición es obligatorio.");
    }
    const model = body.model || "gemini-3.1-flash-image";
    const baseVersion =
      body.baseVersion !== undefined ? Number.parseInt(body.baseVersion, 10) : undefined;

    let base64 = null;
    if (req.file) {
      if (requestId) {
        progressBus.emit(requestId, "Comprimiendo imagen...");
      }
      ({ base64 } = await compressImage(req.file.buffer));
    }

    const { buffer, version } = await geminiAgent.editImage({
      base64Image: base64,
      prompt,
      model,
      requestId,
      sessionId,
      baseVersion,
    });

    res.set("X-Edit-Version", String(version)).type("image/jpeg").send(buffer);
  } catch (error) {
    console.error("Error en /api/edit:", error);
    if (requestId) {
      progressBus.fail(requestId, error.message || String(error));
      progressBus.done(requestId);
    }
    res.status(500).json({ error: error.message || "Error desconocido" });
  }
});

app.post("/api/suggest-prompts", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      throw new Error("No se recibió ninguna imagen.");
    }

    const { base64 } = await resizeForAnalysis(req.file.buffer);
    const suggestions = await geminiAgent.generateSuggestions({
      base64Image: base64,
    });

    res.json({ suggestions });
  } catch (error) {
    console.error("Error en /api/suggest-prompts:", error);
    res.status(500).json({ error: error.message || "Error desconocido" });
  }
});

app.listen(PORT, () => {
  console.log(`Editor de imágenes escuchando en http://localhost:${PORT}`);
});
