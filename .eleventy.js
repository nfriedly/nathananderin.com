const path = require("path");
const fs = require("fs");
const ejsPlugin = require("@11ty/eleventy-plugin-ejs");
const { default: eleventyImage } = require("@11ty/eleventy-img");

function splitFrontmatter(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(text);
  return m ? { head: m[1], body: m[2] } : null;
}

function makeExcerpt(body) {
  if (!body) return "";
  const blocks = body
    .replace(/<figure>[\s\S]*?<\/figure>/gi, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/^[#>*]+\s*/gm, "")
    .replace(/^[\s]*[-+]\s+/gm, "")
    .replace(/[*_`>]/g, " ")
    .split(/\n{2,}/)
    .map((b) => b.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  if (!blocks.length) return "";
  let text = blocks[0];
  if (blocks.length > 1 && blocks[0].length <= 45) text = blocks[1];
  text = text.trim();
  const max = 203;
  if (text.length > max) {
    const cut = text.slice(0, max).replace(/\s+\S*$/, "").replace(/[.…]\s*$/, ".");
    text = cut + "…";
  }
  return text;
}

module.exports = function (eleventyConfig) {
  const settings = {
    dir: {
      input: "src",
      output: "_site",
    },
    templateFormats: ["html", "md", "njk", "ejs"],
  };

  eleventyConfig.addLayoutAlias("main", "layouts/main.ejs");
  eleventyConfig.addLayoutAlias("review", "layouts/review.ejs");

  eleventyConfig.addPassthroughCopy("src/CNAME");
  eleventyConfig.addPassthroughCopy("src/.nojekyll");
  eleventyConfig.addPassthroughCopy("src/*.jpg");
  eleventyConfig.addPassthroughCopy("src/src-images");
  eleventyConfig.addPassthroughCopy("src/styles");
  eleventyConfig.addPassthroughCopy("src/**/*.jpg");
  eleventyConfig.addPassthroughCopy("src/**/*.png");
  eleventyConfig.addPassthroughCopy("src/**/*.jpeg");
  eleventyConfig.addPassthroughCopy("src/**/*.webp");
  eleventyConfig.addPassthroughCopy("src/**/*.mp4");

  eleventyConfig.addPlugin(ejsPlugin);

  // newest first; folder names are date-prefixed (YYYY-MM-DD-...) so sorting
  // by inputPath descending sorts by date, newest review first.
  eleventyConfig.addCollection("reviews", function (collectionApi) {
    return collectionApi
      .getFilteredByTag("review")
      .sort((a, b) => String(b.inputPath).localeCompare(String(a.inputPath), undefined, { numeric: true }))
      .map((item) => {
        if (!item.data.excerpt && item.inputPath && /\.(md)$/.test(item.inputPath)) {
          const raw = fs.readFileSync(item.inputPath, "utf8");
          const fm = splitFrontmatter(raw);
          if (fm) item.data.excerpt = makeExcerpt(fm.body);
        }
        return item;
      });
  });

  eleventyConfig.addGlobalData("amazonSearchUrl", () => {
    return (query) => `https://www.amazon.com/s?k=${encodeURIComponent(query)}&tag=nathananderin-20`;
  });

  eleventyConfig.addGlobalData("affiliateUrl", () => {
    return (url) => {
      if (typeof url !== "string") return url;
      try {
        const urlObj = new URL(url);
        if (urlObj.hostname.includes("amazon.")) {
          urlObj.searchParams.set("tag", "nathananderin-20");
          return urlObj.toString();
        }
      } catch (_e) {
        // URL parsing failed, return original
      }
      return url;
    };
  });

  eleventyConfig.addShortcode("siteUrl", () => "https://www.nathananderin.com");

  eleventyConfig.addShortcode("buildDate", () => new Date().toUTCString());

  // Generate 200px-wide JPEG thumbnails for every image in each review
  // directory, written into _site/reviews/<slug>/thumbs/. The review-card
  // partial references them via post.url + "thumbs/" so the list page never
  // ships the full-size images (detail pages keep the originals).
  eleventyConfig.on("eleventy.after", async () => {
    const reviewsSrc = path.join(__dirname, "src", "reviews");
    const reviewsOut = path.join(__dirname, "_site", "reviews");
    if (!fs.existsSync(reviewsSrc)) return;
    let thumbnailed = 0;
    for (const slug of fs.readdirSync(reviewsSrc)) {
      const srcDir = path.join(reviewsSrc, slug);
      if (!fs.statSync(srcDir).isDirectory()) continue;
      const files = fs
        .readdirSync(srcDir)
        .filter((f) => /\.(jpe?g|webp)$/i.test(f));
      for (const f of files) {
        await eleventyImage(path.join(srcDir, f), {
          widths: [200],
          formats: ["jpeg"],
          outputDir: path.join(reviewsOut, slug, "thumbs"),
          urlPath: path.posix.join("/reviews", slug, "thumbs"),
          filenameFormat: (_id, src, _width, _format) =>
            `${path.basename(src, path.extname(src))}.jpg`,
        });
        thumbnailed++;
      }
    }
    if (thumbnailed) {
      console.log(`[eleventy-img] generated ${thumbnailed} thumbnails`);
    }
  });

  return settings;
};