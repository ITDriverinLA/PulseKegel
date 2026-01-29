import type { Express } from "express";
import { createServer, type Server } from "node:http";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Weekly review AI endpoint
  app.post("/api/weekly-review", async (req, res) => {
    try {
      const { daysWorkedOut, weekNumber, totalMinutes } = req.body;
      
      const prompt = `You are a supportive fitness coach for a pelvic floor exercise app called PulseKegel. 
The user just completed week ${weekNumber} of their 12-week program.
They worked out ${daysWorkedOut} out of 7 days this week, totaling ${totalMinutes} minutes of exercise.

Write a brief, encouraging congratulations message (2-3 sentences max) that:
- Acknowledges their specific effort this week
- If ${daysWorkedOut} >= 5: Celebrate their dedication
- If ${daysWorkedOut} is 3-4: Encourage them warmly and motivate for next week  
- If ${daysWorkedOut} < 3: Be understanding and supportive, not judgmental
- Keep it positive and personal

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
      res.json({ message: "Congratulations on completing another week! Your consistency is building real strength." });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
