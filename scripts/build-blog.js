const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const { syncAll } = require("./sync-blog-dates");

const SOURCE_DIR = path.join(process.cwd(), "blog-content");
const OUTPUT_DIR = path.join(process.cwd(), "static-build", "blog");

/**
 * Strict mode: pass --strict on the command line, or set BLOG_STRICT=1 in the
 * environment (e.g. in CI).  When enabled, any blog post that lacks git history
 * (and therefore has an unreliable datePublished) causes the build to exit with
 * a non-zero code instead of just printing a warning.
 *
 * Usage:
 *   node scripts/build-blog.js --strict
 *   BLOG_STRICT=1 node scripts/build-blog.js
 */
const STRICT_MODE =
  process.argv.includes("--strict") || process.env.BLOG_STRICT === "1";

/**
 * Returns the date of the very first git commit for a file (YYYY-MM-DD),
 * or null if git history is unavailable or the file has no commits yet.
 */
function getFirstCommitDate(filePath) {
  try {
    const rel = path.relative(process.cwd(), filePath);
    const out = execSync(`git log --format="%ci" --follow -- "${rel}"`, {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
    if (!out) return null;
    const firstLine = out.split("\n").pop().trim();
    return firstLine ? firstLine.slice(0, 10) : null;
  } catch {
    return null;
  }
}

/**
 * Extracts the datePublished value from any existing JSON-LD Article block in
 * the HTML string, or returns null if none is found.
 */
function getExistingDatePublished(html) {
  const m = html.match(/"datePublished"\s*:\s*"(\d{4}-\d{2}-\d{2})"/);
  return m ? m[1] : null;
}

function extractMetaFromBody(html) {
  const extracted = { metaTitle: null, description: null, slug: null };

  const titleMatch = html.match(/<p>Meta title:\s*(.+?)<\/p>/i);
  if (titleMatch) extracted.metaTitle = titleMatch[1].trim();

  const descMatch = html.match(/<p>Meta description:\s*(.+?)<\/p>/i);
  if (descMatch) extracted.description = descMatch[1].trim();

  const slugMatch = html.match(/<p>Suggested slug:\s*(.+?)<\/p>/i);
  if (slugMatch) extracted.slug = slugMatch[1].trim().replace(/^\//, "");

  let cleaned = html
    .replace(/<p>Meta title:\s*.+?<\/p>\n?/gi, "")
    .replace(/<p>Meta description:\s*.+?<\/p>\n?/gi, "")
    .replace(/<p>Suggested slug:\s*.+?<\/p>\n?/gi, "");

  return { extracted, cleaned };
}

function getHeadValue(html, tag) {
  if (tag === "title") {
    const m = html.match(/<title>([^<]*)<\/title>/i);
    return m ? m[1].trim() : null;
  }
  if (tag === "description") {
    const m = html.match(/<meta\s+name="description"\s+content="([^"]*)"/i);
    return m ? m[1].trim() : null;
  }
  if (tag === "canonical") {
    const m = html.match(/<link\s+rel="canonical"\s+href="([^"]*)"/i);
    return m ? m[1].trim() : null;
  }
  return null;
}

function updateHead(html, metaTitle, description, canonicalHref) {
  if (metaTitle) {
    if (/<title>[^<]*<\/title>/i.test(html)) {
      html = html.replace(/<title>[^<]*<\/title>/i, `<title>${metaTitle}</title>`);
    } else {
      html = html.replace("</head>", `  <title>${metaTitle}</title>\n</head>`);
    }
  }

  if (description) {
    if (/<meta\s+name="description"\s+content="[^"]*"/i.test(html)) {
      html = html.replace(
        /<meta\s+name="description"\s+content="[^"]*"/i,
        `<meta name="description" content="${description}"`
      );
    } else {
      html = html.replace("</head>", `  <meta name="description" content="${description}" />\n</head>`);
    }
  }

  if (canonicalHref) {
    const fullCanonical = canonicalHref.startsWith("http")
      ? canonicalHref
      : `https://pulsekegel.com/${canonicalHref}`;

    if (/<link\s+rel="canonical"/i.test(html)) {
      html = html.replace(
        /<link\s+rel="canonical"\s+href="[^"]*"/i,
        `<link rel="canonical" href="${fullCanonical}"`
      );
    } else {
      html = html.replace("</head>", `  <link rel="canonical" href="${fullCanonical}" />\n</head>`);
    }
  }

  return html;
}

function ensureOgTags(html, title, description, url) {
  if (html.includes('property="og:title"')) {
    return html;
  }

  const ogTags = `  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="${description}" />
  <meta property="og:url" content="${url}" />
  <meta property="og:type" content="article" />
  <meta property="og:image" content="https://pulsekegel.com/favicon.png" />`;

  return html.replace("</head>", `${ogTags}\n</head>`);
}

function ensureBreadcrumbSchema(html, postTitle, slug) {
  if (html.includes('"BreadcrumbList"')) {
    return html;
  }

  const url = `https://pulsekegel.com/blog/${slug}`;
  const schema = `  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://pulsekegel.com" },
      { "@type": "ListItem", "position": 2, "name": "Blog", "item": "https://pulsekegel.com/blog" },
      { "@type": "ListItem", "position": 3, "name": ${JSON.stringify(postTitle)}, "item": ${JSON.stringify(url)} }
    ]
  }
  </script>`;

  return html.replace("</head>", `${schema}\n</head>`);
}

function ensureArticleSchema(html, headline, description, slug, datePublished) {
  if (html.includes('"@type": "Article"') || html.includes('"@type":"Article"')) {
    return html;
  }

  const url = `https://pulsekegel.com/blog/${slug}`;
  const schema = `  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": ${JSON.stringify(headline)},
    "description": ${JSON.stringify(description)},
    "datePublished": ${JSON.stringify(datePublished)},
    "dateModified": ${JSON.stringify(datePublished)},
    "author": { "@type": "Organization", "name": "PulseKegel", "url": "https://pulsekegel.com" },
    "publisher": { "@type": "Organization", "name": "PulseKegel", "url": "https://pulsekegel.com" },
    "url": ${JSON.stringify(url)},
    "mainEntityOfPage": { "@type": "WebPage", "@id": ${JSON.stringify(url)} }
  }
  </script>`;

  return html.replace("</head>", `${schema}\n</head>`);
}

function getH1(html) {
  const m = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
  return m ? m[1].trim() : null;
}

const BRAND_HEAD_INJECT = `  <link rel="icon" type="image/png" href="/favicon.png" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;500;600;700;900&family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet" />`;

const BRAND_STYLE = `  <style>
    *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
    html { scroll-behavior: smooth; }
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      background: linear-gradient(135deg, #0a0a1a 0%, #1a1a2e 25%, #16213e 50%, #0f0f23 75%, #0a0a1a 100%);
      color: rgba(255, 255, 255, 0.88);
      min-height: 100vh;
      overflow-x: hidden;
      line-height: 1.7;
      font-size: 1rem;
    }

    /* HEADER */
    .pk-header {
      padding: 20px 24px;
      border-bottom: 1px solid rgba(0, 255, 136, 0.15);
      display: flex;
      align-items: center;
      gap: 16px;
      position: sticky;
      top: 0;
      background: rgba(10, 10, 26, 0.85);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      z-index: 100;
    }
    .pk-logo {
      font-family: 'Orbitron', sans-serif;
      font-size: 1.25rem;
      font-weight: 700;
      background: linear-gradient(90deg, #00FF88, #00FFFF);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      text-decoration: none;
      flex-shrink: 0;
    }
    .pk-breadcrumb-sep {
      color: rgba(255, 255, 255, 0.3);
      font-size: 0.9rem;
    }
    .pk-breadcrumb-link {
      font-size: 0.875rem;
      color: rgba(255, 255, 255, 0.55);
      text-decoration: none;
      transition: color 0.2s;
    }
    .pk-breadcrumb-link:hover { color: #00FFFF; }
    .pk-header-rule {
      height: 2px;
      background: linear-gradient(90deg, #00FF88, #00FFFF, transparent);
    }

    /* ARTICLE LAYOUT */
    .pk-article {
      max-width: 720px;
      margin: 0 auto;
      padding: 48px 24px 64px;
    }

    .pk-article h1 {
      font-family: 'Orbitron', sans-serif;
      font-size: clamp(1.5rem, 4vw, 2.25rem);
      font-weight: 700;
      line-height: 1.25;
      margin-bottom: 32px;
      background: linear-gradient(135deg, #ffffff 0%, #00FFFF 60%, #00FF88 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    .pk-article h2 {
      font-family: 'Orbitron', sans-serif;
      font-size: clamp(1.1rem, 2.5vw, 1.4rem);
      font-weight: 600;
      color: #00FF88;
      margin-top: 48px;
      margin-bottom: 16px;
      line-height: 1.35;
    }

    .pk-article h3 {
      font-family: 'Orbitron', sans-serif;
      font-size: 1rem;
      font-weight: 600;
      color: #00FFFF;
      margin-top: 32px;
      margin-bottom: 12px;
      line-height: 1.4;
    }

    .pk-article p {
      margin-bottom: 18px;
      color: rgba(255, 255, 255, 0.82);
    }

    .pk-article a {
      color: #00FFFF;
      text-decoration: underline;
      text-decoration-color: rgba(0, 255, 255, 0.35);
      transition: color 0.2s, text-decoration-color 0.2s;
    }
    .pk-article a:hover {
      color: #00FF88;
      text-decoration-color: rgba(0, 255, 136, 0.5);
    }

    .pk-article ul, .pk-article ol {
      margin: 0 0 20px 0;
      padding-left: 0;
      list-style: none;
    }
    .pk-article ul li, .pk-article ol li {
      position: relative;
      padding: 6px 0 6px 22px;
      color: rgba(255, 255, 255, 0.8);
      border-bottom: 1px solid rgba(255, 255, 255, 0.04);
    }
    .pk-article ul li:last-child, .pk-article ol li:last-child {
      border-bottom: none;
    }
    .pk-article ul li::before {
      content: '';
      position: absolute;
      left: 0;
      top: 50%;
      transform: translateY(-50%);
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: #00FF88;
      box-shadow: 0 0 6px rgba(0, 255, 136, 0.5);
    }
    .pk-article ol {
      counter-reset: ol-counter;
    }
    .pk-article ol li {
      counter-increment: ol-counter;
    }
    .pk-article ol li::before {
      content: counter(ol-counter) ".";
      position: absolute;
      left: 0;
      color: #00FF88;
      font-weight: 600;
      font-size: 0.875rem;
    }

    .pk-article blockquote {
      margin: 24px 0;
      padding: 20px 24px;
      border-left: 3px solid #00FFFF;
      background: rgba(0, 255, 255, 0.05);
      border-radius: 0 12px 12px 0;
      font-style: italic;
      color: rgba(255, 255, 255, 0.75);
    }

    .pk-article code {
      font-family: 'Courier New', monospace;
      font-size: 0.875em;
      background: rgba(0, 255, 136, 0.08);
      border: 1px solid rgba(0, 255, 136, 0.2);
      padding: 2px 6px;
      border-radius: 4px;
      color: #00FF88;
    }

    .pk-article pre {
      background: rgba(0, 0, 0, 0.4);
      border: 1px solid rgba(0, 255, 136, 0.15);
      border-radius: 12px;
      padding: 20px 24px;
      overflow-x: auto;
      margin-bottom: 20px;
    }
    .pk-article pre code {
      background: none;
      border: none;
      padding: 0;
    }

    /* META */
    .pk-article .meta {
      font-size: 0.875rem;
      color: rgba(255, 255, 255, 0.4);
      margin-bottom: 24px;
    }

    /* FOOTER */
    .pk-footer {
      border-top: 1px solid rgba(255, 255, 255, 0.08);
      padding: 40px 24px;
      text-align: center;
    }
    .pk-footer-links {
      display: flex;
      justify-content: center;
      gap: 28px;
      flex-wrap: wrap;
      margin-bottom: 16px;
    }
    .pk-footer-links a {
      font-size: 0.875rem;
      color: rgba(255, 255, 255, 0.5);
      text-decoration: none;
      transition: color 0.2s;
    }
    .pk-footer-links a:hover { color: #00FF88; }
    .pk-footer-copy {
      font-size: 0.8rem;
      color: rgba(255, 255, 255, 0.28);
    }

    @media (max-width: 480px) {
      .pk-article { padding: 32px 16px 48px; }
    }
  </style>`;

const BRAND_HEADER = `<header class="pk-header">
    <a href="/" class="pk-logo">PulseKegel</a>
    <span class="pk-breadcrumb-sep">/</span>
    <a href="/blog" class="pk-breadcrumb-link">Blog</a>
  </header>
  <div class="pk-header-rule"></div>`;

const BRAND_FOOTER = `<footer class="pk-footer">
    <div class="pk-footer-links">
      <a href="/blog">Back to Blog</a>
      <a href="https://apps.apple.com/app/pulsekegel/id6741057595" target="_blank" rel="noopener">Download on the App Store</a>
    </div>
    <p class="pk-footer-copy">&copy; 2026 PulseKegel. All rights reserved.</p>
  </footer>`;

function applyBrandStyling(html) {
  if (!html.includes('<link rel="icon"')) {
    html = html.replace("</head>", `${BRAND_HEAD_INJECT}\n</head>`);
  } else {
    html = html.replace("</head>", `  <link rel="preconnect" href="https://fonts.googleapis.com" />\n  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />\n  <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;500;600;700;900&family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet" />\n</head>`);
  }

  html = html.replace(/<style>[\s\S]*?<\/style>/i, BRAND_STYLE);

  html = html.replace(/<body[^>]*>/, `<body>\n  ${BRAND_HEADER}`);

  const articleBodyOpen = `\n  <div class="pk-article">`;
  const articleBodyClose = `\n  </div>`;

  html = html.replace(
    /(<body[^>]*>[\s\S]*?<\/header>\s*<div class="pk-header-rule"><\/div>)([\s\S]*?)(<\/body>)/i,
    (match, headerPart, content, closing) => {
      return `${headerPart}${articleBodyOpen}${content}${articleBodyClose}\n  ${BRAND_FOOTER}\n${closing}`;
    }
  );

  return html;
}

function processFile(filename, strictErrors) {
  const sourcePath = path.join(SOURCE_DIR, filename);
  const outputPath = path.join(OUTPUT_DIR, filename);

  let html = fs.readFileSync(sourcePath, "utf-8");

  if (filename === "index.html") {
    fs.writeFileSync(outputPath, html);
    console.log(`  index.html → copied`);
    return;
  }

  // Pre-styled posts are already fully branded — copy without transformation
  if (html.includes('name="pk-pre-styled"')) {
    fs.writeFileSync(outputPath, html);
    console.log(`  ${filename} → copied (pre-styled)`);
    return;
  }

  const { extracted, cleaned } = extractMetaFromBody(html);
  html = cleaned;

  const metaTitle = extracted.metaTitle || getHeadValue(html, "title");
  const description = extracted.description || getHeadValue(html, "description");
  const rawSlug = extracted.slug || getHeadValue(html, "canonical");
  const slug = rawSlug
    ? rawSlug.replace(/^https?:\/\/pulsekegel\.com\/blog\//, "").replace(/^blog\//, "")
    : filename.replace(".html", "");
  const headline = getH1(html) || metaTitle || slug;
  let datePublished = "2025-01-01";
  if (filename.endsWith(".html")) {
    const gitDate = getFirstCommitDate(sourcePath);
    if (gitDate) {
      datePublished = gitDate;
    } else {
      const fallback = getExistingDatePublished(html) || "2025-01-01";
      datePublished = fallback;
      const msg = `  WARNING: no git history for ${filename} — datePublished may be incorrect (using ${fallback})`;
      console.warn(msg);
      if (STRICT_MODE) {
        strictErrors.push(filename);
      }
    }
  }

  const fullUrl = `https://pulsekegel.com/blog/${slug}`;

  html = updateHead(html, metaTitle, description, `blog/${slug}`);
  html = ensureArticleSchema(html, headline, description || "", slug, datePublished);
  html = ensureOgTags(html, metaTitle || headline, description || "", fullUrl);
  html = ensureBreadcrumbSchema(html, headline, slug);
  html = applyBrandStyling(html);

  fs.writeFileSync(outputPath, html);
  console.log(`  ${filename} → processed`);
}

function checkBlog() {
  const files = fs.readdirSync(SOURCE_DIR).filter((f) => f.endsWith(".html"));
  const missing = [];

  for (const file of files) {
    if (file === "index.html") continue;
    const sourcePath = path.join(SOURCE_DIR, file);
    const gitDate = getFirstCommitDate(sourcePath);
    if (!gitDate) {
      missing.push(file);
    }
  }

  if (missing.length === 0) {
    console.log(`check: all ${files.length - 1} blog post(s) have git history.`);
    process.exit(0);
  } else {
    console.error(`check: ${missing.length} blog post(s) are missing git history:`);
    for (const file of missing) {
      console.error(`  - ${file}`);
    }
    process.exit(1);
  }
}

function buildBlog() {
  console.log("Building blog...");

  console.log("Syncing lastmod dates...");
  syncAll();

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const files = fs.readdirSync(SOURCE_DIR).filter((f) => f.endsWith(".html"));

  const strictErrors = [];
  for (const file of files) {
    processFile(file, strictErrors);
  }

  console.log(`Blog built: ${files.length} file(s) → ${OUTPUT_DIR}`);

  if (STRICT_MODE && strictErrors.length > 0) {
    console.error(
      `\nERROR: ${strictErrors.length} file(s) are missing git history (strict mode). Fix by committing the files first:\n` +
        strictErrors.map((f) => `  - ${f}`).join("\n")
    );
    process.exit(1);
  }
}

function checkDates() {
  const files = fs.readdirSync(SOURCE_DIR).filter((f) => f.endsWith(".html"));
  const mismatches = [];

  for (const file of files) {
    if (file === "index.html") continue;
    const sourcePath = path.join(SOURCE_DIR, file);
    const gitDate = getFirstCommitDate(sourcePath);
    if (!gitDate) continue; // no history — handled by --check, skip here
    const html = fs.readFileSync(sourcePath, "utf-8");
    const storedDate = getExistingDatePublished(html);
    if (storedDate && storedDate !== gitDate) {
      mismatches.push({ file, storedDate, gitDate });
    }
  }

  if (mismatches.length === 0) {
    console.log(`check-dates: all blog posts with git history have matching datePublished.`);
    process.exit(0);
  } else {
    console.error(`check-dates: ${mismatches.length} blog post(s) have a datePublished mismatch:`);
    for (const { file, storedDate, gitDate } of mismatches) {
      console.error(`  - ${file}: stored=${storedDate}, git=${gitDate}`);
    }
    process.exit(1);
  }
}

function fixDates() {
  const files = fs.readdirSync(SOURCE_DIR).filter((f) => f.endsWith(".html"));
  const fixed = [];
  const skipped = [];

  for (const file of files) {
    if (file === "index.html") continue;
    const sourcePath = path.join(SOURCE_DIR, file);
    const gitDate = getFirstCommitDate(sourcePath);
    if (!gitDate) {
      skipped.push(file);
      continue;
    }
    const html = fs.readFileSync(sourcePath, "utf-8");
    const storedDate = getExistingDatePublished(html);
    if (!storedDate || storedDate === gitDate) continue;

    const updated = html.replace(
      /"datePublished"\s*:\s*"\d{4}-\d{2}-\d{2}"/g,
      `"datePublished": "${gitDate}"`
    );
    fs.writeFileSync(sourcePath, updated, "utf-8");
    fixed.push({ file, storedDate, gitDate });
  }

  if (fixed.length === 0 && skipped.length === 0) {
    console.log("fix-dates: all datePublished values already match git history. Nothing to do.");
  } else {
    if (fixed.length > 0) {
      console.log(`fix-dates: updated ${fixed.length} file(s):`);
      for (const { file, storedDate, gitDate } of fixed) {
        console.log(`  - ${file}: ${storedDate} → ${gitDate}`);
      }
    } else {
      console.log("fix-dates: no mismatches found — nothing updated.");
    }
    if (skipped.length > 0) {
      console.warn(`fix-dates: skipped ${skipped.length} file(s) with no git history:`);
      for (const file of skipped) {
        console.warn(`  - ${file}`);
      }
    }
  }

  process.exit(0);
}

if (process.argv.includes("--fix-dates")) {
  fixDates();
} else if (process.argv.includes("--check-dates")) {
  checkDates();
} else if (process.argv.includes("--check")) {
  checkBlog();
} else {
  buildBlog();
}
