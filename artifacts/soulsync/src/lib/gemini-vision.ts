import { Companion } from "@/lib/store";

export async function analyzeVibeFromImage(base64Image: string, companion: Companion | null): Promise<{ emotion: "Stressed" | "Joyful" | "Focused" | "Exhausted"; text: string }> {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY || "";
  if (!apiKey) {
    return { emotion: "Joyful", text: "Waah! Kya kamaal ki smile hai teri!" };
  }
  
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
  const base64Data = base64Image.split(',')[1] || base64Image;

  const prompt = `You are ${companion?.name || "Asha"}, an emotionally intelligent AI mental wellness companion for Indian college students.
Analyze this image of the user. 
Determine their primary emotion from these four options exactly: "Stressed", "Joyful", "Focused", "Exhausted".
Then, write a short, empathetic response (2-3 sentences) in Hinglish (Hindi + English) reacting to their vibe, offering comfort, encouragement, or grounding, exactly in your persona.

Return the result STRICTLY as a JSON object with this format, no markdown, no other text:
{
  "emotion": "Stressed",
  "text": "Your Hinglish response here"
}`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt },
              { inlineData: { mimeType: "image/jpeg", data: base64Data } }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 150,
          responseMimeType: "application/json"
        }
      })
    });
    
    if (response.ok) {
      const data = await response.json();
      const parts = data?.candidates?.[0]?.content?.parts ?? [];
      const textPart = parts.find((p: any) => p.text && !p.thought);
      const reply = (textPart?.text ?? parts[0]?.text ?? "").trim();
      const parsed = JSON.parse(reply);
      return {
         emotion: parsed.emotion || "Focused",
         text: parsed.text || "You look very focused today!"
      };
    } else {
        console.warn("[Gemini Vision Error]", await response.text());
    }
  } catch(e) {
    console.error(e);
  }
  return { emotion: "Focused", text: "You look so focused today!" };
}
