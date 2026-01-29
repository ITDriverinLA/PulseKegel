// server/index.ts
import express2 from "express";

// server/routes.ts
import { createServer } from "node:http";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import express from "express";
import OpenAI from "openai";
var __filename = fileURLToPath(import.meta.url);
var __dirname = dirname(__filename);
function getTemplatesDir() {
  const prodPath = join(__dirname, "templates");
  const devPath = join(__dirname, "..", "server", "templates");
  return existsSync(prodPath) ? prodPath : devPath;
}
function getPublicDir() {
  const prodPath = join(__dirname, "public");
  const devPath = join(__dirname, "..", "server", "public");
  return existsSync(prodPath) ? prodPath : devPath;
}
var openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL
});
var FEMALE_HEALTH_BENEFITS = [
  "improved bladder control and reduced urinary incontinence",
  "stronger pelvic organ support to help prevent prolapse",
  "enhanced intimate sensation and satisfaction",
  "better preparation for pregnancy and faster postpartum recovery",
  "reduced lower back pain through core stabilization",
  "improved posture and hip alignment",
  "better circulation to pelvic organs",
  "reduced symptoms of pelvic floor dysfunction",
  "enhanced core strength and stability",
  "improved bowel function and reduced constipation",
  "better stress management through mind-body connection",
  "increased confidence in physical activities"
];
var MALE_HEALTH_BENEFITS = [
  "improved erectile function and stamina",
  "better bladder control, especially after prostate surgery",
  "enhanced ejaculatory control",
  "reduced risk of prostate-related issues",
  "stronger core support for lower back health",
  "improved posture and hip stability",
  "better circulation to pelvic region",
  "enhanced athletic performance through core strength",
  "reduced symptoms of chronic pelvic pain",
  "improved bowel function and control",
  "better stress management through focused breathing",
  "increased confidence in physical activities"
];
async function registerRoutes(app2) {
  app2.post("/api/weekly-review", async (req, res) => {
    const { daysWorkedOut, weekNumber, totalMinutes, anatomyType, userName } = req.body;
    try {
      const weekLabel = weekNumber === 1 ? "their very first week" : weekNumber === 2 ? "2 weeks" : `${weekNumber} weeks`;
      const benefits = anatomyType === "male" ? MALE_HEALTH_BENEFITS : FEMALE_HEALTH_BENEFITS;
      const benefitIndex = (weekNumber - 1) % benefits.length;
      const weekBenefit = benefits[benefitIndex];
      const anatomyLabel = anatomyType === "male" ? "male" : "female";
      const nameInstruction = userName ? `Address them by name: "${userName}".` : "Do not use any name.";
      const prompt = `Write a 2-sentence encouraging fitness message.
${userName ? `Start with "${userName},"` : "No name."}
Week ${weekNumber}${weekNumber === 1 ? " (first week!)" : ""}, ${daysWorkedOut} days, ${anatomyLabel}.
Mention this benefit: "${weekBenefit}"
${daysWorkedOut >= 5 ? "Celebrate dedication." : daysWorkedOut >= 3 ? "Warm encouragement." : "Supportive tone."}
No quotes in response.`;
      const response = await openai.chat.completions.create({
        model: "gpt-5-nano",
        messages: [{ role: "user", content: prompt }]
      });
      const message = response.choices[0]?.message?.content || "Great work this week! Keep it up!";
      res.json({ message });
    } catch (error) {
      console.error("Error generating weekly review:", error);
      const fallback = weekNumber === 1 ? "You did it! Your first week is complete. Keep up the great work!" : `${weekNumber} weeks down! Your consistency is building real strength.`;
      res.json({ message: fallback });
    }
  });
  const templatesDir = getTemplatesDir();
  const publicDir = getPublicDir();
  app2.get("/privacy", (_req, res) => {
    res.sendFile(join(templatesDir, "privacy-policy.html"));
  });
  app2.get("/about", (_req, res) => {
    res.sendFile(join(templatesDir, "about-page.html"));
  });
  app2.use("/screenshots", express.static(join(publicDir, "screenshots")));
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
      if (!path2.startsWith("/api")) return;
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
  app2.use(express2.static(path.resolve(process.cwd(), "static-build")));
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
  const port = parseInt(process.env.PORT || "5000", 10);
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
