import type { Express } from "express";
import { createServer, type Server } from "node:http";
import { existsSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import OpenAI from "openai";
import { privacyPolicyHtml } from "./staticContent";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

function discoverBlogSlugs(): { slug: string; lastmod: string }[] {
  const blogDirs = [
    join(process.cwd(), 'static-build', 'blog'),
    join(process.cwd(), 'blog-content'),
  ];
  for (const dir of blogDirs) {
    if (existsSync(dir)) {
      return readdirSync(dir)
        .filter(f => f.endsWith('.html') && f !== 'index.html')
        .sort()
        .map(f => {
          const slug = f.replace(/\.html$/, '');
          const mtime = statSync(join(dir, f)).mtime;
          return { slug, lastmod: mtime.toISOString().slice(0, 10) };
        });
    }
  }
  return [];
}

const BLOG_SITEMAP_ENTRIES = discoverBlogSlugs();

const FEMALE_HEALTH_BENEFITS = [
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
  "enhanced relaxation and recovery skills",
];

const MALE_HEALTH_BENEFITS = [
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
  "enhanced relaxation and recovery skills",
];

function buildFallback(daysWorkedOut: number, scheduledDays: number, weekNumber: number): string {
  if (daysWorkedOut === 0) {
    return `Week ${weekNumber} passed without a session. That happens, but it means starting from scratch on the streak. This week is a clean slate — one session is all it takes to get back on track.`;
  }
  const missedDays = Math.max(0, scheduledDays - daysWorkedOut);
  if (missedDays === 0) {
    return `${daysWorkedOut} sessions completed this week — the full schedule. That kind of consistency is exactly what builds real, lasting results. Carry that momentum into next week.`;
  }
  if (daysWorkedOut >= 3 && missedDays <= 2) {
    return `${daysWorkedOut} of ${scheduledDays} sessions done this week — ${missedDays} missed. The progress is real, but the full week is where the results compound. Aim to close that gap next week.`;
  }
  return `${daysWorkedOut} of ${scheduledDays} scheduled sessions completed this week — ${missedDays} missed. That is not the week you needed. Next week, start on day one and do not let the first miss become two.`;
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Weekly review AI endpoint
  app.post("/api/weekly-review", async (req, res) => {
    const { daysWorkedOut, weekNumber, totalMinutes, anatomyType, userName, currentStreak } = req.body;

    // Derive scheduled sessions from program phase
    const scheduledDays: number =
      weekNumber <= 2 ? 3 :
      weekNumber <= 6 ? 5 :
      weekNumber <= 10 ? 7 : 5;
    const missedDays = Math.max(0, scheduledDays - (daysWorkedOut || 0));
    const streak: number = typeof currentStreak === 'number' ? currentStreak : 0;
    
    try {
      const benefits = anatomyType === 'male' ? MALE_HEALTH_BENEFITS : FEMALE_HEALTH_BENEFITS;
      const benefitIndex = (weekNumber - 1) % benefits.length;
      const weekBenefit = benefits[benefitIndex];
      const anatomyLabel = anatomyType === 'male' ? 'male' : 'female';

      let modeInstructions: string;
      if (daysWorkedOut === 0) {
        modeInstructions = `This person completed 0 of ${scheduledDays} scheduled sessions this week — they did not train at all. Acknowledge that plainly and directly. Do not open with praise or pivot quickly to encouragement. The second or third sentence can note what picking it back up looks like. End with one brief forward-looking sentence.`;
      } else if (missedDays === 0) {
        modeInstructions = `This person hit every session this week: ${daysWorkedOut} of ${scheduledDays} scheduled.${streak > 1 ? ` Their current streak is ${streak} days.` : ''} Celebrate this with specific reference to their session count${streak > 1 ? ` and streak` : ''}. Make the praise feel earned — reference the actual numbers, not generic effort.`;
      } else if (daysWorkedOut >= 3 && missedDays <= 2) {
        const streakNote = streak > 1 ? ` Their current streak is ${streak} days, which means those missed sessions did not break momentum entirely.` : ` Their streak did not hold this week.`;
        modeInstructions = `This person completed ${daysWorkedOut} of ${scheduledDays} scheduled sessions this week, missing ${missedDays}.${streakNote} Acknowledge the missed sessions by number — do not skip over it. Note that the full week of consistency is what compounds into results. Encourage them to close that gap next week. Tone: honest and supportive, not punishing.`;
      } else {
        modeInstructions = `This person completed only ${daysWorkedOut} of ${scheduledDays} scheduled sessions this week — missing ${missedDays}.${streak <= 1 ? ' Their streak was broken.' : ''} Be direct: state the missed session count clearly. Do not lead with praise or bury the accountability. Challenge them to do better next week. End with one forward-looking sentence. Tone: firm and honest, but not harsh.`;
      }

      const prompt = `Write a 3-4 sentence weekly fitness review for a pelvic floor training app.
${userName ? `Start with "${userName},"` : 'Do not use a name.'}
Week ${weekNumber}, ${anatomyLabel} anatomy.
${modeInstructions}
Weave in this fitness benefit naturally (do not force it if it disrupts the tone): "${weekBenefit}"
Rules: exactly 3-4 sentences. No filler phrases like "Great job!", "Keep it up!", or "You're doing amazing!". No medical conditions, surgeries, diagnoses, or health problems. No quotes in the response.`;

      const response = await openai.chat.completions.create({
        model: "gpt-5-nano",
        messages: [{ role: "user", content: prompt }],
      });

      const message = response.choices[0]?.message?.content || buildFallback(daysWorkedOut, scheduledDays, weekNumber);
      res.json({ message });
    } catch (error) {
      console.error("Error generating weekly review:", error);
      res.json({ message: buildFallback(daysWorkedOut, scheduledDays, weekNumber) });
    }
  });

  app.get("/favicon.png", (_req, res) => {
    const paths = [
      join(__dirname, 'public', 'favicon.png'),
      join(__dirname, '..', 'server', 'public', 'favicon.png'),
      join(process.cwd(), 'server', 'public', 'favicon.png'),
    ];
    for (const p of paths) {
      if (existsSync(p)) {
        return res.sendFile(p);
      }
    }
    res.status(404).send('Not found');
  });

  app.get("/pulsekegel-infographic.jpg", (_req, res) => {
    const paths = [
      join(__dirname, 'public', 'pulsekegel-infographic.jpg'),
      join(__dirname, '..', 'server', 'public', 'pulsekegel-infographic.jpg'),
      join(process.cwd(), 'server', 'public', 'pulsekegel-infographic.jpg'),
    ];
    for (const p of paths) {
      if (existsSync(p)) {
        res.setHeader('Content-Type', 'image/jpeg');
        res.setHeader('Cache-Control', 'public, max-age=31536000');
        return res.sendFile(p);
      }
    }
    res.status(404).send('Not found');
  });

  app.get("/robots.txt", (_req, res) => {
    res.setHeader('Content-Type', 'text/plain');
    res.send(`User-agent: *
Allow: /
Disallow: /api/

Sitemap: https://pulsekegel.com/sitemap.xml
`);
  });

  app.get("/sitemap.xml", (_req, res) => {
    const today = new Date().toISOString().slice(0, 10);

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
  </url>`;

    const blogUrls = BLOG_SITEMAP_ENTRIES
      .map(
        ({ slug, lastmod }) => `  <url>
    <loc>https://pulsekegel.com/blog/${slug}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>`
      )
      .join('\n');

    res.setHeader('Content-Type', 'application/xml');
    res.send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${staticUrls}
${blogUrls}
</urlset>`);
  });

  app.get("/blog", (_req, res) => {
    const blogIndex = join(process.cwd(), 'static-build', 'blog', 'index.html');
    if (existsSync(blogIndex)) {
      return res.sendFile(blogIndex);
    }
    res.status(404).send('Not found');
  });

  app.get("/blog/:slug", (req, res) => {
    const slug = req.params.slug;
    if (slug.endsWith('.html')) {
      return res.redirect(301, `/blog/${slug.replace('.html', '')}`);
    }
    const filePath = join(process.cwd(), 'static-build', 'blog', `${slug}.html`);
    if (existsSync(filePath)) {
      return res.sendFile(filePath);
    }
    res.status(404).send('Not found');
  });

  app.get("/privacy", (_req, res) => {
    res.setHeader('Content-Type', 'text/html');
    res.send(privacyPolicyHtml);
  });

  const httpServer = createServer(app);

  return httpServer;
}
