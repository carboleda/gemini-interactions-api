import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const DOWNLOADS_DIR = path.join(ROOT, "public", "downloads");

function zipDir(sourceDir, zipPath) {
  rmSync(zipPath, { force: true });
  execFileSync(
    "zip",
    ["-r", "-X", "-q", zipPath, ".", "-x", "node_modules/*", "-x", ".data/*", "-x", "*.DS_Store"],
    { cwd: sourceDir },
  );
  console.log(`Empaquetado ${path.relative(ROOT, sourceDir)} -> ${path.relative(ROOT, zipPath)}`);
}

mkdirSync(DOWNLOADS_DIR, { recursive: true });

zipDir(
  path.join(ROOT, "starter"),
  path.join(DOWNLOADS_DIR, "image-editor-starter.zip"),
);
