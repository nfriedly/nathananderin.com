import { eleventyImageTransformPlugin } from "@11ty/eleventy-img";
import * as aliExpressLinks from "./lib/ali-express-links.mjs";
import * as favicons from "./lib/favicons.mjs";
import { dateLabel, dataTags, authorName, money, sourceLabel, starsHtml, stripExt, stripLeadingNumber } from "./lib/format.mjs";
import { postPageTitle, postSubtitle, postSuffix, postTitle, relatedReviews } from "./lib/reviews.mjs";
import { addSplitCollections, buildAllPosts, buildAllReviews, countByAuthor, featuredPosts, recentPosts, tagGroups } from "./lib/collections.mjs";
import { amazonSearchUrl, applyAffiliateUrl, buildBuyLinks, hasAmazonLinks, isAmazonUrl, reviewFaviconHosts } from "./lib/affiliates.mjs";
import { srcResized } from "./lib/images.mjs";

export default function (eleventyConfig) {
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

  eleventyConfig.addShortcode("srcResized", srcResized);
  eleventyConfig.addShortcode("siteUrl", () => "https://www.nathananderin.com");
  eleventyConfig.addShortcode("buildDate", () => new Date().toUTCString());

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
  eleventyConfig.addFilter("money", money);
  eleventyConfig.addFilter("dataTags", dataTags);
  eleventyConfig.addFilter("sourceLabel", sourceLabel);
  eleventyConfig.addFilter("stripExt", stripExt);
  eleventyConfig.addFilter("stripLeadingNumber", stripLeadingNumber);
  eleventyConfig.addFilter("dateLabel", dateLabel);
  eleventyConfig.addFilter("postTitle", postTitle);
  eleventyConfig.addFilter("postSuffix", postSuffix);
  eleventyConfig.addFilter("postSubtitle", postSubtitle);
  eleventyConfig.addFilter("postPageTitle", postPageTitle);
  eleventyConfig.addFilter("featuredPosts", featuredPosts);
  eleventyConfig.addFilter("recentPosts", recentPosts);
  eleventyConfig.addFilter("countByAuthor", countByAuthor);
  eleventyConfig.addFilter("tagGroups", tagGroups);
  eleventyConfig.addFilter("relatedReviews", relatedReviews);

  eleventyConfig.addGlobalData("authorName", () => authorName);
  eleventyConfig.addGlobalData("isAmazonUrl", () => isAmazonUrl);
  eleventyConfig.addGlobalData("hasAmazonLinks", () => hasAmazonLinks);
  eleventyConfig.addGlobalData("amazonSearchUrl", () => amazonSearchUrl);

  eleventyConfig.addGlobalData("affiliateUrl", () => {
    return (url, title) => applyAffiliateUrl(url, title);
  });

  eleventyConfig.addGlobalData("buyLinks", () => {
    return (product) => buildBuyLinks(product);
  });

  addSplitCollections(eleventyConfig, "reviews", "review");
  addSplitCollections(eleventyConfig, "bookReviews", "book-review");
  addSplitCollections(eleventyConfig, "poetry", "poetry");
  addSplitCollections(eleventyConfig, "art", "art");

  eleventyConfig.addCollection("allReviews", buildAllReviews);
  eleventyConfig.addCollection("allPosts", buildAllPosts);

  // Append any AliExpress product/search links we still don't have tracking
  // links for to data/ali_express_links.csv (idempotent), and make sure a
  // local favicon exists for every site referenced by a review.
  eleventyConfig.on("eleventy.before", async () => {
    aliExpressLinks.updateUploadCsv();
    await favicons.ensureFavicons(reviewFaviconHosts());
  });

  return settings;
};