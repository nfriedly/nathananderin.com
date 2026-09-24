import * as aliExpressLinks from "./ali-express-links.mjs";
import * as favicons from "./favicons.mjs";
import { sourceLabel } from "./format.mjs";

export function isAmazonUrl(url) {
  if (typeof url !== "string") return false;
  try {
    return new URL(url).hostname.includes("amazon.");
  } catch (_e) {
    return false;
  }
}

export function hasAmazonLinks(product, originalUrl) {
  if (product) {
    if (product.urls && product.urls.length) {
      return product.urls.some((l) => l.url && /amazon/i.test(l.url));
    }
    if (product.url) return /amazon/i.test(product.url);
  }
  if (originalUrl) return /amazon/i.test(String(originalUrl));
  return false;
}

export function amazonSearchUrl(query) {
  return `https://www.amazon.com/s?k=${encodeURIComponent(query)}&tag=nathananderin-20`;
}

export function amazonAffiliateUrl(url) {
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
export function applyAffiliateUrl(url, title) {
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
export function buildBuyLinks(product) {
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

export function reviewFaviconHosts() {
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