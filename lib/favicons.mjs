import fs from "fs";
import path from "path";

const FAVICON_DIR = path.join(import.meta.dirname, "..", "src", "images", "favicons");
const GOOGLE_FAVICON = "https://www.google.com/s2/favicons";

const cache = {};

function localFile(host) {
  return path.join(FAVICON_DIR, host + ".png");
}

function publicUrl(host) {
  return "/images/favicons/" + host + ".png";
}

function googleUrl(host, sz) {
  return GOOGLE_FAVICON + "?sz=" + sz + "&domain=" + encodeURIComponent(host);
}

function hostForUrl(url) {
  if (typeof url !== "string") return null;
  try {
    return new URL(url).hostname.replace(/^www\./i, "");
  } catch (_e) {
    return null;
  }
}

async function downloadFavicon(host) {
  const res = await fetch(googleUrl(host, 64));
  if (!res.ok) throw new Error("favicon fetch failed: " + res.status);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.mkdirSync(FAVICON_DIR, { recursive: true });
  fs.writeFileSync(localFile(host), buf);
  cache[host] = publicUrl(host);
}

async function ensureFavicons(hosts) {
  const seen = new Set();
  for (const host of hosts) {
    if (!host || seen.has(host)) continue;
    seen.add(host);
    if (fs.existsSync(localFile(host))) {
      cache[host] = publicUrl(host);
      continue;
    }
    try {
      await downloadFavicon(host);
    } catch (_e) {
      cache[host] = googleUrl(host, 32);
    }
  }
}

function faviconUrl(host) {
  if (!host) return null;
  if (cache[host]) return cache[host];
  if (fs.existsSync(localFile(host))) return publicUrl(host);
  return googleUrl(host, 32);
}

export {
  hostForUrl,
  ensureFavicons,
  faviconUrl,
};