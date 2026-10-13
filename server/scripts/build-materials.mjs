// Splits the approved materials (materials/approved.json) into small chunks with citations.
// Output: src/chunks.json, which is bundled into the Worker. Run: npm run build-materials
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";

const dir = new URL("../materials/", import.meta.url);
const approved = JSON.parse(readFileSync(new URL("approved.json", dir), "utf8"));
const MAX_CHARS = 900;
const chunks = [];

for (const doc of approved.documents) {
  const text = readFileSync(new URL(doc.file, dir), "utf8");
  const prefix = doc.cite[0].toUpperCase(); // R = Reader, T = Teacher Guide, A = Anthology
  let heading = "";
  let n = 0;
  for (const section of text.split(/^### /m).slice(1)) {
    const [title, ...rest] = section.split("\n");
    const body = rest.join("\n").replace(/^## .*$/gm, "").replace(/\s+/g, " ").trim();
    const chapter = (text.slice(0, text.indexOf("### " + title)).match(/^## (.*)$/gm) || []).pop();
    if (chapter) heading = chapter.replace(/^## /, "");
    if (!body) continue;
    const page = (title.match(/^Page (\d+)/) || [])[1];
    // Split long sections on sentence boundaries.
    const parts = [];
    let cur = "";
    for (const sentence of body.split(/(?<=[.!?”])\s+/)) {
      if (cur && (cur + " " + sentence).length > MAX_CHARS) { parts.push(cur); cur = sentence; }
      else cur = cur ? cur + " " + sentence : sentence;
    }
    if (cur) parts.push(cur);
    parts.forEach((part, i) => {
      n++;
      const id = page ? `${prefix}${page}${parts.length > 1 ? "abcdefgh"[i] : ""}` : `${prefix}${n}`;
      const cite = page ? `${doc.cite}, p. ${page}` : `${doc.cite}: ${title.trim()}`;
      const context = page && heading ? `${heading}. ` : (title.trim() ? `${title.trim()}. ` : "");
      chunks.push({ id, cite, text: context + part });
    });
  }
}

const hash = createHash("sha256").update(JSON.stringify(chunks)).digest("hex").slice(0, 16);
writeFileSync(new URL("../src/chunks.json", import.meta.url), JSON.stringify({ hash, chunks }, null, 1) + "\n");
console.log(`Wrote ${chunks.length} chunks from ${approved.documents.length} approved documents (hash ${hash}).`);
