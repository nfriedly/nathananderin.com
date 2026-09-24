import path from "path";

export function splitFrontmatter(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(text);
  return m ? { head: m[1], body: m[2] } : null;
}

export function makeExcerpt(body) {
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

// Resolve a post's `hero:` frontmatter value to an image URL. Bare values
// (a filename or sub-path) are relative to the post folder; absolute paths
// and http(s) URLs are used as-is.
export function heroImageUrl(pageUrl, hero) {
  if (!hero) return "";
  hero = String(hero);
  if (/^(?:https?:)?\/\//i.test(hero) || hero.startsWith("/")) return hero;
  return (pageUrl || "/") + hero;
}

// Filenames referenced by inline images in a post body — both markdown
// `![alt](file)` and raw HTML `<img src>` — so the auto-gallery can skip
// images that are already shown in the body. Matches on the final path
// segment, so relative paths, sub-paths, angle-bracketed, and URL-encoded
// references all resolve to the same folder file.
export function inlineImageRefs(body) {
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

// Heading suffix for a product name: book-section items that don't already
// have "book" in the name get "Book Review"; everything else stays "Review"
// (so "One Golden Summer" -> "One Golden Summer Book Review", but "The Such
// and Such Cookbook" -> "The Such and Such Cookbook Review"). Section tag is
// "book-review" (added by src/book-reviews/book-reviews.json dir data).
export function postSuffix(name, tags) {
  const isBook = Array.isArray(tags) && tags.includes("book-review");
  return isBook && !/book/i.test(name) ? " Book Review" : " Review";
}

export function postTitle(data) {
  if (data.title) return data.title;
  if (data.product?.name) return data.product.name + postSuffix(data.product.name, data.tags);
  return "Review";
}

export function postSubtitle(data) {
  if (data.subTitle) return data.subTitle;
  if (data.title && data.product?.name) {
    return data.product.name + postSuffix(data.product.name, data.tags);
  }
  return null;
}

export function postPageTitle(data) {
  const parts = [];
  parts.push(postTitle(data));
  const subtitle = postSubtitle(data);
  if (subtitle) parts.push(subtitle);
  return parts.join(" - ");
}

// Find related reviews to show on a review page. Manually-specified URLs
// (frontmatter `relatedReviews:`) come first, in order; any remaining slots
// are auto-filled by weighted tag overlap — rarer tags score higher than
// common ones (e.g. "tech") using an IDF-style log weight. Returns at most
// `count` items; empty slots on the page are left empty if there aren't
// enough matches.
export function relatedReviews(allReviews, pageTags, currentUrl, specifiedUrls, count) {
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