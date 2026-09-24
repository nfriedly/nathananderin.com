import fs from "fs";
import path from "path";
import { heroImageUrl, inlineImageRefs, makeExcerpt, postPageTitle, splitFrontmatter } from "./reviews.mjs";

// Enrich a collection item with the data the preview/card/title need. Reads
// the post body from disk for excerpts, auto-discovers images from the
// folder-per-entry convention, and sets fullTitle for the page <title> tag.
export function makePreview(item) {
  let body = null;
  if (item.inputPath && /\.(md)$/.test(item.inputPath)) {
    const raw = fs.readFileSync(item.inputPath, "utf8");
    const fm = splitFrontmatter(raw);
    if (fm) {
      body = fm.body;
      if (!item.data.excerpt) item.data.excerpt = makeExcerpt(fm.body);
    }
  }

  // Auto-populate images from filesystem. Folder-per-entry convention only
  // (the file is named index.md inside its own folder); standalone .md files
  // like poetry entries have no images of their own.
  if (item.inputPath && /index\.md$/.test(item.inputPath)) {
    const entryDir = path.dirname(item.inputPath);
    if (fs.existsSync(entryDir)) {
      const files = fs
        .readdirSync(entryDir)
        .filter((f) => /\.(jpe?g|png|webp|gif|mp4)$/i.test(f))
        .sort();
      const productFile = files.find((f) => /^(product|cover)\./i.test(f));
      // Skip photos that are already embedded in the body so the end-of-post
      // gallery doesn't repeat them.
      const inline = inlineImageRefs(body);
      const photoFiles = files.filter((f) => !/^(product|cover)\./i.test(f) && !inline.has(f));
      item.data.images = item.data.images || {};
      if (productFile) item.data.images.product = productFile;
      if (photoFiles.length) item.data.images.photos = photoFiles;

      // Hero image for the top of the page: an explicit `hero:` frontmatter
      // value wins, otherwise use the first non-video photo.
      const originalUrl = item.url && !item.url.endsWith("/") ? item.url + "/" : item.url || "/";
      let hero = heroImageUrl(originalUrl, item.data.hero);
      if (/\.mp4$/i.test(hero)) hero = ""; // can't use a video as a background
      if (!hero) {
        const firstPhoto = photoFiles.find((f) => !/\.mp4$/i.test(f));
        if (firstPhoto) hero = originalUrl + firstPhoto;
      }
      if (hero) item.data.images.hero = hero;
    }
  }

  // Set fullTitle for page <title> tag
  item.data.fullTitle = postPageTitle(item.data);

  return item;
}