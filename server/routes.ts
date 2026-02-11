import type { Express } from "express";
import { createServer, type Server } from "node:http";
import { join } from "node:path";
import OpenAI from "openai";
import { privacyPolicyHtml, getAboutPageHtml } from "./staticContent";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

const FEMALE_HEALTH_BENEFITS = [
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
  "increased confidence in physical activities",
];

const MALE_HEALTH_BENEFITS = [
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
  "increased confidence in physical activities",
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
    const faviconPath = join(__dirname, 'public', 'favicon.png');
    res.sendFile(faviconPath);
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
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://pulsekegel.com/privacy</loc>
    <changefreq>monthly</changefreq>
    <priority>0.3</priority>
  </url>
  <url>
    <loc>https://pulsekegel.com/about</loc>
    <changefreq>monthly</changefreq>
    <priority>0.5</priority>
  </url>
</urlset>`);
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
