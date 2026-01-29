import type { Express } from "express";
import { createServer, type Server } from "node:http";
import OpenAI from "openai";

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
    const { daysWorkedOut, weekNumber, totalMinutes, anatomyType } = req.body;
    
    try {
      const weekLabel = weekNumber === 1 ? "their very first week" : 
                        weekNumber === 2 ? "2 weeks" :
                        `${weekNumber} weeks`;
      
      const benefits = anatomyType === 'male' ? MALE_HEALTH_BENEFITS : FEMALE_HEALTH_BENEFITS;
      const benefitIndex = (weekNumber - 1) % benefits.length;
      const weekBenefit = benefits[benefitIndex];
      const anatomyLabel = anatomyType === 'male' ? 'male' : 'female';
      
      const prompt = `You are a supportive fitness coach for a pelvic floor exercise app called PulseKegel. 
The user (${anatomyLabel} anatomy) just completed ${weekLabel} of their 12-week program.
They worked out ${daysWorkedOut} out of 7 days this week, totaling ${totalMinutes} minutes of exercise.

This week's health benefit to highlight: "${weekBenefit}"

Write a brief, encouraging message (2-3 sentences max) that:
- For week 1: Celebrate completing their FIRST week! Use phrases like "You did it!" or "Your first week is complete!"
- For week 2+: Acknowledge the milestone with phrases like "${weekNumber} weeks down!" or "That's ${weekNumber} weeks of dedication!"
- Include ONE specific health insight about "${weekBenefit}" that they're building toward
- Make each week's message UNIQUE by focusing on the specific benefit mentioned
- If ${daysWorkedOut} >= 5: Celebrate their dedication
- If ${daysWorkedOut} is 3-4: Encourage them warmly
- If ${daysWorkedOut} < 3: Be understanding and supportive
- Keep it positive, personal, and informative
- NEVER say "another week" - always reference the specific week number

Respond with just the message, no quotes or extra formatting.`;

      const response = await openai.chat.completions.create({
        model: "gpt-5-mini",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 150,
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

  const httpServer = createServer(app);

  return httpServer;
}
