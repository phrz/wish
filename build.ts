import { cpSync } from "node:fs";
import tailwind from "bun-plugin-tailwind";
const path = require("node:path");
import { readdir } from "node:fs/promises";
import sharp from "sharp";
import { mkdirp } from "mkdirp";

import html from "./src/index.html" with { type: "text" }; // for hmr
console.log(html.length);

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
const formats = new Set([
	".png",
	".jpg",
	".jpeg",
	".webp",
	".avif",
	".gif",
	".tiff",
	".bmp",
]);
for (const file of files) {
	const srcPath = path.join("./src/img", file);
	if (!formats.has(path.parse(srcPath).ext)) {
		console.log(
			"skipping non image file: ",
			srcPath,
			"ext",
			path.parse(srcPath).ext,
		);
		continue;
	}

	const dstParse = path.parse(path.join("./dist/img", file)); // dest with wrong extension
	const dstPath = path.join(dstParse.dir, dstParse.name + ".avif");
	await sharp(srcPath).toFormat("avif").toFile(dstPath);
	// add to lookup fileMap
	fileMap[path.relative("./src", srcPath)] = path.relative("./dist", dstPath);
}
console.log(fileMap);

// load src/data.json and add import images, add blurhash
import datajson from "./src/data.json";
import { rgbaToThumbHash } from "thumbhash";

let dataOut = structuredClone(datajson);
dataOut.gifts = []; // empty and add copies as processed

const encodeImageToThumbHash = async (imagePath: string) => {
	// thumbhash requires to fit within 100x100
	const file = sharp(imagePath).resize(100, 100, {
		fit: sharp.fit.inside,
		withoutEnlargement: true,
	});

	const img = await file.raw().toBuffer({ resolveWithObject: true });

	const info = img.info;
	const data: Uint8Array = img.data;

	const { width, height, channels } = info;
	const hash: Uint8Array = rgbaToThumbHash(width, height, data);
	return Buffer.from(hash).toString("base64");
};

for (const giftIn of datajson.gifts) {
	let giftOut = structuredClone(giftIn);
	if (giftIn.picture != null) {
		const imgPath = path.join("./src", giftIn.picture);
		giftOut["thumbHash"] = await encodeImageToThumbHash(imgPath);
		// rewrite image path to optimized version
		// path may not be exact, e.g. compare ./img/test.png == img/test.png
		giftOut.picture = fileMap[path.relative(".", giftIn.picture)];
		console.log(giftOut);
		dataOut.gifts.push(giftOut);
	}
}

// write dataOut to dist/data.json
await Bun.write("./dist/data.json", JSON.stringify(dataOut));

if (process.env.IS_BUILD !== "true") {
	const server = Bun.serve({
		port: 3000,
		async fetch(req) {
			const filePath = new URL(req.url).pathname;
			let fullPath = path.join(
				"./dist",
				filePath,
				filePath.endsWith("/") ? "index.html" : "",
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
}
