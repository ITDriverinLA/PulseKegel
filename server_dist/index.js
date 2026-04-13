// server/index.ts
import express from "express";

// server/routes.ts
import { createServer } from "node:http";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import OpenAI from "openai";

// server/staticContent.ts
var privacyPolicyHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Privacy Policy - PulseKegel</title>
  <meta name="description" content="PulseKegel privacy policy. Learn how your data is stored locally on your device, what minimal information we collect, and your rights." />
  <link rel="canonical" href="https://pulsekegel.com/privacy" />
  <link rel="icon" type="image/png" href="/favicon.png">
  <link rel="apple-touch-icon" href="/favicon.png">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: linear-gradient(135deg, #0a0a1a 0%, #1a0a2e 25%, #0a1a2e 75%, #0a0a1a 100%); min-height: 100vh; color: #fff; line-height: 1.6; }
    .container { max-width: 800px; margin: 0 auto; padding: 40px 20px; }
    .header { text-align: center; margin-bottom: 40px; padding-bottom: 30px; border-bottom: 1px solid rgba(0, 255, 136, 0.3); }
    .logo { font-size: 32px; font-weight: 700; background: linear-gradient(90deg, #00ff88, #00ffff); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; margin-bottom: 10px; }
    h1 { font-size: 28px; color: #fff; margin-bottom: 20px; }
    .dates { color: rgba(255, 255, 255, 0.6); font-size: 14px; }
    .dates span { display: block; margin: 5px 0; }
    section { margin-bottom: 35px; background: rgba(255, 255, 255, 0.05); border-radius: 16px; padding: 25px; border: 1px solid rgba(0, 255, 136, 0.1); }
    h2 { font-size: 20px; color: #00ff88; margin-bottom: 15px; text-shadow: 0 0 10px rgba(0, 255, 136, 0.3); }
    p { color: rgba(255, 255, 255, 0.85); margin-bottom: 12px; }
    ul { list-style: none; margin-top: 10px; }
    li { position: relative; padding-left: 25px; margin-bottom: 10px; color: rgba(255, 255, 255, 0.85); }
    li::before { content: ''; position: absolute; left: 0; top: 8px; width: 8px; height: 8px; background: #00ffff; border-radius: 50%; box-shadow: 0 0 8px #00ffff; }
    .highlight { color: #00ffff; font-weight: 600; }
    .contact-section { text-align: center; background: linear-gradient(135deg, rgba(0, 255, 136, 0.1), rgba(0, 255, 255, 0.1)); }
    .contact-email { color: #00ff88; text-decoration: none; font-weight: 600; font-size: 18px; }
    .contact-email:hover { text-decoration: underline; }
    .footer { text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid rgba(255, 255, 255, 0.1); color: rgba(255, 255, 255, 0.4); font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <header class="header">
      <div class="logo">PulseKegel</div>
      <h1>Privacy Policy</h1>
      <div class="dates">
        <span>Effective Date: 01/29/2026</span>
        <span>Last Updated: 01/29/2026</span>
      </div>
    </header>
    <section>
      <h2>Information We Collect</h2>
      <p>PulseKegel collects minimal personal information to provide our services:</p>
      <ul>
        <li><span class="highlight">First Name:</span> Used for personalization within the app</li>
        <li><span class="highlight">Anatomy Type:</span> Used to customize app functionality and recommendations</li>
      </ul>
    </section>
    <section>
      <h2>How We Use Your Information</h2>
      <p>The information we collect is used solely for:</p>
      <ul>
        <li>Personalizing your app experience</li>
        <li>Providing relevant content and features based on your anatomy type</li>
        <li>Improving app functionality</li>
      </ul>
    </section>
    <section>
      <h2>Data Storage and Security</h2>
      <p>Your data is stored securely on your device and our servers using industry-standard security measures.</p>
      <p>We do not share, sell, or distribute your personal information to third parties.</p>
    </section>
    <section>
      <h2>Your Rights and Data Control</h2>
      <ul>
        <li><span class="highlight">Data Deletion:</span> You can delete all your personal data at any time by using the delete button within the app</li>
        <li><span class="highlight">Data Access:</span> You have the right to know what data we have about you</li>
        <li><span class="highlight">Data Portability:</span> You can request a copy of your data</li>
      </ul>
    </section>
    <section>
      <h2>Data Retention</h2>
      <p>We retain your information only as long as necessary to provide our services.</p>
      <p>When you delete your data through the app, it is permanently removed from our systems.</p>
    </section>
    <section>
      <h2>Children's Privacy</h2>
      <p>PulseKegel is not intended for children under 13.</p>
      <p>We do not knowingly collect personal information from children under 13.</p>
    </section>
    <section>
      <h2>Changes to This Policy</h2>
      <p>We may update this privacy policy from time to time.</p>
      <p>We will notify users of any material changes through the app or via email.</p>
    </section>
    <section class="contact-section">
      <h2>Contact Us</h2>
      <p>If you have questions about this privacy policy, please contact us at:</p>
      <a href="mailto:info@pulsekegel.com" class="contact-email">info@pulsekegel.com</a>
    </section>
    <footer class="footer">
      <p>PulseKegel - Pelvic Floor Workout App</p>
    </footer>
  </div>
</body>
</html>`;

// server/routes.ts
var __filename = fileURLToPath(import.meta.url);
var __dirname = dirname(__filename);
var openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL
});
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
  app2.get("/robots.txt", (_req, res) => {
    res.setHeader("Content-Type", "text/plain");
    res.send(`User-agent: *
Allow: /
Disallow: /api/

Sitemap: https://pulsekegel.com/sitemap.xml
`);
  });
  app2.get("/sitemap.xml", (_req, res) => {
    res.setHeader("Content-Type", "application/xml");
    res.send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://pulsekegel.com/</loc>
    <lastmod>2026-03-17</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://pulsekegel.com/privacy</loc>
    <lastmod>2026-03-17</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.3</priority>
  </url>
  <url>
    <loc>https://pulsekegel.com/blog</loc>
    <lastmod>2026-03-17</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>https://pulsekegel.com/blog/pelvic-floor-exercises-for-men</loc>
    <lastmod>2026-03-17</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>
  <url>
    <loc>https://pulsekegel.com/blog/how-to-last-longer-naturally</loc>
    <lastmod>2026-03-17</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>
  <url>
    <loc>https://pulsekegel.com/blog/pelvic-floor-recovery-after-childbirth</loc>
    <lastmod>2026-03-17</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>
  <url>
    <loc>https://pulsekegel.com/blog/bladder-control-exercises-over-40</loc>
    <lastmod>2026-03-17</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>
  <url>
    <loc>https://pulsekegel.com/blog/3-minute-pelvic-floor-routine-men</loc>
    <lastmod>2026-03-17</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>
  <url>
    <loc>https://pulsekegel.com/blog/breathing-exercises-better-control-men</loc>
    <lastmod>2026-03-17</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>
  <url>
    <loc>https://pulsekegel.com/blog/postpartum-bladder-confidence-exercises</loc>
    <lastmod>2026-03-17</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>
  <url>
    <loc>https://pulsekegel.com/blog/daily-pelvic-floor-routine-over-40</loc>
    <lastmod>2026-03-17</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>
  <url>
    <loc>https://pulsekegel.com/blog/you-squat-300-but-skip-this-muscle</loc>
    <lastmod>2026-04-11</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>
</urlset>`);
  });
  app2.get("/blog", (_req, res) => {
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
    const filePath = join(process.cwd(), "static-build", "blog", `${slug}.html`);
    if (existsSync(filePath)) {
      return res.sendFile(filePath);
    }
    res.status(404).send("Not found");
  });
  app2.get("/privacy", (_req, res) => {
    res.setHeader("Content-Type", "text/html");
    res.send(privacyPolicyHtml);
  });
  const httpServer = createServer(app2);
  return httpServer;
}

// server/index.ts
import * as fs from "fs";
import * as path from "path";
var app = express();
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
    express.json({
      verify: (req, _res, buf) => {
        req.rawBody = buf;
      }
    })
  );
  app2.use(express.urlencoded({ extended: false }));
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
  app2.use("/assets", express.static(path.resolve(process.cwd(), "assets")));
  app2.use(express.static(path.resolve(process.cwd(), "static-build")));
  log("Expo routing: Checking expo-platform header on / and /manifest");
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
  setupCors(app);
  setupBodyParsing(app);
  setupRequestLogging(app);
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
