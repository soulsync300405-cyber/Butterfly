import { Companion } from "@/lib/store";
import { analyzeFaceFrame, type FaceMetrics, type FaceVibeResult } from "@/lib/face-analyzer";

export interface VibeScanResult {
  emotion: "Stressed" | "Joyful" | "Focused" | "Exhausted";
  text: string;
  metrics: FaceMetrics;
  insights: string[];
}

/**
 * Analyzes a base64 camera snapshot using client-side biometric computer vision
 * and enriches with Gemini Vision if an API key is available.
 */
export async function analyzeVibeFromImage(
  base64Image: string,
  companion: Companion | null
): Promise<VibeScanResult> {
  // 1. Perform biometric Computer Vision analysis on the image
  const cvResult = await new Promise<FaceVibeResult>((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width || 320;
      canvas.height = img.height || 240;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(analyzeFaceFrame(canvas, companion?.name || "Asha"));
      } else {
        resolve(analyzeFaceFrame(img as any, companion?.name || "Asha"));
      }
    };
    img.onerror = () => {
      resolve({
        emotion: "Focused",
        confidence: 70,
        metrics: { smile: 30, tension: 25, fatigue: 30, focus: 80, faceDetected: false, brightness: 50 },
        dialogue: "Camera frame capture error. Please retry in good lighting!",
        insights: ["Face capture error"]
      });
    };
    img.src = base64Image;
  });

  // 2. If Gemini API key is available, optionally enrich the dialogue
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY || "";
  if (apiKey) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
      const base64Data = base64Image.split(',')[1] || base64Image;

      const prompt = `You are ${companion?.name || "Asha"}, an emotionally intelligent AI mental wellness companion for Indian college students.
A real-time biometric computer vision scan of the user's face measured:
- Emotion: "${cvResult.emotion}"
- Smile Index: ${cvResult.metrics.smile}%
- Brow / Stress Tension: ${cvResult.metrics.tension}%
- Eye Fatigue: ${cvResult.metrics.fatigue}%
- Concentration / Focus: ${cvResult.metrics.focus}%

Write a short, empathetic response (2-3 sentences) in warm Hinglish (Hindi + English) reacting directly to these specific facial indicators. Comfort, encourage, or hype them up according to their exact facial expression.

Return the result STRICTLY as a JSON object with this format, no markdown, no other text:
{
  "emotion": "${cvResult.emotion}",
  "text": "Your Hinglish response here"
}`;

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
            temperature: 0.3,
            maxOutputTokens: 150,
            responseMimeType: "application/json"
          }
        })
      });

      if (response.ok) {
        const data = await response.json();
        const parts = data?.candidates?.[0]?.content?.parts ?? [];
        const textPart = parts.find((p: any) => p.text && !p.thought);
        let reply = (textPart?.text ?? parts[0]?.text ?? "").trim();
        reply = reply.replace(/```json/gi, "").replace(/```/gi, "").trim();
        const parsed = JSON.parse(reply);

        if (parsed?.text) {
          return {
            emotion: cvResult.emotion,
            text: parsed.text,
            metrics: cvResult.metrics,
            insights: cvResult.insights,
          };
        }
      }
    } catch (e) {
      console.warn("[Gemini Vision Enrich failed, using local CV analysis]:", e);
    }
  }

  // 3. Return the physical face analysis result
  return {
    emotion: cvResult.emotion,
    text: cvResult.dialogue,
    metrics: cvResult.metrics,
    insights: cvResult.insights,
  };
}
