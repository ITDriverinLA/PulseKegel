const fs = require("fs");
const path = require("path");

const SOURCE_DIR = path.join(process.cwd(), "blog-content");
const OUTPUT_DIR = path.join(process.cwd(), "static-build", "blog");

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

function linkifyMetaBlogText(html) {
  html = html.replace(
    /<div class="meta">PulseKegel Blog/g,
    '<div class="meta"><a href="/blog" style="color:#0d5ea6;text-decoration:none">PulseKegel Blog</a>'
  );
  html = html.replace(
    /(<p class="meta">)PulseKegel Blog/g,
    '$1<a href="/blog" style="color:#0d5ea6;text-decoration:none">PulseKegel Blog</a>'
  );
  return html;
}

function getH1(html) {
  const m = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
  return m ? m[1].trim() : null;
}

function processFile(filename) {
  const sourcePath = path.join(SOURCE_DIR, filename);
  const outputPath = path.join(OUTPUT_DIR, filename);

  let html = fs.readFileSync(sourcePath, "utf-8");

  if (filename === "index.html") {
    fs.writeFileSync(outputPath, html);
    console.log(`  index.html → copied`);
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
  const datePublished = filename.endsWith(".html")
    ? (fs.statSync(sourcePath).mtime.toISOString().split("T")[0])
    : "2025-01-01";

  const fullUrl = `https://pulsekegel.com/blog/${slug}`;

  html = updateHead(html, metaTitle, description, `blog/${slug}`);
  html = ensureArticleSchema(html, headline, description || "", slug, datePublished);
  html = ensureOgTags(html, metaTitle || headline, description || "", fullUrl);
  html = ensureBreadcrumbSchema(html, headline, slug);
  html = linkifyMetaBlogText(html);

  fs.writeFileSync(outputPath, html);
  console.log(`  ${filename} → processed`);
}

function buildBlog() {
  console.log("Building blog...");

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const files = fs.readdirSync(SOURCE_DIR).filter((f) => f.endsWith(".html"));

  for (const file of files) {
    processFile(file);
  }

  console.log(`Blog built: ${files.length} file(s) → ${OUTPUT_DIR}`);
}

buildBlog();
