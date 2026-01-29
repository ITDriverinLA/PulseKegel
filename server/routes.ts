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
      
      const prompt = `You are a supportive fitness coach for a pelvic floor exercise app called PulseKegel.

USER INFO:
- Name: ${userName || "not provided"}
- Anatomy: ${anatomyLabel}
- Week completed: ${weekNumber} of 12
- Days worked out this week: ${daysWorkedOut}/7
- Total minutes: ${totalMinutes}

HEALTH BENEFIT TO MENTION THIS WEEK: "${weekBenefit}"

Write a 2-3 sentence encouraging message following these STRICT rules:
${userName ? `1. MUST start the message with "${userName}," - this is required!` : "1. Do not use any name greeting."}
2. ${weekNumber === 1 ? 'Celebrate their FIRST week complete! Say "first week" or "week 1 done"' : `Reference week ${weekNumber} specifically (e.g., "${weekNumber} weeks down!" or "Week ${weekNumber} complete!")`}
3. MUST mention the specific health benefit "${weekBenefit}" - explain how their exercises are helping with this
4. ${daysWorkedOut >= 5 ? "Celebrate their strong dedication!" : daysWorkedOut >= 3 ? "Encourage them warmly." : "Be understanding and supportive."}

Example format${userName ? ` for user named ${userName}` : ""}:
"${userName ? userName + ", " : ""}[celebration of week ${weekNumber}]! [Specific insight about ${weekBenefit}]. [Encouragement based on ${daysWorkedOut} days]."

Respond with ONLY the message, no quotes.`;

      const response = await openai.chat.completions.create({
        model: "gpt-5",
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

  const httpServer = createServer(app);

  return httpServer;
}
