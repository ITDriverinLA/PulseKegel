import type { Express } from "express";
import { createServer, type Server } from "node:http";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import OpenAI from "openai";
import { privacyPolicyHtml, getAboutPageHtml } from "./staticContent";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

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

export async function registerRoutes(app: Express): Promise<Server> {
  // Weekly review AI endpoint
  app.post("/api/weekly-review", async (req, res) => {
    const { daysWorkedOut, weekNumber, totalMinutes, anatomyType, userName } = req.body;
    
    try {
      const weekLabel = weekNumber === 1 ? "their very first week" : 
                        weekNumber === 2 ? "2 weeks" :
                        `${weekNumber} weeks`;
      
      const benefits = anatomyType === 'male' ? MALE_HEALTH_BENEFITS : FEMALE_HEALTH_BENEFITS;
      const benefitIndex = (weekNumber - 1) % benefits.length;
      const weekBenefit = benefits[benefitIndex];
      const anatomyLabel = anatomyType === 'male' ? 'male' : 'female';
      const nameInstruction = userName ? `Address them by name: "${userName}".` : "Do not use any name.";
      
      const prompt = `Write a 2-sentence encouraging fitness message.
${userName ? `Start with "${userName},"` : "No name."}
Week ${weekNumber}${weekNumber === 1 ? " (first week!)" : ""}, ${daysWorkedOut} days, ${anatomyLabel}.
Mention this benefit: "${weekBenefit}"
${daysWorkedOut >= 5 ? "Celebrate dedication." : daysWorkedOut >= 3 ? "Warm encouragement." : "Supportive tone."}
Never reference medical conditions, surgeries, diagnoses, or health problems. Keep the message purely about fitness progress and general wellness.
No quotes in response.`;

      const response = await openai.chat.completions.create({
        model: "gpt-5-nano",
        messages: [{ role: "user", content: prompt }],
      });

      const message = response.choices[0]?.message?.content || "Great work this week! Keep it up!";
      res.json({ message });
    } catch (error) {
      console.error("Error generating weekly review:", error);
      const fallback = weekNumber === 1 
          ? "You did it! Your first week is complete. Keep up the great work!" 
          : `${weekNumber} weeks down! Your consistency is building real strength.`;
      res.json({ message: fallback });
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

  app.get("/robots.txt", (_req, res) => {
    res.setHeader('Content-Type', 'text/plain');
    res.send(`User-agent: *
Allow: /
Disallow: /api/

Sitemap: https://pulsekegel.com/sitemap.xml
`);
  });

  app.get("/sitemap.xml", (_req, res) => {
    res.setHeader('Content-Type', 'application/xml');
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
    <loc>https://pulsekegel.com/about</loc>
    <lastmod>2026-03-17</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.5</priority>
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

  app.get("/about", (_req, res) => {
    res.setHeader('Content-Type', 'text/html');
    res.send(getAboutPageHtml());
  });

  const httpServer = createServer(app);

  return httpServer;
}
