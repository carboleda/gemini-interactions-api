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
const POLL_INTERVAL_MS = 5000;
const MAX_WAIT_MS = 300000;
const MAX_GET_RETRIES = 3;
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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// NOTE: the Interactions API rejects any request that combines
// `environment.environment_id` with `environment.sources` (verified against
// the live API: it responds 400 "Request contains an invalid argument").
// Sources can only be mounted while creating a brand-new environment, so
// every edit provisions a fresh, fully self-contained sandbox instead of
// trying to remount input.base64 onto a previously reused environment.
function buildEnvironment({ base64Image }) {
  const scriptContent = fs.readFileSync(SCRIPT_PATH, "utf-8");

  const sources = [
    {
      type: "inline",
      content: base64Image,
      target: "/workspace/input.base64",
    },
    {
      type: "inline",
      content: scriptContent,
      target: "/workspace/edit_image.py",
    },
  ];

  // https://ai.google.dev/gemini-api/docs/agent-environment#credentials
  // Add credentials to the allowlist so they are include in the request during the network egress.
  // This is necessary for the sandbox to be able to call the Gemini API.
  // Using this approach the api key is never exposed to the agent sandbox.
  const environment = {
    type: "remote",
    network: {
      allowlist: [
        { domain: "*" },
        {
          domain: "generativelanguage.googleapis.com",
          transform: {
            "x-goog-api-key": apiKey,
          },
        },
      ],
    },
  };

  return { sources, ...environment };
}

async function downloadAndExtractOutput({ environmentId, requestId }) {
  progressBus.emit(requestId, "Descargando resultado del sandbox...");

  const url = `https://generativelanguage.googleapis.com/v1beta/files/environment-${environmentId}:download?alt=media`;

  const response = await fetch(url, {
    headers: { "x-goog-api-key": apiKey },
  });

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

  // Only extract the file we need: the full snapshot includes the sandbox's
  // system files (hardlinks, special permissions) that fail to extract on a
  // regular filesystem and that we don't need anyway.
  execFileSync("tar", [
    "-xf",
    tarPath,
    "-C",
    extractDir,
    "./workspace/output.jpg",
  ]);

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
    const environment = isContinuation
      ? { type: "remote", environment_id: session.environmentId }
      : buildEnvironment({ base64Image });

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

    progressBus.emit(requestId, "Lanzando ejecución en background...");

    const createParams = {
      agent: AGENT_NAME,
      input,
      environment,
      background: true,
      ...(isContinuation
        ? { previous_interaction_id: session.lastInteractionId }
        : {}),
    };

    let interaction = await client.interactions.create(createParams);
    const startedAt = Date.now();
    let consecutiveGetErrors = 0;

    while (
      interaction.status === "queued" ||
      interaction.status === "in_progress"
    ) {
      if (Date.now() - startedAt > MAX_WAIT_MS) {
        throw new Error(
          "El agente no terminó a tiempo (timeout de 5 minutos).",
        );
      }
      const elapsedSeconds = Math.round((Date.now() - startedAt) / 1000);
      progressBus.emit(
        requestId,
        `Agente trabajando en el sandbox (Nano Banana)... (${elapsedSeconds}s transcurridos)`,
      );
      await sleep(POLL_INTERVAL_MS);

      try {
        interaction = await client.interactions.get(interaction.id);
        consecutiveGetErrors = 0;
      } catch (error) {
        consecutiveGetErrors += 1;
        if (consecutiveGetErrors > MAX_GET_RETRIES) {
          throw error;
        }
        progressBus.emit(
          requestId,
          `Error temporal consultando el estado del agente, reintentando (${consecutiveGetErrors}/${MAX_GET_RETRIES})...`,
        );
      }
    }

    if (interaction.status !== "completed") {
      throw new Error(
        `El Managed Agent terminó con estado "${interaction.status}".`,
      );
    }

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
  const interaction = await client.interactions.create({
    model: "gemini-3.5-flash",
    input: [
      {
        type: "text",
        text:
          "Analiza el contenido de esta imagen y genera al menos 4 sugerencias " +
          "cortas y realistas de ediciones en español, basadas estrictamente en " +
          "los elementos detectados (por ejemplo, cambiar el color de un objeto o " +
          "prenda, agregar un accesorio, o modificar el cielo o el fondo). " +
          'Ejemplos de formato: "Haz que el carro sea rojo", ' +
          '"Haz que la camiseta de la persona sea azul".',
      },
      {
        type: "image",
        data: base64Image,
        mime_type: mimeType,
      },
    ],
    response_format: {
      type: "text",
      mime_type: "application/json",
      schema: {
        type: "array",
        items: { type: "string" },
        minItems: 4,
      },
    },
  });

  const suggestions = JSON.parse(interaction.output_text);
  if (!Array.isArray(suggestions) || suggestions.length < 4) {
    throw new Error("El modelo no devolvió al menos 4 sugerencias válidas.");
  }
  return suggestions;
}
