import { makePreview } from "./posts.mjs";

// newest first; folder names are date-prefixed (YYYY-MM-DD-...) so sorting
// by inputPath descending sorts by date, newest review first.
export const byInputPathDesc = (a, b) =>
  String(b.inputPath).localeCompare(String(a.inputPath), undefined, { numeric: true });

export function featuredPosts(posts, count) {
  return posts.filter((p) => p.data.featured).slice(0, count);
}

export function recentPosts(posts, count) {
  return (posts || []).slice(0, count);
}

export function countByAuthor(posts, author) {
  return posts.filter((p) => p.data.author === author).length;
}

export function tagGroups(posts) {
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

export function addSplitCollections(eleventyConfig, name, tag) {
  // the paging templates (src/<folder>/2.njk) inherit the folder's dir-data
  // tags and must not be treated as posts
  const isPagingPage = (item) => /2\.njk$/.test(String(item.inputPath));
  const full = (collectionApi) => collectionApi
    .getFilteredByTag(tag)
    .filter((item) => !isPagingPage(item))
    .sort(byInputPathDesc)
    .map(makePreview);
  eleventyConfig.addCollection(name, full);
  eleventyConfig.addCollection(name + "Start", (collectionApi) => full(collectionApi).slice(0, 10));
  eleventyConfig.addCollection(name + "End", (collectionApi) => full(collectionApi).slice(10));
}

// Merged newest-first feed/homepage collection of product + book reviews
export function buildAllReviews(collectionApi) {
  return collectionApi
    .getFilteredByTag("review")
    .concat(collectionApi.getFilteredByTag("book-review"))
    .sort(byInputPathDesc)
    .map(makePreview);
}

// Everything in one newest-first collection for feed.xml: reviews, books,
// poetry, and art.
export function buildAllPosts(collectionApi) {
  return collectionApi
    .getFilteredByTag("review")
    .concat(collectionApi.getFilteredByTag("book-review"))
    .concat(collectionApi.getFilteredByTag("poetry"))
    .concat(collectionApi.getFilteredByTag("art"))
    .sort(byInputPathDesc)
    .map(makePreview);
}