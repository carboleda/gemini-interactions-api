import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { GoogleGenAI } from "@google/genai";

import * as agentEnvironment from "./agentEnvironment.js";
import * as progressBus from "./sseProgressBus.js";

const apiKey = process.env.GEMINI_API_KEY || "";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT_PATH = path.join(__dirname, "..", "scripts", "edit_image.py");
const TMP_DIR = path.join(__dirname, "..", ".data", "tmp");

const AGENT_NAME = "antigravity-preview-05-2026";
const DOWNLOAD_TIMEOUT_MS = 300000;
// History of edited versions is kept in /history (outside /workspace) inside
// the sandbox filesystem. downloadAndExtractOutput always fetches a snapshot
// of the whole /workspace (the download API has no way to request a single
// file), so growing that tree with one JPEG per past edit would make every
// download bigger than the last. /history lives outside /workspace, is
// still fully readable/writable by later interactions in the same
// environment, and is simply never part of what gets downloaded.
const HISTORY_DIR = "/history";

const client = new GoogleGenAI({});

function escapeForDoubleQuotedShellArg(value) {
  return String(value)
    .replaceAll("\\", "\\\\")
    .replaceAll('"', String.raw`\"`);
}

// NOTE: the Interactions API rejects any request that combines
// `environment.environment_id` with `environment.sources` (verified against
// the live API: it responds 400 "Request contains an invalid argument").
// Sources can only be mounted while creating a brand-new environment, so
// every edit provisions a fresh, fully self-contained sandbox instead of
// trying to remount input.base64 onto a previously reused environment.
function buildEnvironment({ base64Image }) {
  const scriptContent = fs.readFileSync(SCRIPT_PATH, "utf-8");

  // TODO (Paso 2): declara aquí la constante `sources`, un arreglo con los
  // dos archivos que el Managed Agent necesita en /workspace: la imagen del
  // usuario (`base64Image` -> /workspace/input.base64) y el script de
  // edición (`scriptContent` -> /workspace/edit_image.py).
  // Código completo y explicación -> Paso 2 del codelab.

  // TODO (Paso 3): declara aquí la constante `environment`, que activa
  // `network.allowlist` para inyectar la GEMINI_API_KEY (`apiKey`) solo en
  // las llamadas que el sandbox haga hacia generativelanguage.googleapis.com,
  // sin exponer la clave dentro del propio sandbox.
  // Código completo y explicación -> Paso 3 del codelab.

  throw new Error(
    "Completa los Pasos 2 y 3 del codelab en buildEnvironment() (lib/geminiAgent.js).",
  );

  return { sources, ...environment };
}

async function downloadAndExtractOutput({ environmentId, requestId }) {
  progressBus.emit(requestId, "Descargando resultado del sandbox...");

  // TODO (Paso 5): construye `url` apuntando al endpoint de descarga de la
  // API de Archivos de Gemini para este `environmentId`, y haz
  // `await fetch(url, { headers: { "x-goog-api-key": apiKey } })`, guardando
  // la respuesta en `response`.
  // Código completo y explicación -> Paso 5 del codelab.
  throw new Error(
    "Completa el Paso 5 del codelab en downloadAndExtractOutput() (lib/geminiAgent.js).",
  );

  if (!response.ok) {
    throw new Error(
      `No se pudo descargar el snapshot del sandbox: ${response.status} ${response.statusText}`,
    );
  }

  fs.mkdirSync(TMP_DIR, { recursive: true });
  const tarPath = path.join(TMP_DIR, `${requestId}.tar`);
  const extractDir = path.join(TMP_DIR, requestId);
  fs.mkdirSync(extractDir, { recursive: true });

  const buffer = Buffer.from(await response.arrayBuffer());
  fs.writeFileSync(tarPath, buffer);

  // TODO (Paso 5): usa `execFileSync("tar", [...])` para extraer únicamente
  // `./workspace/output.jpg` del tar descargado (`tarPath`) hacia
  // `extractDir`. Solo ese archivo: el snapshot completo incluye archivos
  // del propio sandbox que no necesitamos y que fallarían al extraerse en un
  // filesystem normal.
  // Código completo y explicación -> Paso 5 del codelab.

  const outputPath = path.join(extractDir, "workspace", "output.jpg");
  if (!fs.existsSync(outputPath)) {
    throw new Error(
      "El sandbox no generó el archivo /workspace/output.jpg esperado.",
    );
  }

  const outputBuffer = fs.readFileSync(outputPath);

  fs.rmSync(tarPath, { force: true });
  fs.rmSync(extractDir, { recursive: true, force: true });

  return outputBuffer;
}

export async function editImage({
  base64Image,
  prompt,
  model,
  requestId,
  sessionId,
  baseVersion,
}) {
  try {
    const session = agentEnvironment.get(sessionId);
    const isContinuation = Boolean(session?.environmentId);

    if (!isContinuation && !base64Image) {
      throw new Error("Se requiere una imagen para iniciar la edición.");
    }

    progressBus.emit(
      requestId,
      isContinuation
        ? "Reutilizando sandbox remoto..."
        : "Inicializando sandbox remoto...",
    );

    // Reusing an environment_id only works when no `sources` are sent in the
    // same call (verified against the live API: combining both always 400s).
    // So on a continuation we skip re-mounting input.base64 entirely and just
    // point the script at a file already sitting on disk in that environment
    // (either the latest output.jpg, or an older /history/vN.jpg entry when
    // the user restores a previous version).
    // `previous_interaction_id` is a top-level field of the interaction, not
    // part of `environment` (confirmed against the SDK's Environment_2 type,
    // which only has environment_id/network/sources/type).
    // TODO (Paso 4): declara aquí la constante `environment`. Si es una
    // continuación de sesión (`isContinuation`), reutiliza el sandbox
    // existente con `{ type: "remote", environment_id: session.environmentId }`;
    // si es la primera edición, créalo con `buildEnvironment({ base64Image })`.
    // Código completo y explicación -> Paso 4 del codelab.
    throw new Error(
      "Completa el Paso 4 del codelab en editImage() (lib/geminiAgent.js).",
    );

    const safePrompt = escapeForDoubleQuotedShellArg(prompt);
    const safeModel = escapeForDoubleQuotedShellArg(model);

    let command;
    let newVersion;

    if (!isContinuation) {
      newVersion = 1;
      command =
        `mkdir -p ${HISTORY_DIR} && ` +
        `python /workspace/edit_image.py --decode --output /workspace/output.jpg --prompt "${safePrompt}" --model "${safeModel}" && ` +
        `cp /workspace/input.jpg ${HISTORY_DIR}/v0.jpg && ` +
        `cp /workspace/output.jpg ${HISTORY_DIR}/v1.jpg`;
    } else {
      const maxVersion = session.nextVersion - 1;
      const resolvedBase = Number.isInteger(baseVersion)
        ? baseVersion
        : maxVersion;
      if (resolvedBase < 0 || resolvedBase > maxVersion) {
        throw new Error("Versión de historial inválida.");
      }
      newVersion = session.nextVersion;
      command =
        `python /workspace/edit_image.py --input ${HISTORY_DIR}/v${resolvedBase}.jpg --output /workspace/output.jpg --prompt "${safePrompt}" --model "${safeModel}" && ` +
        `cp /workspace/output.jpg ${HISTORY_DIR}/v${newVersion}.jpg`;
    }

    const input = `Run this exact command in the workspace and wait for it to finish: ${command}`;

    progressBus.emit(requestId, "Ejecutando Python script en sandbox...");
    progressBus.emit(requestId, "Llamando a Nano Banana...");

    // TODO (Paso 4): declara aquí `createParams` con los campos que exige el
    // Managed Agent (`agent`, `input`, `environment`, y
    // `previous_interaction_id: session.lastInteractionId` únicamente cuando
    // `isContinuation` es true) y llama a
    // `await client.interactions.create(createParams, { timeout: DOWNLOAD_TIMEOUT_MS })`,
    // guardando el resultado en `interaction`.
    // Código completo y explicación -> Paso 4 del codelab.
    throw new Error(
      "Completa el Paso 4 del codelab en editImage() (lib/geminiAgent.js).",
    );

    agentEnvironment.save(sessionId, {
      environmentId: interaction.environment_id,
      lastInteractionId: interaction.id,
      nextVersion: newVersion + 1,
    });

    const outputBuffer = await downloadAndExtractOutput({
      environmentId: interaction.environment_id,
      requestId,
    });

    progressBus.done(requestId);
    return { buffer: outputBuffer, version: newVersion };
  } catch (error) {
    progressBus.fail(requestId, error.message || String(error));
    progressBus.done(requestId);
    throw error;
  }
}

export async function generateSuggestions({
  base64Image,
  mimeType = "image/jpeg",
}) {
  // TODO (Paso 1): llama a `client.models.generateContent({...})` pidiendo
  // el modelo "gemini-3.5-flash", enviando la imagen (`inlineData` con
  // `mimeType`/`base64Image`) junto con un prompt de texto que pida al menos
  // 4 sugerencias de edición en español, y configurando salida estructurada
  // (`responseMimeType: "application/json"` + `responseSchema` de un array
  // de strings con `minItems: 4`). Guarda el resultado en `response`.
  // Código completo y explicación -> Paso 1 del codelab.
  throw new Error(
    "Completa el Paso 1 del codelab en generateSuggestions() (lib/geminiAgent.js).",
  );

  const suggestions = JSON.parse(response.text);
  if (!Array.isArray(suggestions) || suggestions.length < 4) {
    throw new Error("El modelo no devolvió al menos 4 sugerencias válidas.");
  }
  return suggestions;
}
