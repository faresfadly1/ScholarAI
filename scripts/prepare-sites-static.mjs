import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const web = path.join(root, "apps", "web");
const output = path.join(root, "dist");

rmSync(path.join(root, "dist"), { recursive: true, force: true });
mkdirSync(output, { recursive: true });
const htmlPath = path.join(output, "index.html");
cpSync(path.join(web, ".next", "server", "app", "dashboard.html"), htmlPath);
cpSync(path.join(web, ".next", "static"), path.join(output, "_next", "static"), { recursive: true });
cpSync(path.join(web, "public"), output, { recursive: true });

if (process.env.GITHUB_ACTIONS) {
  const basePath = "/ScholarAI";
  const html = readFileSync(htmlPath, "utf8")
    .replaceAll('"/_next/', `"${basePath}/_next/`)
    .replaceAll('"/favicon.svg', `"${basePath}/favicon.svg`);
  writeFileSync(htmlPath, html);
}
