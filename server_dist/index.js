var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// server/index.ts
import express2 from "express";

// server/routes.ts
import express from "express";
import { createServer } from "node:http";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import OpenAI from "openai";

// server/staticContent.ts
var privacyPolicyHtml = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Privacy Policy \u2014 PulseKegel</title>
<meta name="description" content="How PulseKegel collects, uses, stores, and protects your personal information. Minimal data. No selling. No sharing. Your data stays yours." />
<meta name="theme-color" content="#0B0E26" />

<!-- Open Graph -->
<meta property="og:title" content="Privacy Policy \u2014 PulseKegel" />
<meta property="og:description" content="Minimal data. No selling. No sharing. Your data stays yours." />
<meta property="og:type" content="website" />
<meta property="og:url" content="https://pulsekegel.com/privacy" />

<!-- Fonts -->
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet" />

<style>
  /* =========================================================
     PULSEKEGEL \u2014 PRIVACY POLICY
     Brand system shared with pk-premium-hero-concept-v2.html
     and pk-blog-index.html
     ========================================================= */
  :root {
    --navy-deep: #080A20;
    --navy: #0B0E26;
    --navy-soft: #15183A;
    --teal: #36E7B3;
    --teal-dim: #1E8A6B;
    --white: #F6F7FB;
    --gray: #A8ACC4;
    --gray-dim: #6B6F88;
    --violet: #8B5CF6;
    --line: rgba(255, 255, 255, 0.08);
    --line-strong: rgba(255, 255, 255, 0.14);
  }

  * { box-sizing: border-box; margin: 0; padding: 0; }

  html { scroll-behavior: smooth; }
  body {
    background: var(--navy-deep);
    color: var(--white);
    font-family: 'Poppins', system-ui, sans-serif;
    font-size: 16px;
    line-height: 1.6;
    -webkit-font-smoothing: antialiased;
    overflow-x: hidden;
  }

  a { color: inherit; text-decoration: none; }

  ::selection { background: var(--teal); color: var(--navy-deep); }

  /* ---------- SHARED HUD BRACKETS ---------- */
  .bracket {
    position: absolute;
    width: 28px;
    height: 28px;
    border-color: var(--teal);
    border-style: solid;
    border-width: 0;
    opacity: 0.65;
    pointer-events: none;
  }
  .bracket.tl { top: 18px; left: 18px; border-top-width: 2px; border-left-width: 2px; }
  .bracket.tr { top: 18px; right: 18px; border-top-width: 2px; border-right-width: 2px; }
  .bracket.bl { bottom: 18px; left: 18px; border-bottom-width: 2px; border-left-width: 2px; }
  .bracket.br { bottom: 18px; right: 18px; border-bottom-width: 2px; border-right-width: 2px; }

  /* ---------- SIDE READOUTS (vertical rails) ---------- */
  .rail-left, .rail-right {
    position: absolute;
    top: 50%;
    transform: translateY(-50%) rotate(-90deg);
    transform-origin: center;
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px;
    font-weight: 500;
    letter-spacing: 0.25em;
    color: var(--gray-dim);
    white-space: nowrap;
    pointer-events: none;
  }
  .rail-left  { left: -40px; }
  .rail-right { right: -64px; color: var(--teal-dim); }
  .rail-right .live {
    color: var(--teal);
    animation: blink 1.6s steps(2, end) infinite;
  }
  @keyframes blink { 50% { opacity: 0.25; } }

  /* ---------- TOP NAV ---------- */
  .site-nav {
    position: sticky;
    top: 0;
    z-index: 50;
    padding: 20px 44px;
    background: rgba(8, 10, 32, 0.88);
    backdrop-filter: blur(14px);
    -webkit-backdrop-filter: blur(14px);
    border-bottom: 1px solid var(--line);
  }
  .nav-inner {
    max-width: 1280px;
    margin: 0 auto;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .wordmark {
    font-family: 'General Sans', 'Poppins', sans-serif;
    font-weight: 800;
    font-size: 20px;
    letter-spacing: -0.01em;
    color: var(--white);
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .wordmark .dot {
    width: 8px;
    height: 8px;
    background: var(--teal);
    border-radius: 50%;
    box-shadow: 0 0 10px var(--teal);
    animation: pulse 1.4s ease-in-out infinite;
  }
  @keyframes pulse {
    0%, 100% { opacity: 0.45; transform: scale(0.85); }
    50%      { opacity: 1;    transform: scale(1.1);  }
  }
  .menu {
    display: flex;
    gap: 28px;
    align-items: center;
    font-family: 'JetBrains Mono', monospace;
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--gray);
  }
  .menu a {
    padding-bottom: 2px;
    border-bottom: 1px solid transparent;
    transition: border-color 0.2s, color 0.2s;
  }
  .menu a:hover { color: var(--teal); border-bottom-color: var(--teal); }
  .menu a[aria-current="page"] { color: var(--white); }

  .btn-primary {
    background: var(--teal);
    color: var(--navy-deep);
    font-family: 'JetBrains Mono', monospace;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    padding: 10px 18px;
    border-radius: 3px;
    transition: transform 0.2s, box-shadow 0.2s, background 0.2s;
    display: inline-flex;
    align-items: center;
    gap: 8px;
  }
  .btn-primary:hover {
    transform: translateY(-1px);
    box-shadow: 0 8px 24px rgba(54, 231, 179, 0.25);
  }
  .btn-primary .arrow { transition: transform 0.2s; }
  .btn-primary:hover .arrow { transform: translateX(3px); }

  /* ---------- HERO ---------- */
  .privacy-hero {
    position: relative;
    padding: 120px 44px 90px;
    background:
      radial-gradient(ellipse at 28% 60%, rgba(54, 231, 179, 0.10) 0%, transparent 50%),
      linear-gradient(180deg, var(--navy) 0%, var(--navy-deep) 100%);
    border-bottom: 1px solid var(--line);
  }
  .privacy-hero-inner {
    max-width: 1280px;
    margin: 0 auto;
    position: relative;
  }
  .privacy-hero .eyebrow {
    font-family: 'JetBrains Mono', monospace;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.32em;
    text-transform: uppercase;
    color: var(--teal);
    display: flex;
    align-items: center;
    gap: 14px;
    margin-bottom: 36px;
  }
  .privacy-hero .eyebrow::before {
    content: '';
    width: 38px;
    height: 1px;
    background: var(--teal);
    opacity: 0.6;
  }
  .privacy-hero h1 {
    font-family: 'General Sans', 'Poppins', sans-serif;
    font-weight: 800;
    font-size: clamp(44px, 6.5vw, 88px);
    line-height: 0.98;
    letter-spacing: -0.025em;
    color: var(--white);
    max-width: 920px;
    margin-bottom: 28px;
  }
  .privacy-hero h1 .accent { color: var(--teal); }
  .privacy-hero .subtitle {
    font-size: clamp(17px, 1.6vw, 20px);
    line-height: 1.55;
    color: var(--gray);
    max-width: 640px;
    margin-bottom: 40px;
  }
  .privacy-hero .meta-row {
    display: flex;
    flex-wrap: wrap;
    gap: 28px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: var(--gray-dim);
    margin-top: 48px;
    padding-top: 24px;
    border-top: 1px dashed var(--line);
  }
  .privacy-hero .meta-row span .k { color: var(--teal); margin-right: 8px; }

  /* ---------- TOC STRIP ---------- */
  .toc-strip {
    position: relative;
    padding: 32px 44px;
    background: var(--navy);
    border-bottom: 1px solid var(--line);
  }
  .toc-inner {
    max-width: 1280px;
    margin: 0 auto;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 20px 26px;
  }
  .toc-label {
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.3em;
    text-transform: uppercase;
    color: var(--gray-dim);
  }
  .toc-inner a {
    font-family: 'JetBrains Mono', monospace;
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--gray);
    padding: 6px 0;
    border-bottom: 1px solid transparent;
    transition: color 0.2s, border-color 0.2s;
  }
  .toc-inner a:hover {
    color: var(--teal);
    border-bottom-color: var(--teal);
  }

  /* ---------- SHARED SECTION SHELL ---------- */
  .privacy-section {
    position: relative;
    padding: 90px 44px 70px;
    border-bottom: 1px solid var(--line);
  }
  .privacy-section:nth-of-type(even) {
    background:
      radial-gradient(ellipse at 78% 30%, rgba(54, 231, 179, 0.04) 0%, transparent 55%),
      var(--navy-deep);
  }
  .section-inner {
    max-width: 1100px;
    margin: 0 auto;
  }
  .section-divider {
    border-top: 1px dashed var(--line);
    padding-top: 14px;
    display: flex;
    justify-content: space-between;
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px;
    font-weight: 500;
    letter-spacing: 0.28em;
    color: var(--gray-dim);
    text-transform: uppercase;
    margin-bottom: 40px;
  }
  .section-head {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 24px;
    margin-bottom: 40px;
  }
  .section-head h2 {
    font-family: 'General Sans', 'Poppins', sans-serif;
    font-weight: 800;
    font-size: clamp(30px, 3.6vw, 48px);
    line-height: 1.02;
    letter-spacing: -0.02em;
    color: var(--white);
    max-width: 780px;
  }
  .section-head h2 .accent { color: var(--teal); }
  .section-head .head-note {
    font-family: 'JetBrains Mono', monospace;
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: var(--gray);
    max-width: 280px;
    text-align: right;
  }
  .section-head .head-note .k { color: var(--teal); }

  /* ---------- BODY COPY ---------- */
  .body-copy {
    font-size: 17px;
    line-height: 1.7;
    color: var(--gray);
    max-width: 760px;
  }
  .body-copy + .body-copy { margin-top: 18px; }
  .body-copy strong { color: var(--white); font-weight: 600; }
  .body-copy a {
    color: var(--teal);
    border-bottom: 1px solid rgba(54, 231, 179, 0.3);
    transition: border-color 0.2s;
  }
  .body-copy a:hover { border-bottom-color: var(--teal); }

  /* ---------- DATA LIST ---------- */
  .data-list {
    list-style: none;
    margin-top: 28px;
    max-width: 800px;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .data-list li {
    display: grid;
    grid-template-columns: 180px 1fr;
    gap: 24px;
    padding: 18px 0;
    border-bottom: 1px dashed var(--line);
  }
  .data-list li:last-child { border-bottom: none; }
  .data-list .k {
    font-family: 'JetBrains Mono', monospace;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--teal);
    padding-top: 3px;
  }
  .data-list .v {
    font-size: 16px;
    line-height: 1.6;
    color: var(--white);
  }
  .data-list .v .note {
    display: block;
    color: var(--gray);
    font-size: 14px;
    margin-top: 4px;
  }

  /* ---------- BULLETS ---------- */
  .use-list {
    list-style: none;
    margin-top: 22px;
    max-width: 760px;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .use-list li {
    display: flex;
    gap: 16px;
    font-size: 16px;
    line-height: 1.55;
    color: var(--white);
  }
  .use-list li::before {
    content: '\u25CF';
    color: var(--teal);
    font-size: 10px;
    line-height: 1.7;
    flex-shrink: 0;
  }

  /* ---------- RIGHTS GRID ---------- */
  .rights-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 16px;
    margin-top: 12px;
  }
  .right-card {
    position: relative;
    padding: 28px 26px;
    background: var(--navy);
    border: 1px solid var(--line);
    border-radius: 4px;
    transition: border-color 0.2s, transform 0.2s;
  }
  .right-card:hover {
    border-color: var(--teal);
    transform: translateY(-2px);
  }
  .right-card .num {
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.22em;
    color: var(--teal);
    margin-bottom: 14px;
  }
  .right-card h3 {
    font-family: 'General Sans', 'Poppins', sans-serif;
    font-weight: 700;
    font-size: 20px;
    line-height: 1.2;
    color: var(--white);
    margin-bottom: 10px;
  }
  .right-card p {
    font-size: 14px;
    line-height: 1.55;
    color: var(--gray);
  }

  /* ---------- CALLOUT ---------- */
  .callout {
    margin-top: 32px;
    padding: 28px 28px;
    background: linear-gradient(90deg, rgba(54, 231, 179, 0.06) 0%, rgba(54, 231, 179, 0) 100%);
    border-left: 2px solid var(--teal);
    border-radius: 0 4px 4px 0;
    max-width: 800px;
  }
  .callout .k {
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.28em;
    text-transform: uppercase;
    color: var(--teal);
    margin-bottom: 10px;
    display: block;
  }
  .callout p {
    font-size: 15px;
    line-height: 1.6;
    color: var(--white);
  }

  /* ---------- CONTACT BLOCK ---------- */
  .contact-block {
    position: relative;
    padding: 110px 44px 120px;
    background:
      radial-gradient(ellipse at 50% 50%, rgba(54, 231, 179, 0.08) 0%, transparent 55%),
      var(--navy);
    border-bottom: 1px solid var(--line);
    text-align: center;
  }
  .contact-block .eyebrow {
    font-family: 'JetBrains Mono', monospace;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.32em;
    text-transform: uppercase;
    color: var(--teal);
    margin-bottom: 26px;
    display: inline-flex;
    align-items: center;
    gap: 14px;
  }
  .contact-block .eyebrow::before,
  .contact-block .eyebrow::after {
    content: '';
    width: 28px;
    height: 1px;
    background: var(--teal);
    opacity: 0.6;
  }
  .contact-block h2 {
    font-family: 'General Sans', 'Poppins', sans-serif;
    font-weight: 800;
    font-size: clamp(34px, 4.4vw, 56px);
    line-height: 1.04;
    letter-spacing: -0.02em;
    color: var(--white);
    max-width: 780px;
    margin: 0 auto 20px;
  }
  .contact-block h2 .accent { color: var(--teal); }
  .contact-block p {
    font-size: 17px;
    line-height: 1.6;
    color: var(--gray);
    max-width: 560px;
    margin: 0 auto 36px;
  }
  .contact-email {
    display: inline-flex;
    align-items: center;
    gap: 14px;
    padding: 18px 28px;
    background: var(--navy-deep);
    border: 1px solid var(--line-strong);
    border-radius: 4px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 15px;
    font-weight: 500;
    color: var(--white);
    letter-spacing: 0.04em;
    transition: border-color 0.2s, transform 0.2s, box-shadow 0.2s;
  }
  .contact-email:hover {
    border-color: var(--teal);
    transform: translateY(-1px);
    box-shadow: 0 8px 24px rgba(54, 231, 179, 0.2);
  }
  .contact-email .k {
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.28em;
    text-transform: uppercase;
    color: var(--teal);
  }
  .contact-email .sep {
    width: 1px;
    height: 18px;
    background: var(--line-strong);
  }

  /* ---------- FOOTER ---------- */
  .page-footer {
    position: relative;
    padding: 70px 44px 32px;
    background: var(--navy-deep);
  }
  .page-footer::before {
    content: '';
    position: absolute;
    top: 0; left: 50%;
    transform: translateX(-50%);
    width: 48px;
    height: 2px;
    background: var(--teal);
    box-shadow: 0 0 12px rgba(54, 231, 179, 0.6);
  }
  .footer-main {
    max-width: 1280px;
    margin: 0 auto;
    display: grid;
    grid-template-columns: 1.4fr 1fr 1fr 1fr;
    gap: 56px;
    padding-bottom: 48px;
    border-bottom: 1px dashed var(--line);
  }
  .footer-col h4 {
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px;
    font-weight: 500;
    letter-spacing: 0.28em;
    text-transform: uppercase;
    color: var(--gray-dim);
    margin-bottom: 18px;
  }
  .footer-col .wordmark { margin-bottom: 14px; }
  .footer-col p.tag {
    font-size: 14px;
    line-height: 1.55;
    color: var(--gray);
    max-width: 280px;
  }
  .footer-col ul {
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .footer-col li a {
    color: var(--gray);
    font-size: 14px;
    transition: color 0.2s;
  }
  .footer-col li a:hover { color: var(--teal); }
  .footer-col li a[aria-current="page"] { color: var(--white); }
  .footer-col .social-row {
    display: flex;
    gap: 14px;
  }
  .footer-col .social-row a {
    width: 34px;
    height: 34px;
    border: 1px solid var(--line);
    border-radius: 3px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: var(--gray);
    transition: color 0.2s, border-color 0.2s;
  }
  .footer-col .social-row a:hover {
    color: var(--teal);
    border-color: var(--teal);
  }
  .footer-col .social-row svg {
    width: 16px;
    height: 16px;
    fill: currentColor;
  }
  .footer-bottom {
    max-width: 1280px;
    margin: 0 auto;
    padding-top: 28px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 10px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px;
    font-weight: 500;
    letter-spacing: 0.22em;
    color: var(--gray-dim);
    text-transform: uppercase;
  }
  .footer-bottom .left span { color: var(--teal); }

  /* ---------- RESPONSIVE ---------- */
  @media (max-width: 1100px) {
    .rights-grid { grid-template-columns: repeat(2, 1fr); }
    .rail-left, .rail-right { display: none; }
  }
  @media (max-width: 900px) {
    .site-nav { padding: 16px 32px; }
    .privacy-hero { padding: 90px 32px 70px; }
    .toc-strip { padding: 28px 32px; }
    .privacy-section { padding: 70px 32px 56px; }
    .contact-block { padding: 90px 32px; }
    .data-list li { grid-template-columns: 1fr; gap: 6px; }
    .footer-main { grid-template-columns: 1fr 1fr; gap: 40px; }
    .footer-main .brand-col { grid-column: 1 / -1; }
    .page-footer { padding: 60px 32px 28px; }
  }
  @media (max-width: 600px) {
    .menu .nav-link { display: none; }
    .menu { gap: 14px; }
    .site-nav { padding: 14px 20px; }
    .privacy-hero { padding: 80px 20px 60px; }
    .toc-strip { padding: 24px 20px; }
    .privacy-section { padding: 60px 20px 48px; }
    .rights-grid { grid-template-columns: 1fr; }
    .contact-block { padding: 80px 20px; }
    .contact-block .eyebrow::before,
    .contact-block .eyebrow::after { width: 22px; }
    .contact-email {
      flex-wrap: wrap;
      justify-content: center;
      font-size: 14px;
    }
    .section-head { flex-direction: column; align-items: flex-start; }
    .section-head .head-note { text-align: left; }
    .page-footer { padding: 48px 20px 24px; }
    .footer-main {
      grid-template-columns: 1fr;
      gap: 32px;
      padding-bottom: 32px;
    }
    .footer-bottom {
      flex-direction: column;
      align-items: flex-start;
      font-size: 9px;
    }
  }

  /* ---------- SCROLL REVEALS ---------- */
  @keyframes reveal-up {
    from { opacity: 0; transform: translateY(16px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .reveal {
    opacity: 0;
    transform: translateY(16px);
  }
  .reveal.in-view {
    opacity: 1;
    transform: translateY(0);
    animation: reveal-up 0.6s cubic-bezier(0.22, 0.7, 0.2, 1) backwards;
  }
  .reveal-stagger > * {
    opacity: 0;
    transform: translateY(16px);
  }
  .reveal-stagger.in-view > * {
    opacity: 1;
    transform: translateY(0);
    animation: reveal-up 0.55s ease-out backwards;
  }
  .reveal-stagger.in-view > *:nth-child(1) { animation-delay:  40ms; }
  .reveal-stagger.in-view > *:nth-child(2) { animation-delay: 110ms; }
  .reveal-stagger.in-view > *:nth-child(3) { animation-delay: 180ms; }
  .reveal-stagger.in-view > *:nth-child(4) { animation-delay: 250ms; }
  .reveal-stagger.in-view > *:nth-child(5) { animation-delay: 320ms; }
  .reveal-stagger.in-view > *:nth-child(6) { animation-delay: 390ms; }

  @media (prefers-reduced-motion: reduce) {
    html { scroll-behavior: auto; }
    .reveal, .reveal-stagger > * {
      opacity: 1 !important;
      transform: none !important;
      animation: none !important;
    }
  }
</style>
</head>

<body>

<!-- =========================================================
     TOP NAV
     ========================================================= -->
<header class="site-nav">
  <div class="nav-inner">
    <a class="wordmark" href="https://pulsekegel.com/" aria-label="PulseKegel home">
      <span class="dot" aria-hidden="true"></span>
      PulseKegel
    </a>
    <nav class="menu" aria-label="Primary">
      <a class="nav-link" href="https://pulsekegel.com/">Home</a>
      <a class="nav-link" href="https://pulsekegel.com/blog/">Blog</a>
      <a id="cta-privacy-nav" class="btn-primary" href="https://apps.apple.com/us/app/pulsekegel/id6758308054" target="_blank" rel="noopener">
        Start Training
        <span class="arrow" aria-hidden="true">\u2192</span>
      </a>
    </nav>
  </div>
</header>

<!-- =========================================================
     HERO
     ========================================================= -->
<section class="privacy-hero" aria-labelledby="privacy-title">
  <span class="bracket tl" aria-hidden="true"></span>
  <span class="bracket tr" aria-hidden="true"></span>
  <span class="bracket bl" aria-hidden="true"></span>
  <span class="bracket br" aria-hidden="true"></span>

  <span class="rail-left" aria-hidden="true">PRIVACY \u25B8 VAULT STATUS</span>
  <span class="rail-right" aria-hidden="true">CRYPTO <span class="live">\u25CF</span> SEALED \xB7 v1.0</span>

  <div class="privacy-hero-inner">
    <div class="eyebrow reveal">Privacy Policy</div>
    <h1 id="privacy-title" class="reveal">
      Your data.<br />
      <span class="accent">Your call.</span>
    </h1>
    <p class="subtitle reveal">
      Short version: we collect the minimum, we don't sell it, we don't share it, and you can delete it anytime. Here's the full story \u2014 plainly, with no legal hand-waving.
    </p>

    <div class="meta-row reveal">
      <span><span class="k">\u25CF</span>Effective&nbsp;\xB7&nbsp;Jan 29, 2026</span>
      <span><span class="k">\u25CF</span>Last updated&nbsp;\xB7&nbsp;Jan 29, 2026</span>
      <span><span class="k">\u25CF</span>8 sections</span>
      <span><span class="k">\u25CF</span>Plain language</span>
    </div>
  </div>
</section>

<!-- =========================================================
     TABLE OF CONTENTS STRIP
     ========================================================= -->
<nav class="toc-strip" aria-label="Policy sections">
  <div class="toc-inner">
    <span class="toc-label">Jump to</span>
    <a href="#what-we-collect">01 \xB7 What we collect</a>
    <a href="#how-we-use">02 \xB7 How we use it</a>
    <a href="#storage">03 \xB7 Storage & security</a>
    <a href="#your-rights">04 \xB7 Your rights</a>
    <a href="#retention">05 \xB7 Retention</a>
    <a href="#children">06 \xB7 Children's privacy</a>
    <a href="#changes">07 \xB7 Policy changes</a>
    <a href="#contact">08 \xB7 Contact</a>
  </div>
</nav>

<!-- =========================================================
     01 \xB7 WHAT WE COLLECT
     ========================================================= -->
<section class="privacy-section" id="what-we-collect" aria-labelledby="s1-title">
  <div class="section-inner">
    <div class="section-divider">
      <span>01 / COLLECTION \u25B8 DATA INPUTS</span>
      <span>STATUS \u25CF ACTIVE \xB7 v1.0</span>
    </div>

    <div class="section-head reveal">
      <h2 id="s1-title">What we <span class="accent">collect</span>.</h2>
      <div class="head-note"><span class="k">\u25CF</span>The minimum needed to make the app work for you.</div>
    </div>

    <p class="body-copy reveal">
      PulseKegel is designed to gather <strong>as little personal data as possible</strong>. We only collect what's directly required to personalize your training and keep the app running. Here's the complete list.
    </p>

    <ul class="data-list reveal-stagger">
      <li>
        <span class="k">First name</span>
        <span class="v">
          Used for personalization inside the app \u2014 greetings, progress screens, and session headers.
          <span class="note">Not required if you'd rather stay anonymous. You can use any name you like.</span>
        </span>
      </li>
      <li>
        <span class="k">Anatomy type</span>
        <span class="v">
          Used to tailor exercises, cues, and progress targets to your body.
          <span class="note">This is the only clinically relevant input \u2014 it shapes what the app recommends.</span>
        </span>
      </li>
      <li>
        <span class="k">App usage data</span>
        <span class="v">
          Session counts, streaks, and completion state \u2014 stored so your progress follows you across devices.
          <span class="note">Aggregated, never tied to ads or third-party profiling.</span>
        </span>
      </li>
    </ul>

    <div class="callout reveal">
      <span class="k">What we don't collect</span>
      <p>We don't ask for your last name, birthdate, address, phone number, medical history, or payment details beyond what Apple handles on its side. We don't track your location. We don't read your contacts. We don't use fingerprinting or advertising identifiers.</p>
    </div>
  </div>
</section>

<!-- =========================================================
     02 \xB7 HOW WE USE IT
     ========================================================= -->
<section class="privacy-section" id="how-we-use" aria-labelledby="s2-title">
  <div class="section-inner">
    <div class="section-divider">
      <span>02 / USAGE \u25B8 INTENDED PURPOSE</span>
      <span>SCOPE \u25CF NARROW \xB7 v1.0</span>
    </div>

    <div class="section-head reveal">
      <h2 id="s2-title">How we <span class="accent">use</span> it.</h2>
      <div class="head-note"><span class="k">\u25CF</span>Training the app. Nothing else.</div>
    </div>

    <p class="body-copy reveal">
      Your data has one job: making the app work better for <em>you</em>. We use the information we collect <strong>solely</strong> for:
    </p>

    <ul class="use-list reveal-stagger">
      <li>Personalizing your app experience \u2014 greetings, streaks, and progress displays</li>
      <li>Providing relevant content and features based on your anatomy type</li>
      <li>Improving app functionality, fixing bugs, and refining recommendations over time</li>
      <li>Sending service messages if something material changes (rare, and always relevant)</li>
    </ul>

    <div class="callout reveal">
      <span class="k">We do not</span>
      <p>Sell your information. Rent it. Share it with data brokers. Use it to train third-party advertising models. Package it for analytics resale. Combine it with data from other apps. Send it anywhere it doesn't need to go.</p>
    </div>
  </div>
</section>

<!-- =========================================================
     03 \xB7 STORAGE & SECURITY
     ========================================================= -->
<section class="privacy-section" id="storage" aria-labelledby="s3-title">
  <div class="section-inner">
    <div class="section-divider">
      <span>03 / STORAGE \u25B8 SECURITY POSTURE</span>
      <span>CRYPTO \u25CF SEALED \xB7 v1.0</span>
    </div>

    <div class="section-head reveal">
      <h2 id="s3-title">Storage &amp; <span class="accent">security</span>.</h2>
      <div class="head-note"><span class="k">\u25CF</span>Encrypted at rest. Encrypted in transit.</div>
    </div>

    <p class="body-copy reveal">
      Your data is stored securely \u2014 on your device and on our servers \u2014 using <strong>industry-standard security measures</strong>: encryption at rest, encrypted transport (TLS), strict access controls, and infrastructure hosted with reputable cloud providers that meet modern compliance baselines.
    </p>

    <p class="body-copy reveal">
      We <strong>do not share, sell, or distribute</strong> your personal information to third parties. Service providers that help us run the app (e.g. hosting) only handle data under contract, only for the purpose of providing that service, and never for their own purposes.
    </p>

    <div class="callout reveal">
      <span class="k">Breach honesty</span>
      <p>No system is perfectly secure. If something ever happens that affects your data, we'll tell you quickly and clearly \u2014 not weeks later, not buried in legalese.</p>
    </div>
  </div>
</section>

<!-- =========================================================
     04 \xB7 YOUR RIGHTS
     ========================================================= -->
<section class="privacy-section" id="your-rights" aria-labelledby="s4-title">
  <div class="section-inner">
    <div class="section-divider">
      <span>04 / RIGHTS \u25B8 CONTROL VECTORS</span>
      <span>ACCESS \u25CF GRANTED \xB7 v1.0</span>
    </div>

    <div class="section-head reveal">
      <h2 id="s4-title">Your <span class="accent">rights</span>.</h2>
      <div class="head-note"><span class="k">\u25CF</span>Four levers, always available.</div>
    </div>

    <p class="body-copy reveal">
      Your data belongs to you. You can use any of the following at any time \u2014 no questions, no friction.
    </p>

    <div class="rights-grid reveal-stagger" role="list">
      <div class="right-card" role="listitem">
        <div class="num">\u25CF RIGHT 01</div>
        <h3>Delete anytime</h3>
        <p>Wipe your data from inside the app in a few taps. Deletion is permanent and propagates to our servers.</p>
      </div>
      <div class="right-card" role="listitem">
        <div class="num">\u25CF RIGHT 02</div>
        <h3>Access your info</h3>
        <p>Request a copy of everything we have on file. We'll send it back in a readable format, not a wall of JSON.</p>
      </div>
      <div class="right-card" role="listitem">
        <div class="num">\u25CF RIGHT 03</div>
        <h3>Portable export</h3>
        <p>Want to take your data elsewhere? We'll provide it in a standard, machine-readable format you can actually use.</p>
      </div>
      <div class="right-card" role="listitem">
        <div class="num">\u25CF RIGHT 04</div>
        <h3>Correct or restrict</h3>
        <p>Fix anything that's wrong, pause processing, or tell us to stop \u2014 we'll honor it and confirm in writing.</p>
      </div>
    </div>
  </div>
</section>

<!-- =========================================================
     05 \xB7 RETENTION
     ========================================================= -->
<section class="privacy-section" id="retention" aria-labelledby="s5-title">
  <div class="section-inner">
    <div class="section-divider">
      <span>05 / RETENTION \u25B8 LIFECYCLE</span>
      <span>PURGE \u25CF ON-DEMAND \xB7 v1.0</span>
    </div>

    <div class="section-head reveal">
      <h2 id="s5-title">Data <span class="accent">retention</span>.</h2>
      <div class="head-note"><span class="k">\u25CF</span>Only as long as we need to.</div>
    </div>

    <p class="body-copy reveal">
      We retain your information <strong>only as long as necessary</strong> to provide the service \u2014 which, in practice, means as long as you have an active account.
    </p>

    <p class="body-copy reveal">
      When you delete your data (or your account), it's <strong>permanently removed</strong> from our systems. Backups roll off on a scheduled cadence so old snapshots don't linger indefinitely.
    </p>
  </div>
</section>

<!-- =========================================================
     06 \xB7 CHILDREN'S PRIVACY
     ========================================================= -->
<section class="privacy-section" id="children" aria-labelledby="s6-title">
  <div class="section-inner">
    <div class="section-divider">
      <span>06 / MINORS \u25B8 AGE GATE</span>
      <span>POLICY \u25CF ENFORCED \xB7 v1.0</span>
    </div>

    <div class="section-head reveal">
      <h2 id="s6-title">Children's <span class="accent">privacy</span>.</h2>
      <div class="head-note"><span class="k">\u25CF</span>Not built for kids. Full stop.</div>
    </div>

    <p class="body-copy reveal">
      PulseKegel is not intended for children under <strong>13</strong>. We do not knowingly collect personal information from minors. If we learn we've received data from a child, we'll delete it promptly.
    </p>

    <p class="body-copy reveal">
      If you're a parent or guardian and believe your child has given us information, email <a href="mailto:info@pulsekegel.com">info@pulsekegel.com</a> \u2014 we'll take care of it.
    </p>
  </div>
</section>

<!-- =========================================================
     07 \xB7 POLICY CHANGES
     ========================================================= -->
<section class="privacy-section" id="changes" aria-labelledby="s7-title">
  <div class="section-inner">
    <div class="section-divider">
      <span>07 / CHANGES \u25B8 VERSION CONTROL</span>
      <span>CHANGELOG \u25CF PUBLIC \xB7 v1.0</span>
    </div>

    <div class="section-head reveal">
      <h2 id="s7-title">Changes to <span class="accent">this policy</span>.</h2>
      <div class="head-note"><span class="k">\u25CF</span>Material changes, clear heads-up.</div>
    </div>

    <p class="body-copy reveal">
      We may update this policy as the app evolves or as regulations change. When we do, we'll bump the <strong>Last updated</strong> date at the top of this page.
    </p>

    <p class="body-copy reveal">
      If a change is <strong>material</strong> \u2014 anything that meaningfully affects how your data is handled \u2014 we'll notify you directly, through the app or by email, before it takes effect. You'll always have the option to review and opt out.
    </p>
  </div>
</section>

<!-- =========================================================
     08 \xB7 CONTACT
     ========================================================= -->
<section class="contact-block" id="contact" aria-labelledby="contact-title">
  <span class="bracket tl" aria-hidden="true"></span>
  <span class="bracket tr" aria-hidden="true"></span>
  <span class="bracket bl" aria-hidden="true"></span>
  <span class="bracket br" aria-hidden="true"></span>

  <div class="eyebrow reveal">08 \xB7 Contact</div>
  <h2 id="contact-title" class="reveal">
    Questions?<br />
    <span class="accent">We actually read these.</span>
  </h2>
  <p class="reveal">
    If anything in this policy is unclear, or you want to exercise any of the rights above, write to us. A real person will get back to you.
  </p>
  <a class="contact-email reveal" href="mailto:info@pulsekegel.com" aria-label="Email info@pulsekegel.com">
    <span class="k">WRITE TO</span>
    <span class="sep" aria-hidden="true"></span>
    <span>info@pulsekegel.com</span>
  </a>
</section>

<!-- =========================================================
     FOOTER
     ========================================================= -->
<footer class="page-footer">
  <div class="footer-main">
    <div class="footer-col brand-col">
      <a class="wordmark" href="https://pulsekegel.com/" aria-label="PulseKegel home">
        <span class="dot" aria-hidden="true"></span>
        PulseKegel
      </a>
      <p class="tag">Private, evidence-based pelvic floor training. Built for the one muscle nobody talks about.</p>
    </div>

    <div class="footer-col">
      <h4>Navigate</h4>
      <ul>
        <li><a href="https://pulsekegel.com/">Home</a></li>
        <li><a href="https://pulsekegel.com/blog/">Blog</a></li>
        <li><a href="https://pulsekegel.com/privacy" aria-current="page">Privacy</a></li>
      </ul>
    </div>

    <div class="footer-col">
      <h4>Get the App</h4>
      <ul>
        <li><a href="https://apps.apple.com/us/app/pulsekegel/id6758308054" target="_blank" rel="noopener">App Store</a></li>
        <li><a href="https://play.google.com/store/apps/details?id=com.pulsekegel.app&pcampaignid=web_share" target="_blank" rel="noopener">Google Play</a></li>
      </ul>
    </div>

    <div class="footer-col">
      <h4>Follow</h4>
      <div class="social-row">
        <a href="https://www.facebook.com/profile.php?id=61570994844642" target="_blank" rel="noopener" aria-label="Facebook">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M22 12A10 10 0 1 0 10.5 21.9v-7H8v-3h2.5V9.3c0-2.5 1.5-3.9 3.7-3.9 1.1 0 2.2.2 2.2.2v2.4h-1.2c-1.2 0-1.6.8-1.6 1.6V12h2.7l-.4 3h-2.3v7A10 10 0 0 0 22 12z"/></svg>
        </a>
        <a href="https://www.instagram.com/pulsekegel/" target="_blank" rel="noopener" aria-label="Instagram">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.2c3.2 0 3.6 0 4.8.1 1.2 0 1.8.3 2.3.4.6.2 1 .5 1.4.9.4.4.7.9.9 1.4.2.5.4 1.1.4 2.3.1 1.3.1 1.7.1 4.8s0 3.6-.1 4.8c0 1.2-.3 1.8-.4 2.3-.2.6-.5 1-.9 1.4-.4.4-.9.7-1.4.9-.5.2-1.1.4-2.3.4-1.3.1-1.7.1-4.8.1s-3.6 0-4.8-.1c-1.2 0-1.8-.3-2.3-.4-.6-.2-1-.5-1.4-.9-.4-.4-.7-.9-.9-1.4-.2-.5-.4-1.1-.4-2.3C2.2 15.6 2.2 15.2 2.2 12s0-3.6.1-4.8c0-1.2.3-1.8.4-2.3.2-.6.5-1 .9-1.4.4-.4.9-.7 1.4-.9.5-.2 1.1-.4 2.3-.4 1.3-.1 1.7-.1 4.8-.1m0-2.2C8.7 0 8.3 0 7 .1c-1.3.1-2.2.3-3 .6-.8.3-1.6.8-2.3 1.5C1 2.9.6 3.7.3 4.5c-.3.8-.5 1.7-.6 3C-.4 8.7-.4 9.1-.4 12.4s0 3.7.1 5c.1 1.3.3 2.2.6 3 .3.8.8 1.6 1.5 2.3.7.7 1.5 1.1 2.3 1.5.8.3 1.7.5 3 .6 1.3.1 1.7.1 5 .1s3.7 0 5-.1c1.3-.1 2.2-.3 3-.6.8-.3 1.6-.8 2.3-1.5.7-.7 1.1-1.5 1.5-2.3.3-.8.5-1.7.6-3 .1-1.3.1-1.7.1-5s0-3.7-.1-5c-.1-1.3-.3-2.2-.6-3-.3-.8-.8-1.6-1.5-2.3C21.1 1 20.3.6 19.5.3c-.8-.3-1.7-.5-3-.6C15.2 0 14.8 0 11.6 0h.4zm0 5.8a6.2 6.2 0 1 0 0 12.4 6.2 6.2 0 0 0 0-12.4zm0 10.2a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.5-11.9a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z"/></svg>
        </a>
        <a href="https://www.threads.com/@pulsekegel" target="_blank" rel="noopener" aria-label="Threads">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17.6 11.2c-.1 0-.1 0 0 0-.1-2.4-1.5-3.9-3.6-4-.1 0-.2 0-.3 0-1.4 0-2.5.6-3.2 1.6l1.2.8c.5-.7 1.2-1 2-1h.2c.7 0 1.3.2 1.7.6.3.3.5.7.6 1.2-.7-.1-1.5-.2-2.3-.1-2.3.1-3.8 1.4-3.7 3.3 0 1 .5 1.9 1.4 2.4.7.4 1.6.7 2.7.6 1.4-.1 2.4-.6 3.1-1.6.5-.7.8-1.7.9-2.9.6.4 1.1 1 1.3 1.7.5 1.2.5 3.1-1.1 4.7-1.4 1.4-3 2-5.5 2.1-2.7-.1-4.8-1-6.2-2.7-1.3-1.6-2-3.9-2-6.8 0-2.9.7-5.2 2-6.8C6.9 2.5 9 1.6 11.7 1.5c2.7.1 4.9 1 6.3 2.7.7.8 1.2 1.8 1.6 3l1.4-.4c-.4-1.4-1.1-2.6-1.9-3.6C17.3.8 14.7-.3 11.6-.3 8.5-.3 6 .8 4.2 2.9 2.6 4.8 1.8 7.6 1.8 11v.1C1.8 14.5 2.6 17.2 4.2 19.1c1.7 2.1 4.3 3.1 7.4 3.2h.1c2.8 0 4.7-.7 6.3-2.4 2.1-2.1 2.1-4.8 1.3-6.6-.5-1.1-1.3-1.9-2.2-2.4 0 .1.3.1.5.3z"/></svg>
        </a>
        <a href="https://www.tiktok.com/@pulsekegal" target="_blank" rel="noopener" aria-label="TikTok">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19.3 6.5a5.9 5.9 0 0 1-3.5-1.1 5.9 5.9 0 0 1-2.4-4.3h-3.6v14a3 3 0 1 1-2.1-2.9V8.5A6.7 6.7 0 1 0 13.5 15V9.3a9.4 9.4 0 0 0 5.8 2z"/></svg>
        </a>
        <a href="https://www.youtube.com/@PulseKegel" target="_blank" rel="noopener" aria-label="YouTube">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M23 7s-.3-2-1.2-2.8c-1.1-1.2-2.4-1.2-3-1.3C16.1 2.8 12 2.8 12 2.8s-4.1 0-6.8.2c-.6 0-1.9.1-3 1.3C1.3 5 1 7 1 7S.7 9.1.7 11.3v2c0 2.2.3 4.3.3 4.3s.3 2 1.2 2.8c1.1 1.2 2.6 1.1 3.3 1.2C7.2 21.8 12 21.8 12 21.8s4.1 0 6.8-.3c.6 0-1.9-.1 3-1.3.9-.8 1.2-2.8 1.2-2.8s.3-2.1.3-4.3v-2C23.3 9.1 23 7 23 7zm-13.4 8.6V8.4l8.1 3.6-8.1 3.6z"/></svg>
        </a>
      </div>
    </div>
  </div>

  <div class="footer-bottom">
    <div class="left">
      <span>\u25CF</span> \xA9 2026 PulseKegel. All rights reserved.
    </div>
    <div class="right">v1.0 \xB7 VAULT STATUS</div>
  </div>
</footer>

<script>
  /* One-shot reveals on scroll \u2014 same IntersectionObserver pattern
     used on the home page and blog index. */
  (function setupReveals() {
    const targets = document.querySelectorAll('.reveal, .reveal-stagger');
    if (!('IntersectionObserver' in window) || !targets.length) {
      targets.forEach(el => el.classList.add('in-view'));
      return;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in-view');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -5% 0px' });
    targets.forEach(el => io.observe(el));
  })();
</script>

<script>
(function(){var A='https://play.google.com/store/apps/details?id=com.pulsekegel.app&pcampaignid=web_share';if(!/android/i.test(navigator.userAgent))return;var e=document.getElementById('cta-privacy-nav');if(e)e.href=A;})();
</script>
</body>
</html>
`;

// server/db.ts
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

// shared/schema.ts
var schema_exports = {};
__export(schema_exports, {
  analyticsEvents: () => analyticsEvents,
  insertUserSchema: () => insertUserSchema,
  users: () => users
});
import { sql } from "drizzle-orm";
import { pgTable, text, varchar, serial, jsonb, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
var users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull()
});
var insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true
});
var analyticsEvents = pgTable(
  "analytics_events",
  {
    id: serial("id").primaryKey(),
    deviceId: varchar("device_id", { length: 64 }).notNull(),
    eventType: varchar("event_type", { length: 50 }).notNull(),
    eventData: jsonb("event_data"),
    platform: varchar("platform", { length: 10 }),
    appVersion: varchar("app_version", { length: 20 }),
    createdAt: timestamp("created_at").defaultNow().notNull()
  },
  (table) => [
    index("analytics_device_id_idx").on(table.deviceId),
    index("analytics_event_type_idx").on(table.eventType),
    index("analytics_created_at_idx").on(table.createdAt)
  ]
);

// server/db.ts
if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set \u2014 ensure the database is provisioned");
}
var pool = new Pool({
  connectionString: process.env.DATABASE_URL
});
var db = drizzle(pool, { schema: schema_exports });

// server/routes.ts
import { sql as sql2, countDistinct } from "drizzle-orm";
var __filename = fileURLToPath(import.meta.url);
var __dirname = dirname(__filename);
var APP_VERSION = "0.0.0";
try {
  const appJson = JSON.parse(readFileSync(join(process.cwd(), "app.json"), "utf8"));
  APP_VERSION = appJson?.expo?.extra?.minimumVersion ?? appJson?.expo?.version ?? "0.0.0";
} catch {
}
var analyticsDashboardHtml = "";
try {
  analyticsDashboardHtml = readFileSync(
    join(__dirname, "templates", "analytics-dashboard.html"),
    "utf8"
  );
} catch {
  analyticsDashboardHtml = "<h1>Analytics dashboard template not found.</h1>";
}
var openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL
});
function readLastmod(filePath) {
  try {
    const firstLine = readFileSync(filePath, "utf8").split("\n")[0].trim();
    const match = firstLine.match(/^<!--lastmod:(\d{4}-\d{2}-\d{2})-->$/);
    if (match)
      return match[1];
  } catch {
  }
  return statSync(filePath).mtime.toISOString().slice(0, 10);
}
var BLOG_SLUGS_TTL_MS = parseInt(process.env.BLOG_SLUGS_TTL_MS ?? "", 10) || 5 * 60 * 1e3;
var blogSlugsCache = null;
function readBlogTitle(filePath, slug) {
  try {
    const html = readFileSync(filePath, "utf8");
    const match = html.match(/<title>([^<]+)<\/title>/i);
    if (match)
      return match[1].trim();
  } catch {
  }
  return slug;
}
function readBlogDescription(filePath) {
  try {
    const html = readFileSync(filePath, "utf8");
    const metaTagRegex = /<meta\s+[^>]+>/gi;
    let tag;
    while ((tag = metaTagRegex.exec(html)) !== null) {
      const t = tag[0];
      if (!/\bname=(?:"description"|'description')/i.test(t))
        continue;
      const dq = t.match(/\bcontent="([^"]*)"/i);
      if (dq)
        return dq[1].trim();
      const sq = t.match(/\bcontent='([^']*)'/i);
      if (sq)
        return sq[1].trim();
    }
  } catch {
  }
  return "";
}
function invalidateSitemapCache() {
  blogSlugsCache = null;
}
function discoverBlogSlugs() {
  const now = Date.now();
  if (blogSlugsCache && now < blogSlugsCache.expiresAt) {
    return blogSlugsCache.slugs;
  }
  const blogDirs = [
    join(process.cwd(), "static-build", "blog"),
    join(process.cwd(), "blog-content")
  ];
  const seen = /* @__PURE__ */ new Set();
  const slugs = [];
  for (const dir of blogDirs) {
    if (!existsSync(dir))
      continue;
    for (const f of readdirSync(dir)) {
      if (!f.endsWith(".html") || f === "index.html")
        continue;
      const slug = f.replace(/\.html$/, "");
      if (seen.has(slug))
        continue;
      seen.add(slug);
      const filePath = join(dir, f);
      slugs.push({ slug, lastmod: readLastmod(filePath), title: readBlogTitle(filePath, slug), description: readBlogDescription(filePath) });
    }
  }
  slugs.sort((a, b) => a.slug.localeCompare(b.slug));
  blogSlugsCache = { slugs, expiresAt: now + BLOG_SLUGS_TTL_MS };
  return slugs;
}
var FEMALE_HEALTH_BENEFITS = [
  "stronger pelvic floor muscles and endurance",
  "improved core strength and stability",
  "enhanced mind-body awareness and control",
  "reduced lower back tension through core stabilization",
  "improved posture and hip alignment",
  "better circulation and blood flow",
  "enhanced overall muscle coordination",
  "greater confidence in physical activities",
  "better stress management through focused breathing",
  "improved balance and body awareness",
  "stronger foundation for everyday movement",
  "enhanced relaxation and recovery skills"
];
var MALE_HEALTH_BENEFITS = [
  "stronger pelvic floor muscles and endurance",
  "improved core strength and stability",
  "enhanced mind-body awareness and control",
  "stronger core support for lower back health",
  "improved posture and hip alignment",
  "better circulation and blood flow",
  "enhanced athletic performance through core strength",
  "greater confidence in physical activities",
  "better stress management through focused breathing",
  "improved balance and body awareness",
  "stronger foundation for everyday movement",
  "enhanced relaxation and recovery skills"
];
function buildFallback(daysWorkedOut, scheduledDays, weekNumber) {
  if (daysWorkedOut === 0) {
    return `Week ${weekNumber} passed without a session. That happens, but it means starting from scratch on the streak. This week is a clean slate \u2014 one session is all it takes to get back on track.`;
  }
  const missedDays = Math.max(0, scheduledDays - daysWorkedOut);
  if (missedDays === 0) {
    return `${daysWorkedOut} sessions completed this week \u2014 the full schedule. That kind of consistency is exactly what builds real, lasting results. Carry that momentum into next week.`;
  }
  if (daysWorkedOut >= 3 && missedDays <= 2) {
    return `${daysWorkedOut} of ${scheduledDays} sessions done this week \u2014 ${missedDays} missed. The progress is real, but the full week is where the results compound. Aim to close that gap next week.`;
  }
  return `${daysWorkedOut} of ${scheduledDays} scheduled sessions completed this week \u2014 ${missedDays} missed. That is not the week you needed. Next week, start on day one and do not let the first miss become two.`;
}
async function registerRoutes(app2) {
  app2.use("/sounds", express.static(resolve(process.cwd(), "client", "assets", "sounds")));
  app2.post("/api/invalidate-sitemap-cache", (req, res) => {
    const token = process.env.INVALIDATE_CACHE_TOKEN;
    if (token) {
      const auth = req.headers.authorization ?? "";
      if (auth !== `Bearer ${token}`) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
    }
    invalidateSitemapCache();
    res.json({ ok: true, message: "Sitemap cache cleared" });
  });
  app2.post("/api/weekly-review", async (req, res) => {
    const { daysWorkedOut, weekNumber, totalMinutes, anatomyType, userName, currentStreak } = req.body;
    const scheduledDays = weekNumber <= 2 ? 3 : weekNumber <= 6 ? 5 : weekNumber <= 10 ? 7 : 5;
    const missedDays = Math.max(0, scheduledDays - (daysWorkedOut || 0));
    const streak = typeof currentStreak === "number" ? currentStreak : 0;
    try {
      const benefits = anatomyType === "male" ? MALE_HEALTH_BENEFITS : FEMALE_HEALTH_BENEFITS;
      const benefitIndex = (weekNumber - 1) % benefits.length;
      const weekBenefit = benefits[benefitIndex];
      const anatomyLabel = anatomyType === "male" ? "male" : "female";
      let modeInstructions;
      if (daysWorkedOut === 0) {
        modeInstructions = `This person completed 0 of ${scheduledDays} scheduled sessions this week \u2014 they did not train at all. Acknowledge that plainly and directly. Do not open with praise or pivot quickly to encouragement. The second or third sentence can note what picking it back up looks like. End with one brief forward-looking sentence.`;
      } else if (missedDays === 0) {
        modeInstructions = `This person hit every session this week: ${daysWorkedOut} of ${scheduledDays} scheduled.${streak > 1 ? ` Their current streak is ${streak} days.` : ""} Celebrate this with specific reference to their session count${streak > 1 ? ` and streak` : ""}. Make the praise feel earned \u2014 reference the actual numbers, not generic effort.`;
      } else if (daysWorkedOut >= 3 && missedDays <= 2) {
        const streakNote = streak > 1 ? ` Their current streak is ${streak} days, which means those missed sessions did not break momentum entirely.` : ` Their streak did not hold this week.`;
        modeInstructions = `This person completed ${daysWorkedOut} of ${scheduledDays} scheduled sessions this week, missing ${missedDays}.${streakNote} Acknowledge the missed sessions by number \u2014 do not skip over it. Note that the full week of consistency is what compounds into results. Encourage them to close that gap next week. Tone: honest and supportive, not punishing.`;
      } else {
        modeInstructions = `This person completed only ${daysWorkedOut} of ${scheduledDays} scheduled sessions this week \u2014 missing ${missedDays}.${streak <= 1 ? " Their streak was broken." : ""} Be direct: state the missed session count clearly. Do not lead with praise or bury the accountability. Challenge them to do better next week. End with one forward-looking sentence. Tone: firm and honest, but not harsh.`;
      }
      const prompt = `Write a 3-4 sentence weekly fitness review for a pelvic floor training app.
${userName ? `Start with "${userName},"` : "Do not use a name."}
Week ${weekNumber}, ${anatomyLabel} anatomy.
${modeInstructions}
Weave in this fitness benefit naturally (do not force it if it disrupts the tone): "${weekBenefit}"
Rules: exactly 3-4 sentences. No filler phrases like "Great job!", "Keep it up!", or "You're doing amazing!". No medical conditions, surgeries, diagnoses, or health problems. No quotes in the response.`;
      const response = await openai.chat.completions.create({
        model: "gpt-5-nano",
        messages: [{ role: "user", content: prompt }]
      });
      const message = response.choices[0]?.message?.content || buildFallback(daysWorkedOut, scheduledDays, weekNumber);
      res.json({ message });
    } catch (error) {
      console.error("Error generating weekly review:", error);
      res.json({ message: buildFallback(daysWorkedOut, scheduledDays, weekNumber) });
    }
  });
  app2.get("/favicon.png", (_req, res) => {
    const paths = [
      join(__dirname, "public", "favicon.png"),
      join(__dirname, "..", "server", "public", "favicon.png"),
      join(process.cwd(), "server", "public", "favicon.png")
    ];
    for (const p of paths) {
      if (existsSync(p)) {
        return res.sendFile(p);
      }
    }
    res.status(404).send("Not found");
  });
  app2.get("/pulsekegel-infographic.jpg", (_req, res) => {
    const paths = [
      join(__dirname, "public", "pulsekegel-infographic.jpg"),
      join(__dirname, "..", "server", "public", "pulsekegel-infographic.jpg"),
      join(process.cwd(), "server", "public", "pulsekegel-infographic.jpg")
    ];
    for (const p of paths) {
      if (existsSync(p)) {
        res.setHeader("Content-Type", "image/jpeg");
        res.setHeader("Cache-Control", "public, max-age=31536000");
        return res.sendFile(p);
      }
    }
    res.status(404).send("Not found");
  });
  app2.get("/llms.txt", (_req, res) => {
    const blogPosts = discoverBlogSlugs();
    const blogLines = [
      "- Blog index: https://pulsekegel.com/blog",
      ...blogPosts.map(({ slug, title, description }) => {
        const suffix = description ? ` (${description})` : "";
        return `- ${title}: https://pulsekegel.com/blog/${slug}${suffix}`;
      })
    ].join("\n");
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.send(`# PulseKegel

> PulseKegel is an iOS app that guides men through daily pelvic floor (Kegel) workouts using a 12-week progressive program, real-time visual cues, and haptic feedback. Workouts take 5\u201310 minutes a day with no equipment.

## App

- Platform: iOS (App Store: https://apps.apple.com/us/app/pulsekegel/id6758308054)
- Free 7-day trial, then subscription
- Android version planned

## Program Structure

- 12-week program divided into four phases: Control (weeks 1\u20132), Strength (weeks 3\u20136), Power (weeks 7\u201310), Maintenance (weeks 11\u201312)
- 7 exercise types: slow holds, quick flicks, elevator kegels, reverse kegels, contract-relax, breathing coordination, block rests
- Rest days include optional 5-minute guided breathwork sessions (Calm & Reset, Energize & Focus, Pelvic Floor Connect)
- Workouts: 3\u201310 minutes depending on week

## Key Features

- Real-time SQUEEZE / REST / BREATHE visual cues with LED power bar and circular progress ring
- Haptic feedback tuned per exercise type and intensity
- Progress tracking: streak counter, calendar view, 19 achievement badges
- AI-generated weekly progress insights
- Configurable daily reminder notifications
- Recovery mode for reduced-intensity sessions
- Sound effects and optional ambient audio during workouts
- Light and dark themes

## Who It Is For

- Men who want to improve bladder control, core coordination, or recovery after prostate surgery
- Men who have never been shown how to locate or train the pelvic floor
- Anyone following a structured, progressive approach to pelvic floor fitness

## Blog & Resources

${blogLines}

## Links

- Website: https://pulsekegel.com/
- Privacy policy: https://pulsekegel.com/privacy
- Sitemap: https://pulsekegel.com/sitemap.xml
`);
  });
  app2.get("/robots.txt", (_req, res) => {
    res.setHeader("Content-Type", "text/plain");
    res.send(`User-agent: *
Allow: /
Disallow: /api/

Sitemap: https://pulsekegel.com/sitemap.xml

# AI index: https://pulsekegel.com/llms.txt
`);
  });
  app2.get("/sitemap.xml", (_req, res) => {
    const today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
    const staticUrls = `  <url>
    <loc>https://pulsekegel.com/</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://pulsekegel.com/privacy</loc>
    <lastmod>${today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.3</priority>
  </url>
  <url>
    <loc>https://pulsekegel.com/blog</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>https://pulsekegel.com/music</loc>
    <lastmod>${today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.5</priority>
  </url>`;
    const blogUrls = discoverBlogSlugs().map(
      ({ slug, lastmod }) => `  <url>
    <loc>https://pulsekegel.com/blog/${slug}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>`
    ).join("\n");
    res.setHeader("Content-Type", "application/xml");
    res.send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${staticUrls}
${blogUrls}
</urlset>`);
  });
  app2.get(["/blog", "/blog/"], (_req, res) => {
    const blogIndex = join(process.cwd(), "static-build", "blog", "index.html");
    if (existsSync(blogIndex)) {
      return res.sendFile(blogIndex);
    }
    res.status(404).send("Not found");
  });
  app2.get("/blog/:slug", (req, res) => {
    const slug = req.params.slug;
    if (slug.endsWith(".html")) {
      return res.redirect(301, `/blog/${slug.replace(".html", "")}`);
    }
    const staticPath = join(process.cwd(), "static-build", "blog", `${slug}.html`);
    if (existsSync(staticPath)) {
      return res.sendFile(staticPath);
    }
    const contentPath = join(process.cwd(), "blog-content", `${slug}.html`);
    if (existsSync(contentPath)) {
      return res.sendFile(contentPath);
    }
    res.status(404).send("Not found");
  });
  app2.get("/music", (_req, res) => {
    const musicPagePath = join(__dirname, "templates", "music-page.html");
    if (existsSync(musicPagePath)) {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      return res.sendFile(musicPagePath);
    }
    res.status(404).send("Not found");
  });
  app2.get("/privacy", (_req, res) => {
    res.setHeader("Content-Type", "text/html");
    res.send(privacyPolicyHtml);
  });
  app2.get("/analytics", (_req, res) => {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("X-Robots-Tag", "noindex, nofollow");
    res.send(analyticsDashboardHtml);
  });
  app2.get("/api/version-check", (_req, res) => {
    res.json({
      minimumVersion: APP_VERSION,
      iosStoreUrl: "https://apps.apple.com/app/id6758308054",
      androidStoreUrl: "https://play.google.com/store/apps/details?id=com.pulsekegel.app"
    });
  });
  const ANALYTICS_RATE_LIMIT = 60;
  const ANALYTICS_RATE_WINDOW_MS = 6e4;
  const ANALYTICS_MAX_EVENTS = 20;
  const ANALYTICS_RATE_MAP_MAX = 1e4;
  const analyticsRateMap = /* @__PURE__ */ new Map();
  setInterval(() => {
    const now = Date.now();
    for (const [ip, bucket] of analyticsRateMap) {
      if (now >= bucket.resetAt) {
        analyticsRateMap.delete(ip);
      }
    }
  }, 5 * 6e4).unref();
  app2.post("/api/analytics", async (req, res) => {
    const ip = req.ip ?? "unknown";
    const now = Date.now();
    let bucket = analyticsRateMap.get(ip);
    if (!bucket || now >= bucket.resetAt) {
      if (!bucket && analyticsRateMap.size >= ANALYTICS_RATE_MAP_MAX) {
        for (const [key, entry] of analyticsRateMap) {
          if (now >= entry.resetAt) {
            analyticsRateMap.delete(key);
          }
          if (analyticsRateMap.size < ANALYTICS_RATE_MAP_MAX)
            break;
        }
        if (analyticsRateMap.size >= ANALYTICS_RATE_MAP_MAX) {
          analyticsRateMap.delete(analyticsRateMap.keys().next().value);
        }
      }
      bucket = { count: 0, resetAt: now + ANALYTICS_RATE_WINDOW_MS };
      analyticsRateMap.set(ip, bucket);
    }
    bucket.count += 1;
    if (bucket.count > ANALYTICS_RATE_LIMIT) {
      const retryAfterSeconds = Math.ceil((bucket.resetAt - now) / 1e3);
      res.setHeader("Retry-After", retryAfterSeconds);
      res.status(429).json({ error: "Too many requests \u2014 please slow down" });
      return;
    }
    const { deviceId, events } = req.body ?? {};
    if (!deviceId || !Array.isArray(events) || events.length === 0) {
      res.status(400).json({ error: "deviceId and events are required" });
      return;
    }
    if (events.length > ANALYTICS_MAX_EVENTS) {
      res.status(400).json({ error: `Batch too large \u2014 max ${ANALYTICS_MAX_EVENTS} events per request` });
      return;
    }
    try {
      const rows = events.map((e) => ({
        deviceId: String(deviceId).slice(0, 64),
        eventType: String(e.type ?? "unknown").slice(0, 50),
        eventData: e.data ?? {},
        platform: e.platform ? String(e.platform).slice(0, 10) : null,
        appVersion: e.appVersion ? String(e.appVersion).slice(0, 20) : null,
        createdAt: e.occurredAt ? new Date(e.occurredAt) : /* @__PURE__ */ new Date()
      }));
      await db.insert(analyticsEvents).values(rows);
      res.json({ ok: true });
    } catch (err) {
      console.error("Analytics ingest error:", err);
      res.status(500).json({ error: "Failed to record events" });
    }
  });
  app2.get("/api/analytics/summary", async (_req, res) => {
    try {
      const now = /* @__PURE__ */ new Date();
      const h24 = new Date(now.getTime() - 24 * 60 * 60 * 1e3);
      const d7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1e3);
      const d30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1e3);
      const [totalDevices] = await db.select({ count: countDistinct(analyticsEvents.deviceId) }).from(analyticsEvents);
      const [dau] = await db.select({ count: countDistinct(analyticsEvents.deviceId) }).from(analyticsEvents).where(sql2`${analyticsEvents.createdAt} >= ${h24}`);
      const [wau] = await db.select({ count: countDistinct(analyticsEvents.deviceId) }).from(analyticsEvents).where(sql2`${analyticsEvents.createdAt} >= ${d7}`);
      const [mau] = await db.select({ count: countDistinct(analyticsEvents.deviceId) }).from(analyticsEvents).where(sql2`${analyticsEvents.createdAt} >= ${d30}`);
      const eventCounts = await db.select({
        eventType: analyticsEvents.eventType,
        count: sql2`count(*)::int`
      }).from(analyticsEvents).groupBy(analyticsEvents.eventType).orderBy(sql2`count(*) desc`);
      const [newDevicesWeek] = await db.select({ count: countDistinct(analyticsEvents.deviceId) }).from(analyticsEvents).where(
        sql2`${analyticsEvents.deviceId} not in (
            select distinct device_id from analytics_events
            where created_at < ${d7}
          )`
      );
      const topWeeklyDevicesRaw = await db.select({
        eventCount: sql2`count(*)::int`
      }).from(analyticsEvents).where(sql2`${analyticsEvents.createdAt} >= ${d7}`).groupBy(analyticsEvents.deviceId).orderBy(sql2`count(*) desc`).limit(10);
      const topWeeklyDevices = topWeeklyDevicesRaw.map((row, i) => ({
        rank: i + 1,
        eventCount: row.eventCount
      }));
      const dailyUniqueUsersRaw = await db.execute(
        sql2`
          SELECT
            to_char(days.day, 'YYYY-MM-DD') AS date,
            COUNT(DISTINCT ae.device_id)::int AS count
          FROM generate_series(
            date_trunc('day', NOW() AT TIME ZONE 'UTC') - INTERVAL '29 days',
            date_trunc('day', NOW() AT TIME ZONE 'UTC'),
            INTERVAL '1 day'
          ) AS days(day)
          LEFT JOIN analytics_events ae
            ON date_trunc('day', ae.created_at AT TIME ZONE 'UTC') = days.day
          GROUP BY days.day
          ORDER BY days.day
        `
      );
      const devicesByPlatformRaw = await db.execute(
        sql2`
          SELECT
            COALESCE(platform, 'unknown') AS platform,
            COUNT(DISTINCT device_id)::int AS count
          FROM analytics_events
          GROUP BY COALESCE(platform, 'unknown')
          ORDER BY count DESC
        `
      );
      const challengeResultBreakdownRaw = await db.execute(
        sql2`
          SELECT
            event_data->>'result' AS result,
            COUNT(DISTINCT device_id)::int AS count
          FROM analytics_events
          WHERE event_type = 'challenge_result_viewed'
            AND event_data->>'result' IS NOT NULL
          GROUP BY event_data->>'result'
          ORDER BY count DESC
        `
      );
      const wauByPlatformRaw = await db.execute(
        sql2`
          SELECT
            COALESCE(platform, 'unknown') AS platform,
            COUNT(DISTINCT device_id)::int AS count
          FROM analytics_events
          WHERE created_at >= ${d7}
          GROUP BY COALESCE(platform, 'unknown')
          ORDER BY count DESC
        `
      );
      const [installsNoChallenge] = await db.select({ count: countDistinct(analyticsEvents.deviceId) }).from(analyticsEvents).where(
        sql2`${analyticsEvents.deviceId} NOT IN (
            SELECT DISTINCT device_id FROM analytics_events
            WHERE event_type = 'session_complete'
          )`
      );
      const [neverOnboarded] = await db.select({ count: countDistinct(analyticsEvents.deviceId) }).from(analyticsEvents).where(
        sql2`${analyticsEvents.eventType} = 'app_open'
            AND ${analyticsEvents.deviceId} NOT IN (
              SELECT DISTINCT device_id FROM analytics_events
              WHERE event_type = 'onboarding_complete'
            )`
      );
      const retentionRaw = await db.execute(
        sql2`
          WITH cohort AS (
            SELECT device_id, MIN(created_at) AS first_seen
            FROM analytics_events
            GROUP BY device_id
          )
          SELECT 'D1' AS period,
            COUNT(*)::int AS total,
            COUNT(CASE WHEN EXISTS (
              SELECT 1 FROM analytics_events r
              WHERE r.device_id = cohort.device_id
                AND r.created_at >= cohort.first_seen + INTERVAL '23 hours'
                AND r.created_at <  cohort.first_seen + INTERVAL '48 hours'
            ) THEN 1 END)::int AS returned
          FROM cohort WHERE cohort.first_seen <= NOW() - INTERVAL '1 day'
          UNION ALL
          SELECT 'D7',
            COUNT(*)::int,
            COUNT(CASE WHEN EXISTS (
              SELECT 1 FROM analytics_events r
              WHERE r.device_id = cohort.device_id
                AND r.created_at >= cohort.first_seen + INTERVAL '6 days 23 hours'
                AND r.created_at <  cohort.first_seen + INTERVAL '14 days'
            ) THEN 1 END)::int
          FROM cohort WHERE cohort.first_seen <= NOW() - INTERVAL '7 days'
          UNION ALL
          SELECT 'D30',
            COUNT(*)::int,
            COUNT(CASE WHEN EXISTS (
              SELECT 1 FROM analytics_events r
              WHERE r.device_id = cohort.device_id
                AND r.created_at >= cohort.first_seen + INTERVAL '29 days 23 hours'
                AND r.created_at <  cohort.first_seen + INTERVAL '60 days'
            ) THEN 1 END)::int
          FROM cohort WHERE cohort.first_seen <= NOW() - INTERVAL '30 days'
        `
      );
      const [funnelOnboarded] = await db.select({ count: countDistinct(analyticsEvents.deviceId) }).from(analyticsEvents).where(sql2`${analyticsEvents.eventType} = 'onboarding_complete'`);
      const [funnelSession] = await db.select({ count: countDistinct(analyticsEvents.deviceId) }).from(analyticsEvents).where(sql2`${analyticsEvents.eventType} = 'session_complete'`);
      const programWeekDistRaw = await db.execute(
        sql2`
          SELECT
            event_data->>'programWeek' AS week,
            COUNT(DISTINCT device_id)::int AS count
          FROM analytics_events
          WHERE event_type = 'app_open'
            AND event_data->>'programWeek' IS NOT NULL
            AND created_at >= NOW() - INTERVAL '30 days'
          GROUP BY event_data->>'programWeek'
          ORDER BY (event_data->>'programWeek')::int
        `
      );
      const workoutTypeRaw = await db.execute(
        sql2`
          SELECT
            COALESCE(event_data->>'workoutType', 'unknown') AS "workoutType",
            COUNT(*)::int AS count
          FROM analytics_events
          WHERE event_type = 'session_complete'
          GROUP BY COALESCE(event_data->>'workoutType', 'unknown')
          ORDER BY count DESC
        `
      );
      const anatomySplitRaw = await db.execute(
        sql2`
          SELECT
            COALESCE(event_data->>'anatomyType', 'unknown') AS "anatomyType",
            COUNT(DISTINCT device_id)::int AS count
          FROM analytics_events
          WHERE event_type = 'onboarding_complete'
          GROUP BY COALESCE(event_data->>'anatomyType', 'unknown')
          ORDER BY count DESC
        `
      );
      const appVersionRaw = await db.execute(
        sql2`
          SELECT
            COALESCE(app_version, 'unknown') AS "appVersion",
            COUNT(DISTINCT device_id)::int AS count
          FROM analytics_events
          WHERE created_at >= NOW() - INTERVAL '7 days'
          GROUP BY COALESCE(app_version, 'unknown')
          ORDER BY count DESC
          LIMIT 10
        `
      );
      const [sessionsInWau] = await db.select({ count: sql2`count(*)::int` }).from(analyticsEvents).where(
        sql2`${analyticsEvents.eventType} = 'session_complete'
            AND ${analyticsEvents.createdAt} >= ${d7}`
      );
      const wauCount = Number(wau?.count ?? 0);
      const avgSessionsPerWau = wauCount > 0 ? Math.round(Number(sessionsInWau?.count ?? 0) / wauCount * 10) / 10 : 0;
      const weekCompletionRaw = await db.execute(
        sql2`
          SELECT
            ROUND(
              AVG(
                LEAST(
                  (event_data->>'daysWorkedOut')::numeric
                    / NULLIF((event_data->>'scheduledDays')::numeric, 0),
                  1.0
                )
              ) * 100,
              1
            )::text AS avg_rate,
            COUNT(*)::int AS total_weeks
          FROM analytics_events
          WHERE event_type = 'week_complete'
            AND event_data->>'daysWorkedOut' IS NOT NULL
            AND event_data->>'scheduledDays' IS NOT NULL
            AND created_at >= NOW() - INTERVAL '30 days'
        `
      );
      res.json({
        totalDevices: totalDevices?.count ?? 0,
        dau: dau?.count ?? 0,
        wau: wau?.count ?? 0,
        mau: mau?.count ?? 0,
        newDevicesLast7Days: newDevicesWeek?.count ?? 0,
        installsNoChallenge: installsNoChallenge?.count ?? 0,
        neverOnboarded: neverOnboarded?.count ?? 0,
        eventsByType: eventCounts,
        topWeeklyDevices,
        dailyUniqueUsers: dailyUniqueUsersRaw.rows,
        devicesByPlatform: devicesByPlatformRaw.rows,
        wauByPlatform: wauByPlatformRaw.rows,
        challengeResultBreakdown: challengeResultBreakdownRaw.rows,
        retention: retentionRaw.rows,
        funnel: {
          opens: totalDevices?.count ?? 0,
          onboarded: funnelOnboarded?.count ?? 0,
          sessions: funnelSession?.count ?? 0
        },
        programWeekDist: programWeekDistRaw.rows,
        workoutTypeBreakdown: workoutTypeRaw.rows,
        anatomySplit: anatomySplitRaw.rows,
        appVersionDist: appVersionRaw.rows,
        avgSessionsPerWau,
        weekCompletionRate: {
          avgRate: weekCompletionRaw.rows[0]?.avg_rate ?? null,
          totalWeeks: Number(weekCompletionRaw.rows[0]?.total_weeks ?? 0)
        }
      });
    } catch (err) {
      console.error("Analytics summary error:", err);
      res.status(500).json({ error: "Failed to load analytics summary" });
    }
  });
  app2.delete("/api/analytics/reset", async (req, res) => {
    const token = process.env.INVALIDATE_CACHE_TOKEN;
    if (token) {
      const auth = req.headers.authorization ?? "";
      if (auth !== `Bearer ${token}`) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
    }
    try {
      await db.execute(sql2`TRUNCATE TABLE analytics_events RESTART IDENTITY`);
      res.json({ ok: true, message: "Analytics reset" });
    } catch (err) {
      console.error("Analytics reset error:", err);
      res.status(500).json({ error: "Failed to reset analytics" });
    }
  });
  const httpServer = createServer(app2);
  return httpServer;
}

// server/index.ts
import * as fs from "fs";
import * as path from "path";
var app = express2();
var log = console.log;
function setupCors(app2) {
  app2.use((req, res, next) => {
    const origins = /* @__PURE__ */ new Set();
    if (process.env.REPLIT_DEV_DOMAIN) {
      origins.add(`https://${process.env.REPLIT_DEV_DOMAIN}`);
    }
    if (process.env.REPLIT_DOMAINS) {
      process.env.REPLIT_DOMAINS.split(",").forEach((d) => {
        origins.add(`https://${d.trim()}`);
      });
    }
    const origin = req.header("origin");
    const isLocalhost = origin?.startsWith("http://localhost:") || origin?.startsWith("http://127.0.0.1:");
    if (origin && (origins.has(origin) || isLocalhost)) {
      res.header("Access-Control-Allow-Origin", origin);
      res.header(
        "Access-Control-Allow-Methods",
        "GET, POST, PUT, DELETE, OPTIONS"
      );
      res.header("Access-Control-Allow-Headers", "Content-Type");
      res.header("Access-Control-Allow-Credentials", "true");
    }
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    next();
  });
}
function setupBodyParsing(app2) {
  app2.use(
    express2.json({
      verify: (req, _res, buf) => {
        req.rawBody = buf;
      }
    })
  );
  app2.use(express2.urlencoded({ extended: false }));
}
function setupRequestLogging(app2) {
  app2.use((req, res, next) => {
    const start = Date.now();
    const path2 = req.path;
    let capturedJsonResponse = void 0;
    const originalResJson = res.json;
    res.json = function(bodyJson, ...args) {
      capturedJsonResponse = bodyJson;
      return originalResJson.apply(res, [bodyJson, ...args]);
    };
    res.on("finish", () => {
      if (!path2.startsWith("/api"))
        return;
      const duration = Date.now() - start;
      let logLine = `${req.method} ${path2} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "\u2026";
      }
      log(logLine);
    });
    next();
  });
}
function getAppName() {
  try {
    const appJsonPath = path.resolve(process.cwd(), "app.json");
    const appJsonContent = fs.readFileSync(appJsonPath, "utf-8");
    const appJson = JSON.parse(appJsonContent);
    return appJson.expo?.name || "App Landing Page";
  } catch {
    return "App Landing Page";
  }
}
function serveExpoManifest(platform, res) {
  const manifestPath = path.resolve(
    process.cwd(),
    "static-build",
    platform,
    "manifest.json"
  );
  if (!fs.existsSync(manifestPath)) {
    return res.status(404).json({ error: `Manifest not found for platform: ${platform}` });
  }
  res.setHeader("expo-protocol-version", "1");
  res.setHeader("expo-sfv-version", "0");
  res.setHeader("content-type", "application/json");
  const manifest = fs.readFileSync(manifestPath, "utf-8");
  res.send(manifest);
}
function serveLandingPage({
  req,
  res,
  landingPageTemplate,
  appName
}) {
  const forwardedProto = req.header("x-forwarded-proto");
  const protocol = forwardedProto || req.protocol || "https";
  const forwardedHost = req.header("x-forwarded-host");
  const host = forwardedHost || req.get("host");
  const baseUrl = `${protocol}://${host}`;
  const expsUrl = `${host}`;
  log(`baseUrl`, baseUrl);
  log(`expsUrl`, expsUrl);
  const html = landingPageTemplate.replace(/BASE_URL_PLACEHOLDER/g, baseUrl).replace(/EXPS_URL_PLACEHOLDER/g, expsUrl).replace(/APP_NAME_PLACEHOLDER/g, appName);
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.status(200).send(html);
}
function configureExpoAndLanding(app2) {
  const templatePath = path.resolve(
    process.cwd(),
    "server",
    "templates",
    "landing-page.html"
  );
  const landingPageTemplate = fs.readFileSync(templatePath, "utf-8");
  const appName = getAppName();
  log("Serving static Expo files with dynamic manifest routing");
  app2.use((req, res, next) => {
    if (req.path.startsWith("/api")) {
      return next();
    }
    if (req.path !== "/" && req.path !== "/manifest") {
      return next();
    }
    const platform = req.header("expo-platform");
    if (platform && (platform === "ios" || platform === "android")) {
      return serveExpoManifest(platform, res);
    }
    if (req.path === "/") {
      return serveLandingPage({
        req,
        res,
        landingPageTemplate,
        appName
      });
    }
    next();
  });
  app2.use("/assets", express2.static(path.resolve(process.cwd(), "assets")));
  app2.use(express2.static(path.resolve(process.cwd(), "server", "public")));
  app2.use(express2.static(path.resolve(process.cwd(), "static-build")));
  log("Expo routing: Checking expo-platform header on / and /manifest");
}
function setupIndexingHeaders(app2) {
  app2.use((req, res, next) => {
    if (!req.path.startsWith("/api")) {
      res.setHeader("X-Robots-Tag", "index, follow");
    }
    next();
  });
}
function setupErrorHandler(app2) {
  app2.use((err, _req, res, next) => {
    const error = err;
    const status = error.status || error.statusCode || 500;
    const message = error.message || "Internal Server Error";
    console.error("Internal Server Error:", err);
    if (res.headersSent) {
      return next(err);
    }
    return res.status(status).json({ message });
  });
}
(async () => {
  app.set("trust proxy", 1);
  setupCors(app);
  setupBodyParsing(app);
  setupRequestLogging(app);
  setupIndexingHeaders(app);
  configureExpoAndLanding(app);
  const server = await registerRoutes(app);
  setupErrorHandler(app);
  const port = parseInt(process.env.PORT || "8080", 10);
  server.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true
    },
    () => {
      log(`express server serving on port ${port}`);
    }
  );
})();
