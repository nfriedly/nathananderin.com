const path = require("path");
const fs = require("fs");
const { eleventyImageTransformPlugin } = require("@11ty/eleventy-img");
const aliExpressLinks = require("./lib/ali-express-links");
const favicons = require("./lib/favicons");

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

function starsHtml(n) {
  if (!n) return ""; // no stars field (or stars: 0) → render no star row at all
  let s = '<span class="stars" aria-label="' + n + ' out of 5 stars">';
  for (let i = 1; i <= 5; i++) {
    s += n >= i
      ? '<i class="fa-solid fa-star"></i>'
      : n >= i - 0.5
        ? '<i class="fa-solid fa-star-half-stroke"></i>'
        : '<i class="fa-regular fa-star"></i>';
  }
  return s + "</span>";
}

function thumbUrl(url) {
  if (!url) return "";
  const m = url.match(/^(.*\/)([^/]+)$/);
  if (!m) return url;
  const base = m[2].replace(/\.[^.]+$/, "");
  return m[1] + "thumbs/" + base + ".jpg";
}

// Resolve a review's `hero:` frontmatter value to an image URL. Bare values
// (a filename or sub-path) are relative to the review folder; absolute paths
// and http(s) URLs are used as-is.
function heroImageUrl(pageUrl, hero) {
  if (!hero) return "";
  hero = String(hero);
  if (/^(?:https?:)?\/\//i.test(hero) || hero.startsWith("/")) return hero;
  return (pageUrl || "/") + hero;
}

function money(price) {
  return Number(price).toFixed(2);
}

// Format a YYYY-MM-DD date string as "Month D, YYYY" for poetry/art entries.
function dateLabel(d) {
  if (!d) return "";
  const m = String(d).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return String(d);
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])).toLocaleDateString("en-US", {
    timeZone: "UTC",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function dataTags(tags) {
  return (tags || []).filter((t) => t !== "review" && t !== "book-review").join(" ");
}

function stripExt(filename) {
  return filename.replace(/\.[^.]+$/, "");
}

// Filenames referenced by inline images in a post body — both markdown
// `![alt](file)` and raw HTML `<img src>` — so the auto-gallery can skip
// images that are already shown in the body. Matches on the final path
// segment, so relative paths, sub-paths, angle-bracketed, and URL-encoded
// references all resolve to the same folder file.
function inlineImageRefs(body) {
  const refs = new Set();
  if (!body) return refs;
  const add = (raw) => {
    let s = String(raw || "").trim();
    s = s.replace(/^<+|>+$/g, "");
    s = s.replace(/^\.\.?\/+/, "");
    s = s.split(/[?#]/)[0];
    try {
      s = decodeURIComponent(s);
    } catch (_e) {
      // leave un-decoded, e.g. a malformed percent-encoding
    }
    s = path.basename(s).trim();
    if (s) refs.add(s);
  };
  String(body).replace(/!\[[^\]]*\]\(([^)]*)\)/g, (m, src) => {
    add(src);
    return m;
  });
  String(body).replace(/<img\b[^>]*?\bsrc\s*=\s*["']([^"']*)["']/gi, (m, src) => {
    add(src);
    return m;
  });
  return refs;
}

function stripLeadingNumber(filename) {
  return filename.replace(/^\d+\.\s*/, "");
}

function sourceLabel(url) {
  url = String(url).replace(/^https?:\/\//i, "").replace(/^www\./i, "");
  const host = url.split("/")[0].split(":")[0];
  const labels = {
    "amazon.com": "Amazon",
    "aliexpress.com": "Ali Express",
    "alibaba.com": "Ali Baba",
    "bhphotovideo.com": "B&H",
  };
  return labels[host] || host;
}

function authorName(author) {
  return author === "erin" ? "Erin" : "Nathan";
}

// Heading suffix for a product name: book-section items that don't already
// have "book" in the name get "Book Review"; everything else stays "Review"
// (so "One Golden Summer" -> "One Golden Summer Book Review", but "The Such
// and Such Cookbook" -> "The Such and Such Cookbook Review"). Section tag is
// "book-review" (added by src/book-reviews/book-reviews.json dir data).
function reviewSuffix(name, tags) {
  const isBook = Array.isArray(tags) && tags.includes("book-review");
  return isBook && !/book/i.test(name) ? " Book Review" : " Review";
}

function reviewH1Title(data) {
  if (data.title) return data.title;
  if (data.product?.name) return data.product.name + reviewSuffix(data.product.name, data.tags);
  return "Review";
}

function reviewH2Title(data) {
  if (data.subTitle) return data.subTitle;
  if (data.title && data.product?.name) {
    return data.product.name + reviewSuffix(data.product.name, data.tags);
  }
  return null;
}

function reviewPageTitle(data) {
  const parts = [];
  parts.push(reviewH1Title(data));
  const h2 = reviewH2Title(data);
  if (h2) parts.push(h2);
  return parts.join(" - ");
}

function isAmazonUrl(url) {
  if (typeof url !== "string") return false;
  try {
    return new URL(url).hostname.includes("amazon.");
  } catch (_e) {
    return false;
  }
}

function hasAmazonLinks(product, originalUrl) {
  if (product) {
    if (product.urls && product.urls.length) {
      return product.urls.some((l) => l.url && /amazon/i.test(l.url));
    }
    if (product.url) return /amazon/i.test(product.url);
  }
  if (originalUrl) return /amazon/i.test(String(originalUrl));
  return false;
}

function featuredReviews(posts, count) {
  return posts.filter((p) => p.data.featured).slice(0, count);
}

function recentReviews(posts, count) {
  return (posts || []).slice(0, count);
}

function countByAuthor(posts, author) {
  return posts.filter((p) => p.data.author === author).length;
}

function tagGroups(posts) {
  const tagCounts = {};
  for (const p of posts) {
    for (const t of p.data.tags || []) {
      if (t === "review" || t === "book-review") continue;
      tagCounts[t] = (tagCounts[t] || 0) + 1;
    }
  }
  const tagList = Object.keys(tagCounts).sort((a, b) => tagCounts[b] - tagCounts[a] || a.localeCompare(b));
  const toItems = (tags) => tags.map((name) => ({ name, count: tagCounts[name] }));
  return {
    topTags: toItems(tagList.filter((t) => tagCounts[t] >= 4)),
    moreTags: toItems(tagList.filter((t) => tagCounts[t] < 4)),
  };
}

// Find related reviews to show on a review page. Manually-specified URLs
// (frontmatter `relatedReviews:`) come first, in order; any remaining slots
// are auto-filled by weighted tag overlap — rarer tags score higher than
// common ones (e.g. "tech") using an IDF-style log weight. Returns at most
// `count` items; empty slots on the page are left empty if there aren't
// enough matches.
function relatedReviews(allReviews, pageTags, currentUrl, specifiedUrls, count) {
  const norm = (u) => {
    if (!u) return "";
    const s = String(u).trim().replace(/^https?:\/\/[^/]+/i, "");
    return s.replace(/\/+$/, "") + "/";
  };
  const isContentTag = (t) => t !== "review" && t !== "book-review";
  const currentTagList = (pageTags || []).filter(isContentTag);

  const related = [];
  const seen = new Set([norm(currentUrl)]);

  const specs = typeof specifiedUrls === "string" ? [specifiedUrls] : specifiedUrls;
  for (const u of specs || []) {
    const key = norm(u);
    const found = allReviews.find((p) => norm(p.url) === key);
    if (found && !seen.has(key)) {
      related.push(found);
      seen.add(key);
    }
  }

  const limit = count || 3;
  if (related.length < limit && currentTagList.length) {
    const totalDocs = allReviews.length;
    const tagCounts = {};
    for (const p of allReviews) {
      for (const t of p.data.tags || []) {
        if (isContentTag(t)) tagCounts[t] = (tagCounts[t] || 0) + 1;
      }
    }
    const weight = (t) => Math.log(1 + totalDocs / (1 + (tagCounts[t] || 0)));

    const scored = [];
    for (const p of allReviews) {
      if (seen.has(norm(p.url))) continue;
      let score = 0;
      for (const t of p.data.tags || []) {
        if (isContentTag(t) && currentTagList.includes(t)) score += weight(t);
      }
      if (score > 0) scored.push({ item: p, score });
    }
    scored.sort(
      (a, b) =>
        b.score - a.score ||
        String(b.item.inputPath).localeCompare(String(a.item.inputPath), undefined, { numeric: true })
    );
    for (const s of scored.slice(0, limit - related.length)) related.push(s.item);
  }

  return related;
}

function amazonSearchUrl(query) {
  return `https://www.amazon.com/s?k=${encodeURIComponent(query)}&tag=nathananderin-20`;
}

function amazonAffiliateUrl(url) {
  const urlObj = new URL(url);
  urlObj.searchParams.set("tag", "nathananderin-20");
  return urlObj.toString();
}

function isAliexpressItemUrl(url) {
  return aliExpressLinks.isAliexpressItemUrl(url);
}

// affiliateUrl core: Amazon URLs get the tag appended, AliExpress item URLs
// are swapped for a CSV tracking link when available, otherwise a search URL
// built from the product title (which may itself have a tracking link).
function applyAffiliateUrl(url, title) {
  if (typeof url !== "string") return url;
  try {
    if (isAliexpressItemUrl(url)) {
      return aliExpressLinks.resolveAliExpress(url, title).href;
    }
    if (new URL(url).hostname.includes("amazon.")) {
      return amazonAffiliateUrl(url);
    }
  } catch (_e) {
    // URL parsing failed, return original
  }
  return url;
}

function linkSite(url, site) {
  return site || sourceLabel(url) || "Amazon";
}

// Normalized list of buy buttons for the review-box: one entry per product
// url (or a search button for stale Amazon oldUrls). originalUrl is set when
// the button is a search fallback so the template can show the old link.
function buildBuyLinks(product) {
  if (!product) return [];
  const title = product.title || product.name || "";
  const links = [];

  const pushLink = (url, site, displayOriginal) => {
    if (!url) return;
    let href;
    let originalUrl;
    if (isAliexpressItemUrl(url)) {
      const resolved = aliExpressLinks.resolveAliExpress(url, title);
      href = resolved.href;
      if (resolved.kind === "search") originalUrl = url;
    } else {
      href = applyAffiliateUrl(url, title);
    }
    if (displayOriginal) originalUrl = displayOriginal;
    links.push({
      href,
      site: linkSite(url, site),
      favicon: favicons.faviconUrl(favicons.hostForUrl(url)),
      originalUrl: originalUrl || null,
    });
  };

  // Add product.urls or product.url links
  if (product.urls && product.urls.length) {
    for (const link of product.urls) {
      pushLink(link.url, link.site || product.site, null);
    }
  } else if (product.url) {
    pushLink(product.url, product.site, null);
  } else if (product.oldUrl && isAmazonUrl(product.oldUrl) && title) {
    pushLink(amazonSearchUrl(title), "Amazon", product.oldUrl);
  }

  // Add product.search links
  if (product.search && product.search.length) {
    for (const searchEntry of product.search) {
      if (typeof searchEntry === "string") {
        // Simple keyword: "amazon" or "aliexpress"
        if (searchEntry === "amazon") {
          pushLink(amazonSearchUrl(title), "Amazon", null);
        } else if (searchEntry === "aliexpress") {
          const searchUrl = aliExpressLinks.buildSearchUrl(title);
          if (searchUrl) pushLink(searchUrl, "AliExpress", null);
        }
        // Unknown keywords are ignored
      } else if (typeof searchEntry === "object" && searchEntry.url) {
        // Custom search URL with optional site override
        const site = searchEntry.site || sourceLabel(searchEntry.url);
        pushLink(searchEntry.url, site, null);
      }
    }
  }

  return links;
}

function reviewFaviconHosts() {
  const hosts = ["amazon.com", "aliexpress.com"];
  for (const data of aliExpressLinks.collectReviewData()) {
    const product = data && data.product;
    if (!product) continue;
    hosts.push(favicons.hostForUrl(product.url));
    hosts.push(favicons.hostForUrl(product.oldUrl));
    if (Array.isArray(product.urls)) {
      for (const link of product.urls) hosts.push(favicons.hostForUrl(link && link.url));
    }
  }
  return hosts;
}

module.exports = function (eleventyConfig) {
  const settings = {
    dir: {
      input: "src",
      output: "_site",
    },
    templateFormats: ["html", "md", "njk"],
  };

	eleventyConfig.addPlugin(eleventyImageTransformPlugin);

  // Poetry entries are written one line per break; enable markdown-it's
  // `breaks` option (single newline -> <br>, blank line still -> new <p>) for
  // files under src/poetry/ only, since the markdown library is shared.
  eleventyConfig.amendLibrary("md", function (mdLib) {
    mdLib.use(function breaksForPoetry(md) {
      const originalRender = md.render.bind(md);
      md.render = function (src, env) {
        const inputPath =
          (env && env.page && env.page.inputPath) ||
          (env && env.eleventy && env.eleventy.inputPath) ||
          "";
        if (!/\bsrc\/poetry\//.test(inputPath.replace(/\\/g, "/"))) {
          return originalRender(src, env);
        }
        const prevBreaks = md.options.breaks;
        md.options.breaks = true;
        try {
          return originalRender(src, env);
        } finally {
          md.options.breaks = prevBreaks;
        }
      };
    });
  });

  eleventyConfig.addLayoutAlias("main", "layouts/main.njk");
  eleventyConfig.addLayoutAlias("review", "layouts/review.njk");
  eleventyConfig.addLayoutAlias("entry", "layouts/entry.njk");

  eleventyConfig.addPassthroughCopy("src/CNAME");
  eleventyConfig.addPassthroughCopy("src/.nojekyll");
  eleventyConfig.addPassthroughCopy("src/*.jpg");
  eleventyConfig.addPassthroughCopy("src/styles");
  eleventyConfig.addPassthroughCopy("src/favicon.ico");
  eleventyConfig.addPassthroughCopy("src/**/*.jpg");
  eleventyConfig.addPassthroughCopy("src/**/*.png");
  eleventyConfig.addPassthroughCopy("src/**/*.jpeg");
  eleventyConfig.addPassthroughCopy("src/**/*.webp");
  eleventyConfig.addPassthroughCopy("src/**/*.mp4");
  eleventyConfig.addPassthroughCopy("src/scripts");

  eleventyConfig.addFilter("starsHtml", starsHtml);
  eleventyConfig.addFilter("thumbUrl", thumbUrl);
  eleventyConfig.addFilter("money", money);
  eleventyConfig.addFilter("dataTags", dataTags);
  eleventyConfig.addFilter("sourceLabel", sourceLabel);
  eleventyConfig.addFilter("stripExt", stripExt);
  eleventyConfig.addFilter("stripLeadingNumber", stripLeadingNumber);
  eleventyConfig.addFilter("dateLabel", dateLabel);
  eleventyConfig.addFilter("reviewH1Title", reviewH1Title);
  eleventyConfig.addFilter("reviewSuffix", reviewSuffix);
  eleventyConfig.addFilter("reviewH2Title", reviewH2Title);
  eleventyConfig.addFilter("reviewPageTitle", reviewPageTitle);
  eleventyConfig.addFilter("featuredReviews", featuredReviews);
  eleventyConfig.addFilter("recentReviews", recentReviews);
  eleventyConfig.addFilter("countByAuthor", countByAuthor);
  eleventyConfig.addFilter("tagGroups", tagGroups);
  eleventyConfig.addFilter("relatedReviews", relatedReviews);

  eleventyConfig.addGlobalData("authorName", () => authorName);
  eleventyConfig.addGlobalData("isAmazonUrl", () => isAmazonUrl);
  eleventyConfig.addGlobalData("hasAmazonLinks", () => hasAmazonLinks);

// newest first; folder names are date-prefixed (YYYY-MM-DD-...) so sorting
// by inputPath descending sorts by date, newest review first.
const byInputPathDesc = (a, b) => String(b.inputPath).localeCompare(String(a.inputPath), undefined, { numeric: true });

function mapReviewItem(item) {
  // Auto-build excerpt from the review body
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
    const reviewDir = path.dirname(item.inputPath);
    if (fs.existsSync(reviewDir)) {
      const files = fs
        .readdirSync(reviewDir)
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

      // Hero image for the top of the review page: an explicit `hero:`
      // frontmatter value wins, otherwise use the first non-video photo.
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
  item.data.fullTitle = reviewPageTitle(item.data);

  return item;
}

function addSplitReviewCollections(eleventyConfig, name, tag) {
  // the paging templates (src/<folder>/2.njk) inherit the folder's dir-data
  // tags and must not be treated as reviews
  const isPagingPage = (item) => /2\.njk$/.test(String(item.inputPath));
  const full = (collectionApi) => collectionApi
    .getFilteredByTag(tag)
    .filter((item) => !isPagingPage(item))
    .sort(byInputPathDesc)
    .map(mapReviewItem);
  eleventyConfig.addCollection(name, full);
  eleventyConfig.addCollection(name + "Start", (collectionApi) => full(collectionApi).slice(0, 10));
  eleventyConfig.addCollection(name + "End", (collectionApi) => full(collectionApi).slice(10));
}

addSplitReviewCollections(eleventyConfig, "reviews", "review");
addSplitReviewCollections(eleventyConfig, "bookReviews", "book-review");
addSplitReviewCollections(eleventyConfig, "poetry", "poetry");
addSplitReviewCollections(eleventyConfig, "art", "art");

// Merged newest-first feed/homepage collection of product + book reviews
eleventyConfig.addCollection("allReviews", function (collectionApi) {
  return collectionApi
    .getFilteredByTag("review")
    .concat(collectionApi.getFilteredByTag("book-review"))
    .sort(byInputPathDesc)
    .map(mapReviewItem);
});

// Everything in one newest-first collection for feed.xml: reviews, books,
// poetry, and art.
eleventyConfig.addCollection("allPosts", function (collectionApi) {
  return collectionApi
    .getFilteredByTag("review")
    .concat(collectionApi.getFilteredByTag("book-review"))
    .concat(collectionApi.getFilteredByTag("poetry"))
    .concat(collectionApi.getFilteredByTag("art"))
    .sort(byInputPathDesc)
    .map(mapReviewItem);
});

  eleventyConfig.addGlobalData("amazonSearchUrl", () => amazonSearchUrl);

  eleventyConfig.addGlobalData("affiliateUrl", () => {
    return (url, title) => applyAffiliateUrl(url, title);
  });

  eleventyConfig.addGlobalData("buyLinks", () => {
    return (product) => buildBuyLinks(product);
  });

  eleventyConfig.addShortcode("siteUrl", () => "https://www.nathananderin.com");

  eleventyConfig.addShortcode("buildDate", () => new Date().toUTCString());

  // Append any AliExpress product/search links we still don't have tracking
  // links for to data/ali_express_links.csv (idempotent), and make sure a
  // local favicon exists for every site referenced by a review.
  eleventyConfig.on("eleventy.before", async () => {
    aliExpressLinks.updateUploadCsv();
    await favicons.ensureFavicons(reviewFaviconHosts());
  });

  return settings;
};