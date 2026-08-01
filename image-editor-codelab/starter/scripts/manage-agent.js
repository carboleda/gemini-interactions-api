import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { GoogleGenAI } from "@google/genai";

const AGENT_ID = "image-editor-agent";
const BASE_AGENT = "antigravity-preview-05-2026";

const apiKey = process.env.GEMINI_API_KEY || "";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT_PATH = path.join(__dirname, "edit_image.py");

const client = new GoogleGenAI({});

const SYSTEM_INSTRUCTION =
  "Eres el agente que ejecuta ediciones de imagenes para la app image-editor. " +
  "En cada interaccion recibiras un comando de shell exacto: ejecutalo en /workspace " +
  "y espera a que termine por completo. Si falla por una dependencia faltante " +
  "(por ejemplo ModuleNotFoundError), instala esa dependencia y reintenta el comando " +
  "original antes de responder. Fuera de resolver ese tipo de fallos, no agregues " +
  "pasos, archivos ni comandos que no se te hayan pedido explicitamente.";

const USAGE = `Uso: node scripts/manage-agent.js <comando>

Comandos:
  -c, --create             Crea el agente "${AGENT_ID}" (no hace nada si ya existe).
  -l, --list               Lista los agentes registrados.
  -d, --delete             Elimina el agente "${AGENT_ID}".
  -i, --interaction <id>   Muestra el detalle de una interaccion por su id.
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

  console.table(agents, ["id", "base_agent", "description"]);
}

async function deleteAgent() {
  await client.agents.delete(AGENT_ID);
  console.log(`Agente "${AGENT_ID}" eliminado.`);
}

async function getInteraction(interactionId) {
  const interaction = await client.interactions.get(interactionId);
  console.log(JSON.stringify(interaction, null, 2));
}

const OPTIONS = {
  create: { type: "boolean", short: "c" },
  list: { type: "boolean", short: "l" },
  delete: { type: "boolean", short: "d" },
  interaction: { type: "string", short: "i" },
};

function parseCommand(argv) {
  const { values } = parseArgs({ args: argv, options: OPTIONS, strict: true });

  if (values.create) return { command: "create" };
  if (values.list) return { command: "list" };
  if (values.delete) return { command: "delete" };
  if (values.interaction) {
    return { command: "interaction", arg: values.interaction };
  }
  return null;
}

const ACTIONS = {
  create: () => createAgent(),
  list: () => listAgents(),
  delete: () => deleteAgent(),
  interaction: (interactionId) => getInteraction(interactionId),
};

try {
  const parsed = parseCommand(process.argv.slice(2));
  if (!parsed) {
    console.error(USAGE);
    process.exitCode = 1;
  } else {
    await ACTIONS[parsed.command](parsed.arg);
  }
} catch (error) {
  console.error(error.message ?? error);
  process.exitCode = 1;
}
