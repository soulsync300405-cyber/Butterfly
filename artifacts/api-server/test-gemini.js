import OpenAI from "openai";

const openai = new OpenAI({
  baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
  apiKey: "AQ.Ab8RN6I3Epoa9jmHf5KEIxBwbcxmauTV0kglFaGLuoKzOawVxw",
});

async function test() {
  try {
    const stream = await openai.chat.completions.create({
      model: "gemini-2.5-flash",
      messages: [{ role: "user", content: "hello" }],
      stream: true,
    });
    for await (const chunk of stream) {
      console.log(chunk.choices[0]?.delta?.content || "");
    }
  } catch (err) {
    console.error("ERROR:", err);
  }
}

test();
