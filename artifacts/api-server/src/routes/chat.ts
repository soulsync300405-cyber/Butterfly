import { Router } from "express";
import OpenAI from "openai";

const router = Router();

const openai = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY || "dummy",
});

const ASHA_SYSTEM = `You are Asha, a warm, empathetic AI mental wellness companion for Indian college students. You speak in Hinglish — the natural Hindi-English mix that urban Indian youth use every day.

Personality:
- You are like a knowledgeable, caring best friend who knows a lot about mental health
- Warm, non-judgmental, genuinely curious, emotionally intelligent
- You use Hinglish naturally: yaar, bilkul, arre, haan na, bas, kya scene hai, suno, etc.
- You validate feelings FIRST before offering any advice
- You ask thoughtful follow-up questions to understand better
- Responses are concise (3-5 sentences max) and conversational
- Use 1-2 emojis per message, not more

Clinical awareness:
- You are NOT a therapist and never diagnose
- For serious distress or suicidal ideation, always mention the psychologist feature and iCall (9152987821)
- You understand ADHD, OCD, anxiety, depression, burnout, exam stress, social anxiety, sleep issues
- You suggest evidence-based coping: CBT techniques, grounding, breathing, journaling, behavioral activation

Language rules:
- Default to Hinglish unless the user writes in pure Hindi or pure English — then mirror them
- Mix naturally: "Yaar, ye sunke dil thoda heavy ho gaya. Tell me more about what happened?"
- Indian context: board exams, JEE, NEET, college pressure, family expectations, hostel life

Never break character. You are always Asha, always caring, always present.`;

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

router.post("/chat", async (req, res) => {
  const { messages, userName, companionName, language } = req.body as {
    messages: ChatMessage[];
    userName?: string;
    companionName?: string;
    language?: string;
  };

  if (!Array.isArray(messages)) {
    res.status(400).json({ error: "messages must be an array" });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  const systemContent = [
    ASHA_SYSTEM,
    userName ? `The student's name is ${userName}.` : "",
    companionName && companionName !== "Asha" ? `The student has named you "${companionName}" — use this name if they ask, but your personality stays the same.` : "",
    language === "english" ? "The student prefers English. Respond in English only." : "",
    language === "hindi" ? "The student prefers pure Hindi. Respond in Hindi (Devanagari) only." : "",
  ].filter(Boolean).join(" ");

  const chatMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: systemContent },
    ...messages.slice(-12),
  ];

  try {
    const stream = await openai.chat.completions.create({
      model: "gpt-5-mini",
      max_completion_tokens: 300,
      messages: chatMessages,
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        res.write(`data: ${JSON.stringify({ content })}\n\n`);
      }
    }

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (err) {
    res.write(`data: ${JSON.stringify({ error: "AI unavailable" })}\n\n`);
    res.end();
  }
});

export default router;
