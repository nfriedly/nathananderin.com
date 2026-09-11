const fs = require("fs");
const path = require("path");
const grayMatter = require("gray-matter");

const CSV_PATH = path.join(__dirname, "..", "data", "ali_express_links.csv");
const UPLOAD_PATH = path.join(__dirname, "..", "data", "links-to-upload.csv");
const REVIEWS_DIR = path.join(__dirname, "..", "src", "reviews");
const HEADER = ["Original URL", "Tracking ID", "Tracking URL", "Error Notes"];

let cachedMap = null;

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\r") {
      if (text[i + 1] === "\n") continue;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function csvEscape(value) {
  if (value == null) value = "";
  value = String(value);
  return /[",\r\n]/.test(value) ? '"' + value.replace(/"/g, '""') + '"' : value;
}

function serializeCsv(rows) {
  return rows.map((r) => r.map(csvEscape).join(",")).join("\n") + "\n";
}

function loadMap() {
  if (cachedMap) return cachedMap;
  cachedMap = new Map();
  if (fs.existsSync(CSV_PATH)) {
    const rows = parseCsv(fs.readFileSync(CSV_PATH, "utf8"));
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      if (!r[0]) continue;
      cachedMap.set(r[0], {
        trackingId: r[1] || "",
        trackingUrl: r[2] || "",
        errorNotes: r[3] || "",
      });
    }
  }
  return cachedMap;
}

function isAliexpressItemUrl(url) {
  if (typeof url !== "string") return false;
  try {
    const parsed = new URL(url);
    return (
      parsed.hostname.replace(/^www\./i, "") === "aliexpress.com" &&
      /^\/item\//.test(parsed.pathname)
    );
  } catch (_e) {
    return false;
  }
}

function buildSearchUrl(title) {
  const slug = String(title || "")
    .trim()
    .replace(/[^A-Za-z0-9-.\s]/g, "")
    .replace(/\s+/g, "-");
  if (!slug) return null;
  return "https://www.aliexpress.com/w/wholesale-" + slug + ".html";
}

function resolveAliExpress(url, title) {
  const map = loadMap();
  const row = map.get(url);
  if (row && row.trackingUrl) {
    return { href: row.trackingUrl, kind: "buy", originalUrl: null };
  }
  const search = title ? buildSearchUrl(title) : null;
  if (!search) return { href: url, kind: "buy", originalUrl: null };
  const searchRow = map.get(search);
  if (searchRow && searchRow.trackingUrl) {
    return { href: searchRow.trackingUrl, kind: "search", originalUrl: url };
  }
  return { href: search, kind: "search", originalUrl: url };
}

function collectReviewFiles() {
  if (!fs.existsSync(REVIEWS_DIR)) return [];
  const out = [];
  for (const entry of fs.readdirSync(REVIEWS_DIR)) {
    const dir = path.join(REVIEWS_DIR, entry);
    if (!fs.statSync(dir).isDirectory()) continue;
    const index = path.join(dir, "index.md");
    if (fs.existsSync(index)) {
      out.push(index);
      continue;
    }
    for (const f of fs.readdirSync(dir)) {
      if (/\.md$/i.test(f)) out.push(path.join(dir, f));
    }
  }
  return out;
}

function productUrls(product) {
  const urls = [];
  if (product.url) urls.push(product.url);
  if (Array.isArray(product.urls)) {
    for (const l of product.urls) if (l && l.url) urls.push(l.url);
  }
  return urls;
}

function collectReviewData() {
  const out = [];
  for (const file of collectReviewFiles()) {
    const data = grayMatter(fs.readFileSync(file, "utf8")).data;
    if (data) out.push(data);
  }
  return out;
}

function updateCsv() {
  loadMap();
  let rows;
  if (fs.existsSync(CSV_PATH)) {
    let text = fs.readFileSync(CSV_PATH, "utf8");
    text = text.replace(/^\ufeff/, "");
    rows = text.trim() ? parseCsv(text) : [];
  } else {
    rows = [];
  }
  if (rows.length && rows[0].length && rows[0][0] === HEADER[0]) {
    rows[0] = HEADER.slice();
  } else {
    rows.unshift(HEADER.slice());
  }
  const known = new Set(rows.slice(1).map((r) => r[0]).filter(Boolean));

  const toAdd = [];
  for (const data of collectReviewData()) {
    const product = data && data.product;
    if (!product) continue;
    const title = product.title || product.name;
    for (const url of productUrls(product)) {
      if (!isAliexpressItemUrl(url)) continue;
      if (!known.has(url)) {
        toAdd.push(url);
        known.add(url);
      }
      const row = cachedMap.get(url);
      if (!(row && row.trackingUrl) && title) {
        const search = buildSearchUrl(title);
        if (search && !known.has(search)) {
          toAdd.push(search);
          known.add(search);
        }
      }
    }
  }

  if (toAdd.length) {
    for (const url of toAdd) rows.push([url, "", "", ""]);
    fs.mkdirSync(path.dirname(CSV_PATH), { recursive: true });
    fs.writeFileSync(CSV_PATH, serializeCsv(rows));
    cachedMap = null;
    loadMap();
  }
  return toAdd;
}

function mainCsvUrls() {
  const out = [];
  if (fs.existsSync(CSV_PATH)) {
    let text = fs.readFileSync(CSV_PATH, "utf8").replace(/^\ufeff/, "");
    if (text.trim()) {
      for (const r of parseCsv(text)) {
        if (r[0] && r[0] !== HEADER[0]) out.push(r[0]);
      }
    }
  }
  return out;
}

// The AliExpress tool only accepts a bare, single-column list (header "URL"
// then one link per line, no quoting). When any link still needs a tracking
// URL, build that file seeded with every url already in the main CSV so the
// result we get back covers all links, then keep appending the ones we
// haven't listed yet. This file is gitignored; it only matters at upload time.
function updateUploadCsv() {
  updateCsv();
  const map = loadMap();
  const allUrls = mainCsvUrls();
  const hasPending = allUrls.some((u) => {
    const row = map.get(u);
    return !row || !row.trackingUrl;
  });
  if (!hasPending) return;

  const exists = fs.existsSync(UPLOAD_PATH);
  let lines;
  if (exists) {
    lines = fs
      .readFileSync(UPLOAD_PATH, "utf8")
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines[0] !== "URL") lines.unshift("URL");
  } else {
    lines = ["URL"].concat(allUrls);
  }

  const seen = new Set(lines);
  let toAdd = 0;
  for (const url of allUrls) {
    const row = map.get(url);
    if (row && row.trackingUrl) continue;
    if (!seen.has(url)) {
      lines.push(url);
      seen.add(url);
      toAdd++;
    }
  }

  if (!exists || toAdd) {
    fs.mkdirSync(path.dirname(UPLOAD_PATH), { recursive: true });
    fs.writeFileSync(UPLOAD_PATH, lines.join("\n") + "\n");
  }
}

module.exports = {
  isAliexpressItemUrl,
  buildSearchUrl,
  resolveAliExpress,
  collectReviewData,
  updateCsv,
  updateUploadCsv,
};