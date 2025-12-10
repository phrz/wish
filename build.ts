import { cpSync } from "node:fs";
import tailwind from "bun-plugin-tailwind";
import html from "./src/index.html" with { type: "text" }; // for hmr
import path from "node:path";
import { readdir } from "node:fs/promises";
import sharp from "sharp";
import { mkdirp } from "mkdirp";

await Bun.build({
	entrypoints: ["./src/index.html"],
	outdir: "./dist",
	plugins: [tailwind],
});

// Copy public folder
// await cpSync("./src/static/", "./dist", { recursive: true });

// for image in ./src/img/, copy to ./dist/img/ with sharp to re-encode to avif.
await mkdirp("./dist/img");
const files = await readdir("./src/img");
let fileMap = {}; // ./src/img/test.png => ./dist/img/test.avif
for (const file of files) {
	const srcPath = path.join("./src/img", file);

	const dstParse = path.parse(path.join("./dist/img", file)); // dest with wrong extension
	const dstPath = path.join(dstParse.dir, dstParse.name + ".avif");
	await sharp(srcPath).toFormat("avif").toFile(dstPath);
	// add to lookup fileMap
	fileMap[path.relative("./src", srcPath)] = path.relative("./dist", dstPath);
}
console.log(fileMap);

// load src/data.json and add import images, add blurhash
import data from "./src/data.json";
import { encode } from "blurhash";

let dataOut = structuredClone(data);
dataOut.gifts = []; // empty and add copies as processed

const encodeImageToBlurhash = async (path) => {
	const metadata = await sharp(path).metadata();
	const buffer = await sharp(path).raw().toBuffer();
	return encode(buffer, metadata.width, metadata.height, 4, 4);
};

for (const giftIn of data.gifts) {
	let giftOut = structuredClone(giftIn);
	if (giftIn.picture != null) {
		const imgPath = path.join("./src", giftIn.picture);
		giftOut["blurHash"] = await encodeImageToBlurhash(imgPath);
		// rewrite image path to optimized version
		// path may not be exact, e.g. compare ./img/test.png == img/test.png
		giftOut.picture = fileMap[path.relative(".", giftIn.picture)];
		console.log(giftOut);
		dataOut.gifts.push(giftOut);
	}
}

const server = Bun.serve({
	port: 3000,
	async fetch(req) {
		const path = new URL(req.url).pathname;
		let fullPath = path.join(
			"./dist",
			path,
			path.endsWith("/") ? "index.html" : "",
		);
		const file = Bun.file(fullPath);
		if (await file.exists()) {
			return new Response(file);
		} else {
			return new Response(`${fullPath} Not Found`, { status: 404 });
		}
	},
});

console.log(`Server running on port ${server.port}`);
