import { Jimp } from "jimp";

const input = process.argv[2];

if (!input) {
  console.error("Usage: node scripts/rotate-right.mjs <image-path>");
  process.exit(1);
}

const image = await Jimp.read(input);
image.rotate(-90);
await image.write(input);
console.log(`Rotated ${input} 90 degrees clockwise (${image.bitmap.width}x${image.bitmap.height})`);