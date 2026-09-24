import Image from "@11ty/eleventy-img";

export async function srcResized(src, maxWidth) {
  const metadata = await Image(`src${src}`, {
    transformOnRequest: process.env.ELEVENTY_RUN_MODE === "serve",
    outputDir: "./_site/img/",
    widths: [maxWidth],
    formats: ["webp"],
  });

  const data = metadata.webp[metadata.webp.length - 1];
  return data.url;
}