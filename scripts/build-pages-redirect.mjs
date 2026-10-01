import { mkdirSync, writeFileSync } from "node:fs";
import { appOrigin, assertAppReady, redirectHtml } from "./lib/pages-redirect.mjs";

const origin = appOrigin(process.env.PUBLIC_APP_URL || "");
await assertAppReady(origin);
mkdirSync("dist", { recursive: true });
const html = redirectHtml(origin);
for (const file of ["index.html", "404.html"]) writeFileSync(`dist/${file}`, html);
writeFileSync("dist/.nojekyll", "");
console.log(`GitHub Pages will open the verified application at ${origin}/login`);
