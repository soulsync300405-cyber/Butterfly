const apiKey = process.env.VITE_GEMINI_API_KEY || "";
const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

const base64Data = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

const prompt = `You are Asha, an emotionally intelligent AI mental wellness companion for Indian college students.
Analyze this image of the user. 
Determine their primary emotion from these four options exactly: "Stressed", "Joyful", "Focused", "Exhausted".
Then, write a short, empathetic response (2-3 sentences) in Hinglish (Hindi + English) reacting to their vibe, offering comfort, encouragement, or grounding, exactly in your persona.

Return the result STRICTLY as a JSON object with this format, no markdown, no other text:
{
  "emotion": "Stressed",
  "text": "Your Hinglish response here"
}`;

async function test() {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt },
              { inlineData: { mimeType: "image/png", data: base64Data } }
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
      console.log(JSON.stringify(data, null, 2));
    } else {
        console.error("[Gemini Vision Error]", await response.text());
    }
  } catch(e) {
    console.error("Fetch error:", e);
  }
}

test();
