import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STATE_FILE = path.join(__dirname, "..", ".data", "agent-sessions.json");

function ensureDataDir() {
  fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
}

function readAll() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, "utf-8"));
  } catch {
    return {};
  }
}

function writeAll(sessions) {
  ensureDataDir();
  fs.writeFileSync(STATE_FILE, JSON.stringify(sessions, null, 2));
}

// Tracks {environmentId, lastInteractionId} per editing session (one entry per
// image loaded in the client), so follow-up edits on the same image can reuse
// the existing sandbox and chain onto the previous interaction instead of
// re-uploading the image and re-provisioning the environment from scratch.
export function get(sessionId) {
  if (!sessionId) return null;
  return readAll()[sessionId] ?? null;
}

export function save(sessionId, { environmentId, lastInteractionId, nextVersion }) {
  if (!sessionId) return;
  const sessions = readAll();
  sessions[sessionId] = { environmentId, lastInteractionId, nextVersion };
  writeAll(sessions);
}
