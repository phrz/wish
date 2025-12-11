import Alpine from "alpinejs";
import { thumbHashToDataURL } from "thumbhash";

window.Alpine = Alpine;

function decodeThumbHash(thumbHash) {
	const bin = Uint8Array.fromBase64(thumbHash);
	// console.log("thumbhash", thumbHash, "=>", bin);

	// const res = thumbHashToDataURL(bin);
	// console.log(res);
	return thumbHashToDataURL(bin);
}

document.addEventListener("alpine:init", () => {
	Alpine.store("wishlist", {
		data: {},
		decodeThumbHash: decodeThumbHash,
	});
});

Alpine.start();
