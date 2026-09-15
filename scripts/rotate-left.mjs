import { Jimp } from "jimp";

const input = process.argv[2];

if (!input) {
  console.error("Usage: node scripts/rotate-left.mjs <image-path>");
  process.exit(1);
}

const image = await Jimp.read(input);
image.rotate(90);
await image.write(input);
console.log(`Rotated ${input} 90 degrees counter-clockwise (${image.bitmap.width}x${image.bitmap.height})`);