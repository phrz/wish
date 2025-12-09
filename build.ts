import { cpSync } from "node:fs";
import tailwind from "bun-plugin-tailwind";

await Bun.build({
  entrypoints: ["./src/index.html"],
  outdir: "./dist",
  plugins: [tailwind],
});

// Copy public folder
await cpSync("./src/static/", "./dist", { recursive: true });

const server = Bun.serve({
  port: 3000,
  async fetch(req) {
    const path = new URL(req.url).pathname;
    let fullPath = "./dist" + path;
    if (fullPath.endsWith("/")) fullPath += "index.html";
    const file = Bun.file(fullPath);
    if (await file.exists()) {
      return new Response(file);
    } else {
      return new Response(`${fullPath} Not Found`, { status: 404 });
    }
  },
});

console.log(`Server running on port ${server.port}`);
