const path = require("path");
const fs = require("fs");
const { default: eleventyImage } = require("@11ty/eleventy-img");
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

function money(price) {
  return Number(price).toFixed(2);
}

function dataTags(tags) {
  return (tags || []).filter((t) => t !== "review").join(" ");
}

function stripExt(filename) {
  return filename.replace(/\.[^.]+$/, "");
}

function stripLeadingNumber(filename) {
  return filename.replace(/^\d+\.\s*/, "");
}

function sourceLabel(url) {
  url = String(url).replace(/^https?:\/\//i, "").replace(/^www\./i, "");
  const host = url.split("/")[0].split(":")[0];
  const labels = {
    "amazon.com": "Amazon", "amazon.ca": "Amazon", "amazon.co.uk": "Amazon", "amazon.de": "Amazon", "amazon.fr": "Amazon",
    "aliexpress.com": "Ali Express", "alibaba.com": "Ali Baba",
  };
  return labels[host] || host;
}

function authorName(author) {
  return author === "erin" ? "Erin" : "Nathan";
}

function reviewH1Title(data) {
  if (data.title) return data.title;
  if (data.product?.name) return data.product.name + " Review";
  return "Review";
}

function reviewH2Title(data) {
  if (data.title && data.product?.name) {
    return data.product.name + " Review";
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

function hasAmazonLinks(product, reviewUrl) {
  if (product) {
    if (product.urls && product.urls.length) {
      return product.urls.some((l) => l.url && /amazon/i.test(l.url));
    }
    if (product.url) return /amazon/i.test(product.url);
  }
  if (reviewUrl) return /amazon/i.test(String(reviewUrl));
  return false;
}

function featuredReviews(posts, count) {
  return posts.filter((p) => p.data.featured).slice(0, count);
}

function countByAuthor(posts, author) {
  return posts.filter((p) => p.data.author === author).length;
}

function tagGroups(posts) {
  const tagCounts = {};
  for (const p of posts) {
    for (const t of p.data.tags || []) {
      if (t === "review") continue;
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

  eleventyConfig.addLayoutAlias("main", "layouts/main.njk");
  eleventyConfig.addLayoutAlias("review", "layouts/review.njk");

  eleventyConfig.addPassthroughCopy("src/CNAME");
  eleventyConfig.addPassthroughCopy("src/.nojekyll");
  eleventyConfig.addPassthroughCopy("src/*.jpg");
  eleventyConfig.addPassthroughCopy("src/styles");
  eleventyConfig.addPassthroughCopy("src/**/*.jpg");
  eleventyConfig.addPassthroughCopy("src/**/*.png");
  eleventyConfig.addPassthroughCopy("src/**/*.jpeg");
  eleventyConfig.addPassthroughCopy("src/**/*.webp");
  eleventyConfig.addPassthroughCopy("src/**/*.mp4");

  eleventyConfig.addFilter("starsHtml", starsHtml);
  eleventyConfig.addFilter("thumbUrl", thumbUrl);
  eleventyConfig.addFilter("money", money);
  eleventyConfig.addFilter("dataTags", dataTags);
  eleventyConfig.addFilter("sourceLabel", sourceLabel);
  eleventyConfig.addFilter("stripExt", stripExt);
  eleventyConfig.addFilter("stripLeadingNumber", stripLeadingNumber);
  eleventyConfig.addFilter("reviewH1Title", reviewH1Title);
  eleventyConfig.addFilter("reviewH2Title", reviewH2Title);
  eleventyConfig.addFilter("reviewPageTitle", reviewPageTitle);
  eleventyConfig.addFilter("featuredReviews", featuredReviews);
  eleventyConfig.addFilter("countByAuthor", countByAuthor);
  eleventyConfig.addFilter("tagGroups", tagGroups);

  eleventyConfig.addGlobalData("authorName", () => authorName);
  eleventyConfig.addGlobalData("isAmazonUrl", () => isAmazonUrl);
  eleventyConfig.addGlobalData("hasAmazonLinks", () => hasAmazonLinks);

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

        // Auto-populate images from filesystem
        if (item.inputPath && /\.(md)$/.test(item.inputPath)) {
          const reviewDir = path.dirname(item.inputPath);
          if (fs.existsSync(reviewDir)) {
            const files = fs
              .readdirSync(reviewDir)
              .filter((f) => /\.(jpe?g|png|webp|gif|mp4)$/i.test(f))
              .sort();
            const productFile = files.find((f) => /^(product|cover)\./i.test(f));
            const photoFiles = files.filter((f) => !/^(product|cover)\./i.test(f));
            item.data.images = item.data.images || {};
            if (productFile) item.data.images.product = productFile;
            if (photoFiles.length) item.data.images.photos = photoFiles;
          }
        }

        // Set fullTitle for page <title> tag
        item.data.fullTitle = reviewPageTitle(item.data);

        return item;
      });
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