#!/usr/bin/env node
/**
 * sync-blog-dates.js
 *
 * Auto-syncs the <!--lastmod:YYYY-MM-DD--> comment on line 1 of every
 * blog-content/*.html file (excluding index.html).
 *
 * Date resolution (applied in this order):
 *   1. Explicit override: BLOG_SYNC_DATE env var or --date YYYY-MM-DD CLI flag
 *   2. Last git commit date for the file (`git log --format=%ci -1 -- <file>`)
 *   3. `dateModified` value in the file's JSON-LD <script> block
 *   4. Today's UTC date as the final fallback
 *
 * The script also rewrites the `dateModified` field in the JSON-LD block so
 * that both values stay in sync — developers only need to change content;
 * they never need to touch either date field manually.
 *
 * Usage:
 *   node scripts/sync-blog-dates.js                    # sync all, auto-detect dates
 *   node scripts/sync-blog-dates.js --date 2026-04-16  # force a specific date for all
 *   node scripts/sync-blog-dates.js [file ...]         # sync specific files
 *   BLOG_SYNC_DATE=2026-04-16 node scripts/sync-blog-dates.js  # via env var
 *
 * The --date flag (or BLOG_SYNC_DATE env var) is used by the pre-commit hook
 * to stamp today's date on files that are being committed right now.
 * Build-time callers leave the override unset so each file gets its last-commit date.
 */

"use strict";

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const BLOG_DIR = path.join(process.cwd(), "blog-content");

function todayUtc() {
  return new Date().toISOString().split("T")[0];
}

function gitLastCommitDate(filePath) {
  try {
    const rel = path.relative(process.cwd(), filePath);
    const out = execSync(`git log --format="%ci" -1 -- "${rel}"`, {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
    if (!out) return null;
    return out.slice(0, 10);
  } catch {
    return null;
  }
}

/**
 * Returns the date of the very first git commit for a file (YYYY-MM-DD).
 * This is the stable publication date that survives clones and rebuilds.
 */
function gitFirstCommitDate(filePath) {
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

function jsonLdDateModified(content) {
  const m = content.match(/"dateModified"\s*:\s*"(\d{4}-\d{2}-\d{2})"/);
  return m ? m[1] : null;
}

function jsonLdDatePublished(content) {
  const m = content.match(/"datePublished"\s*:\s*"(\d{4}-\d{2}-\d{2})"/);
  return m ? m[1] : null;
}

/**
 * Resolve the correct lastmod date for a file.
 * @param {string} filePath  Absolute path to the source file.
 * @param {string} content   Current file content.
 * @param {string|null} forceDate  When set, skip auto-detection and use this date.
 */
function resolveDate(filePath, content, forceDate = null) {
  if (forceDate) return forceDate;
  return gitLastCommitDate(filePath) || jsonLdDateModified(content) || todayUtc();
}

function setLastmodComment(content, date) {
  const tag = `<!--lastmod:${date}-->`;
  if (/^<!--lastmod:\d{4}-\d{2}-\d{2}-->/.test(content)) {
    return content.replace(/^<!--lastmod:\d{4}-\d{2}-\d{2}-->/, tag);
  }
  return `${tag}\n${content}`;
}

function setJsonLdDateModified(content, date) {
  return content.replace(
    /("dateModified"\s*:\s*")(\d{4}-\d{2}-\d{2})(")/g,
    `$1${date}$3`
  );
}

function setJsonLdDatePublished(content, date) {
  return content.replace(
    /("datePublished"\s*:\s*")(\d{4}-\d{2}-\d{2})(")/g,
    `$1${date}$3`
  );
}

/**
 * Sync a single file.
 * Updates lastmod comment and dateModified using the most-recent commit date,
 * and also updates datePublished using the first-ever commit date (stable across
 * clones and rebuilds).
 *
 * @param {string} filePath  Absolute or relative path to the HTML file.
 * @param {string|null} forceDate  When set, use this date for lastmod/dateModified only.
 */
function syncFile(filePath, forceDate = null) {
  const basename = path.basename(filePath);
  if (basename === "index.html") return;

  let content = fs.readFileSync(filePath, "utf-8");
  const date = resolveDate(filePath, content, forceDate);

  content = setLastmodComment(content, date);
  content = setJsonLdDateModified(content, date);

  const publishedDate =
    gitFirstCommitDate(filePath) ||
    jsonLdDatePublished(content) ||
    date;
  content = setJsonLdDatePublished(content, publishedDate);

  fs.writeFileSync(filePath, content, "utf-8");
  console.log(`synced  ${basename}  →  lastmod:${date}  datePublished:${publishedDate}`);
}

/**
 * Sync all blog-content/*.html files.
 * @param {string|null} forceDate  When set, use this date for every file.
 */
function syncAll(forceDate = null) {
  const files = fs.readdirSync(BLOG_DIR).filter((f) => f.endsWith(".html"));
  for (const f of files) {
    syncFile(path.join(BLOG_DIR, f), forceDate);
  }
}

if (require.main === module) {
  const argv = process.argv.slice(2);

  // Parse --date flag or fall back to BLOG_SYNC_DATE env var
  let forceDate = process.env.BLOG_SYNC_DATE || null;
  const dateIdx = argv.indexOf("--date");
  let files = argv;
  if (dateIdx !== -1) {
    forceDate = argv[dateIdx + 1] || null;
    files = argv.filter((_, i) => i !== dateIdx && i !== dateIdx + 1);
  }

  if (files.length > 0) {
    for (const arg of files) {
      syncFile(path.resolve(arg), forceDate);
    }
  } else {
    syncAll(forceDate);
  }
}

module.exports = { syncFile, syncAll, resolveDate };
