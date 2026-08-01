import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { GoogleGenAI } from "@google/genai";

import { AGENT_ID, BASE_AGENT } from "../lib/agentConfig.js";

const apiKey = process.env.GEMINI_API_KEY || "";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT_PATH = path.join(__dirname, "edit_image.py");

const client = new GoogleGenAI({});

const SYSTEM_INSTRUCTION =
  "Eres el agente que ejecuta ediciones de imagenes para la app image-editor. " +
  "En cada interaccion recibiras un comando de shell exacto: ejecutalo tal cual en " +
  "/workspace, espera a que termine por completo, y no agregues pasos, archivos ni " +
  "comandos adicionales que no se te hayan pedido explicitamente.";

const USAGE = `Uso: node scripts/manage-agent.js <comando>

Comandos:
  -c, --create   Crea el agente "${AGENT_ID}" (no hace nada si ya existe).
  -l, --list     Lista los agentes registrados.
  -d, --delete   Elimina el agente "${AGENT_ID}".
`;

// Bundles the static edit_image.py script and the egress allowlist into the
// agent's base_environment so they don't need to be re-inlined as `sources`
// on every editImage() call. Safe to re-run: if the agent already exists,
// it's left untouched.
async function createAgent() {
  try {
    const existing = await client.agents.get(AGENT_ID);
    console.log(
      `El agente "${existing.id}" ya existe. No se realizaron cambios.`,
    );
    return;
  } catch {
    // Not found (or any other lookup failure) — fall through and create it.
  }

  const scriptContent = fs.readFileSync(SCRIPT_PATH, "utf-8");

  const agent = await client.agents.create({
    id: AGENT_ID,
    base_agent: BASE_AGENT,
    system_instruction: SYSTEM_INSTRUCTION,
    base_environment: {
      type: "remote",
      sources: [
        {
          type: "inline",
          content: scriptContent,
          target: "/workspace/edit_image.py",
        },
      ],
      // https://ai.google.dev/gemini-api/docs/agent-environment#credentials
      // Same allowlist used before per-call in buildEnvironment(): lets the
      // sandbox call the Gemini API without ever exposing the API key to it.
      network: {
        allowlist: [
          { domain: "*" },
          {
            domain: "generativelanguage.googleapis.com",
            transform: { "x-goog-api-key": apiKey },
          },
        ],
      },
    },
  });

  console.log(`Agente "${agent.id}" creado correctamente.`);
}

async function listAgents() {
  const { agents } = await client.agents.list();

  if (!agents?.length) {
    console.log("No hay agentes registrados.");
    return;
  }

  for (const agent of agents) {
    console.log(
      `${agent.id}\tbase_agent=${agent.base_agent ?? "-"}\t${agent.description ?? ""}`,
    );
  }
}

async function deleteAgent() {
  await client.agents.delete(AGENT_ID);
  console.log(`Agente "${AGENT_ID}" eliminado.`);
}

function parseCommand(argv) {
  const flags = new Set(argv);
  const has = (...names) => names.some((name) => flags.has(name));

  if (has("-c", "--create")) return "create";
  if (has("-l", "--list")) return "list";
  if (has("-d", "--delete")) return "delete";
  return null;
}

const ACTIONS = {
  create: createAgent,
  list: listAgents,
  delete: deleteAgent,
};

const command = parseCommand(process.argv.slice(2));

if (!command) {
  console.error(USAGE);
  process.exitCode = 1;
} else {
  try {
    await ACTIONS[command]();
  } catch (error) {
    console.error(`Error ejecutando "${command}":`, error);
    process.exitCode = 1;
  }
}
