export function starsHtml(n) {
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

export function money(price) {
  return Number(price).toFixed(2);
}

// Format a YYYY-MM-DD date string as "Month D, YYYY" for poetry/art entries.
export function dateLabel(d) {
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

export function dataTags(tags) {
  return (tags || []).filter((t) => t !== "review" && t !== "book-review").join(" ");
}

export function stripExt(filename) {
  return filename.replace(/\.[^.]+$/, "");
}

export function stripLeadingNumber(filename) {
  return filename.replace(/^\d+\.\s*/, "");
}

export function sourceLabel(url) {
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

export function authorName(author) {
  return author === "erin" ? "Erin" : "Nathan";
}