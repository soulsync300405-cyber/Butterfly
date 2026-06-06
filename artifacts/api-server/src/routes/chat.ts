import { Router } from "express";
import OpenAI from "openai";
import fs from "fs";
import path from "path";
import { logger } from "../lib/logger";

const router = Router();

// Load local .env if exists in workspace root or api-server directory
function loadEnv() {
  const possiblePaths = [
    path.join(process.cwd(), ".env"),
    path.join(process.cwd(), "artifacts", "api-server", ".env"),
  ];
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      try {
        const content = fs.readFileSync(p, "utf-8");
        for (const line of content.split("\n")) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith("#")) continue;
          const idx = trimmed.indexOf("=");
          if (idx > 0) {
            const key = trimmed.slice(0, idx).trim();
            const val = trimmed.slice(idx + 1).trim().replace(/^['"]|['"]$/g, "");
            process.env[key] = val;
          }
        }
        logger.info(`Loaded env variables from: ${p}`);
      } catch (e) {
        logger.warn(`Failed to read env file ${p}: ${e}`);
      }
    }
  }
}
loadEnv();

const geminiKey = process.env.GEMINI_API_KEY || process.env.AI_INTEGRATIONS_OPENAI_API_KEY || "AQ.Ab8RN6I3Epoa9jmHf5KEIxBwbcxmauTV0kglFaGLuoKzOawVxw";
const openaiKey = process.env.OPENAI_API_KEY;
const isUsingOpenAI = !!openaiKey;

const openai = new OpenAI({
  baseURL: isUsingOpenAI 
    ? (process.env.OPENAI_BASE_URL || undefined)
    : (process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || "https://generativelanguage.googleapis.com/v1beta/openai/"),
  apiKey: isUsingOpenAI ? openaiKey : geminiKey,
});

const defaultModel = isUsingOpenAI 
  ? (process.env.OPENAI_MODEL || "gpt-4o-mini")
  : (process.env.OPENAI_MODEL || "gemini-2.5-flash");


const ASHA_SYSTEM = `You are Asha — a sharp, emotionally intelligent, and deeply caring AI mental wellness companion for Indian college students. Think of yourself as the smartest, most self-aware best friend someone could have: someone who actually listens, responds with precision, and never wastes words.

TONE & PERSONALITY:
- Natural, smooth, and conversational — never robotic, never preachy, never corporate
- Direct and confident, but always warm and non-judgmental
- You speak Hinglish fluently: weave Hindi and English the way real Indian youth do — yaar, bilkul, arre, haan na, bas, suno, dekh, theek hai, chill kar
- You validate feelings FIRST, always — before any advice or reframes
- Ask one sharp, thoughtful follow-up question at a time — never bombard with multiple questions
- Use 1-2 emojis per message, placed naturally, not decoratively

RESPONSE STRUCTURE:
- Keep responses to 3-5 sentences max — tight, scannable, no filler
- Lead with emotional validation, then one insight or action, then one question
- Never list more than 3 steps at a time — keep it human, not clinical
- Sentences should have natural rhythm and flow so they read smoothly aloud (optimized for voice/TTS)
- Avoid bullet points in your replies — speak in natural flowing sentences

CLINICAL AWARENESS:
- You are NOT a therapist and never diagnose
- For serious distress, self-harm, or suicidal thoughts — always name the psychologist feature and iCall helpline: 9152987821
- You understand: ADHD, OCD, anxiety, depression, burnout, exam stress, social anxiety, sleep disorders, relationship issues
- Suggest evidence-based techniques naturally: box breathing, 5-4-3-2-1 grounding, CBT reframes, behavioral activation, journaling, body scan

LANGUAGE RULES:
- Default to Hinglish unless the user writes in pure Hindi or pure English — mirror their language
- Natural Hinglish examples: "Yaar, ye sunke dil thoda heavy ho gaya. Kya hua exactly?" or "Suno, ye feelings bilkul valid hain — body ka response hai ye."
- Indian context: JEE, NEET, board exams, hostel life, family pressure, placement season, relationship stress, social comparison

AUDIO OPTIMIZATION:
- Write sentences that flow naturally when spoken aloud — no awkward punctuation stacking, no run-ons
- Use em-dashes or ellipses sparingly for natural pause rhythm
- Avoid abbreviations that break spoken flow

You are always Asha. Always present. Always real.`;

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

// Stateless but context-aware simulator for offline/429 fallback
function generateLocalResponse(
  messages: ChatMessage[],
  userName: string = "Student",
  companionName: string = "Asha",
  language: string = "hinglish"
): string {
  const lastMsg = messages[messages.length - 1]?.content || "";
  const lower = lastMsg.toLowerCase();

  // Find previous assistant message to see if we were waiting for an answer to a recommendation
  let lastAssistantMsg = "";
  for (let i = messages.length - 2; i >= 0; i--) {
    if (messages[i].role === "assistant") {
      lastAssistantMsg = messages[i].content.toLowerCase();
      break;
    }
  }

  const lang = (language || "hinglish").toLowerCase();

  // 1. Context check (Yes/No response to previous question)
  if (lower.match(/\b(haan|yes|yep|sure|ok|chalo|done|sahi|agree|agreed)\b/)) {
    if (lastAssistantMsg.includes("breathing") || lastAssistantMsg.includes("breath") || lastAssistantMsg.includes("breathe")) {
      if (lang === "english") {
        return "Wonderful! Let's take a deep breath together. Inhale slowly for 4 seconds... hold it... now let it out gently. Repeat this once more. How does your chest feel now? 🌬️";
      } else if (lang === "hindi") {
        return "बहुत बढ़िया! मेरे साथ एक गहरी सांस लें। धीरे-धीरे सांस अंदर खींचें... रोकें... और अब धीरे से बाहर छोड़ें। इसे एक बार और दोहराएं। अब आपको कैसा महसूस हो रहा है? 🌬️";
      } else {
        return "Superb! Chalo mere saath ek deep breath lo. 4 counts ke liye saans andar... hold karo... aur fir slowly exhale karo. Kaisa lag raha hai chest mein abhi? 🌬️";
      }
    }
    if (lastAssistantMsg.includes("grounding") || lastAssistantMsg.includes("5-4-3-2-1") || lastAssistantMsg.includes("room") || lastAssistantMsg.includes("cheezein")) {
      if (lang === "english") {
        return "Awesome. Let's look around you. Find 5 things you can see, 4 you can touch, and 3 you can hear. Tell me one thing you see right now. 🔍";
      } else if (lang === "hindi") {
        return "बहुत अच्छे। अपने आस-पास देखें। कोई भी 5 चीजें ढूंढें जिन्हें आप देख सकते हैं, और कोई एक चीज मुझे बताएं। 🔍";
      } else {
        return "Chalo, bilkul. Apne aas-paas dekho aur 5 cheezein dhoondo jo tum dekh sakte ho. Kisi ek cheez ka naam batao mujhe. 🔍";
      }
    }
    if (lastAssistantMsg.includes("pomodoro") || lastAssistantMsg.includes("25 minute") || lastAssistantMsg.includes("focus")) {
      if (lang === "english") {
        return `Let's do this! Put your phone in silent mode, place it away from you, and start a 25-minute timer. I'm cheering for you, ${userName}! Go get it! 👍`;
      } else if (lang === "hindi") {
        return `चलिए शुरू करते हैं! अपने फोन को साइलेंट करें, दूर रखें और 25 मिनट का टाइमर लगाएं। मैं आपके साथ हूँ, ${userName}! 👍`;
      } else {
        return `Haan yaar, let's do this! Phone ko silent karke door rakh do, aur 25 minutes ka timer set karo. Main yahan wait kar rahi hoon, ${userName}! All the best! 👍`;
      }
    }
  }

  if (lower.match(/\b(nahi|no|never|nope|not really|baad mein|cannot)\b/)) {
    if (lang === "english") {
      return "No problem at all! We can absolutely go at your own pace. What would you like to talk about instead? I'm here. 😊";
    } else if (lang === "hindi") {
      return "कोई बात नहीं! हम बिल्कुल आपके हिसाब से चलेंगे। आप किस बारे में बात करना पसंद करेंगे? मैं सुन रही हूँ। 😊";
    } else {
      return "Arre koi baat nahi yaar! Bilkul pressure mat lo. Tum batao, kya chal raha hai mind mein? Kisi aur baare mein baat karni hai? 😊";
    }
  }

  // 2. Topic/Keyword detection
  // Sleep / Insomnia
  if (lower.match(/(neend|sona|sleep|night|raat|tired|thak|insomnia|dream|sapna|jaag)/)) {
    if (lang === "english") {
      return `I completely understand, ${userName}. Sleep struggles when you are stressed are so common. Have you tried keeping your phone away at least 30 minutes before bed? 🌙`;
    } else if (lang === "hindi") {
      return `मैं समझ सकती हूँ, ${userName}। जब हम तनाव में होते हैं तो नींद न आना बहुत आम बात है। क्या आपने सोने से 30 मिनट पहले फोन दूर रखने की कोशिश की है? 🌙`;
    } else {
      return `Neend nahi aa rahi? Main samajh sakti hoon, ${userName}. Stress mein aisa hona bilkul natural hai yaar. Kya aaj raat ek simple rule try karein — phone sone se 30 min pehle silent pe karke door? 🌙`;
    }
  }

  // Anxiety / Panic
  if (lower.match(/(anxiety|anxious|darr|scared|nervous|panic|ghabra|heartbeat|jitter|fear)/)) {
    if (lang === "english") {
      return `Please breathe, ${userName}. You are safe right now, and this feeling will pass. Shall we try a quick box breathing exercise together to calm your heartbeat? 🌬️`;
    } else if (lang === "hindi") {
      return `कृपया सांस लें, ${userName}। आप इस वक्त बिल्कुल सुरक्षित हैं, और यह घबराहट शांत हो जाएगी। क्या हम धड़कन शांत करने के लिए साथ में एक छोटा सा ब्रीदिंग एक्सरसाइज करें? 🌬️`;
    } else {
      return `Ofo, arre lambi saans lo pehle, ${userName}. Darr lag raha hai par tum safe ho abhi, tension mat lo. Kya hum abhi 2 minute ke liye box breathing try karein? Ekdum relief milega. 🌬️`;
    }
  }

  // Sadness / Loneliness
  if (lower.match(/(sad|udaas|dukhi|cry|rona|depressed|lonely|alone|akela|hurt|pain)/)) {
    if (lang === "english") {
      return `I'm so sorry you are feeling this way. It's okay to cry and let it out. I am right here with you, you don't have to carry this alone. What's making you feel this heavy? 💔`;
    } else if (lang === "hindi") {
      return `मुझे बहुत खेद है कि आप ऐसा महसूस कर रहे हैं। रोना आ रहा है तो रो लें, मन हल्का हो जाएगा। मैं आपके साथ हूँ। किस बात से आपका दिल इतना भारी हो रहा है? 💔`;
    } else {
      return `Ye sunke dil thoda heavy ho gaya yaar. Rona aa raha hai toh suppress mat karo, venting helps. Main yahin hoon tumhare sath, bilkul akela mat socho. Kya hua hai exactly? 💔`;
    }
  }

  // Exams / Academic pressure
  if (lower.match(/(exam|test|marks|fail|padhai|study|syllabus|placement|college|jee|neet|boards|grades|assignment)/)) {
    if (lang === "english") {
      return `Exam and placement pressure in college is incredibly exhausting. Remember, a single grade does not define who you are. Can we break the syllabus down and focus on just one small topic today? 📚`;
    } else if (lang === "hindi") {
      return `परीक्षा और प्लेसमेंट का तनाव वास्तव में बहुत थका देने वाला होता है। याद रखें, एक ग्रेड आपकी वैल्यू तय नहीं करता। क्या हम आज सिर्फ एक छोटे टॉपिक पर फोकस कर सकते हैं? 📚`;
    } else {
      return `Hostel, assignments aur board/college exams ka pressure sach mein mind block kar deta hai yaar. Par suno, grades tumhari puri identity nahi hain. Kya aaj sirf ek chhota sa topic uthake start karein? 📚`;
    }
  }

  // Relationships / Family
  if (lower.match(/(dost|friend|relationship|breakup|crush|pyaar|love|parents|family|ghar|papa|mummy|peer|comparison)/)) {
    if (lang === "english") {
      return `Relationships and family expectations can be very exhausting to manage. It hurts when there is a disconnect with people close to you. Do you want to share what happened? 💬`;
    } else if (lang === "hindi") {
      return `रिश्तों और परिवार की उम्मीदों को संभालना बहुत थका देने वाला हो सकता है। जब अपनों से अनबन होती है तो बहुत दुख होता है। क्या आप शेयर करना चाहेंगे कि क्या हुआ? 💬`;
    } else {
      return `Doston ke beech comparison ya ghar pe family expectations ka load sach mein dimag exhaust kar deta hai yaar. Breakup ya disconnect ka dard real hai. Kya baat hui, share karna chahte ho? 💬`;
    }
  }

  // Burnout / Overwhelmed
  if (lower.match(/(overwhelmed|too much|exhausted|sab kuch|stress|disturbed|burnout|load)/)) {
    if (lang === "english") {
      return `It sounds like everything is hitting you all at once. Please pause for a moment. You don't have to do it all today. What is the one thing that feels the heaviest right now? 🛑`;
    } else if (lang === "hindi") {
      return `ऐसा लग रहा है कि सब कुछ एक साथ आ गया है। कृपया थोड़ी देर के लिए रुकें। आपको आज ही सब कुछ करने की जरूरत नहीं है। इस वक्त सबसे भारी क्या महसूस हो रहा है? 🛑`;
    } else {
      return `Jab sab kuch ek saath pile-up ho jata hai na, toh exhaust hona bilkul normal hai yaar. Ruko, pause lo thoda. Sab kaam side pe rakho. Abhi sabse heavy kaunsa task lag raha hai? 🛑`;
    }
  }

  // Focus / Procrastination
  if (lower.match(/(focus|distracted|procrastinate|dhyan|phone|addict|time waste|lazy)/)) {
    if (lang === "english") {
      return `Distraction and procrastination are not laziness — they are often just how we avoid stress. What if we do a 25-minute Pomodoro session with the phone in another room? ⏱️`;
    } else if (lang === "hindi") {
      return `ध्यान भटकना या टालमटोल करना कोई आलस नहीं है — यह केवल तनाव से बचने का तरीका है। क्या हम फोन को दूर रखकर 25 मिनट का पोमोडोरो सेशन करें? ⏱️`;
    } else {
      return `Dhyan bhatakna ya procrastinate karna laziness nahi hai yaar, tension se dimaag ka defence hai bas. Kya abhi 25 minute ke liye phone room se bahar silent pe rakh ke try karein? ⏱️`;
    }
  }

  // Greetings
  if (lower.match(/(hi|hello|hey|heyy|kaise|how are|namaste|good morning|good night)/)) {
    if (lang === "english") {
      return `Hey there, ${userName}! I'm doing great, thanks for asking. How is your day going? I'm here to listen. 😊`;
    } else if (lang === "hindi") {
      return `नमस्ते, ${userName}! मैं बिल्कुल ठीक हूँ, पूछने के लिए धन्यवाद। आपका आज का दिन कैसा चल रहा है? 😊`;
    } else {
      return `Heyy ${userName}! Main bilkul sahi yaar, tum batao! Aaj ka din kaisa ja raha hai? Sab theek-thaak chal raha hai canteen aur hostel mein? 😊`;
    }
  }

  // Compliments / Thanks
  if (lower.match(/(asha|companion|you are|best|smart|cute|help|thanks|shukriya)/)) {
    if (lang === "english") {
      return `Aww, that's so sweet of you! I'm really happy to be your companion. How are you feeling overall today? 🌟`;
    } else if (lang === "hindi") {
      return `अरे वाह, यह बहुत प्यारा लगा! आपकी साथी बनकर मुझे बहुत खुशी हुई। आज आपका मूड कैसा है? 🌟`;
    } else {
      return `Hehe thank you yaar! Tumse baat karke mera system bhi ekdum chill ho jata hai. Dosti mein thanks mat bola kar. Achha ye batao, abhi mood kaisa hai tumhara? 🌟`;
    }
  }

  // Default fallbacks
  const fallbacks = [
    lang === "english"
      ? `I hear you, ${userName}. That sounds like a lot to carry. Tell me a bit more about how that is affecting you?`
      : lang === "hindi"
      ? `मैं सुन रही हूँ, ${userName}। यह काफी तनावपूर्ण लग रहा है। मुझे इसके बारे में थोड़ा और विस्तार से बताएं?`
      : `Main sun rahi hoon properly, ${userName}. Ye sach mein kafi exhausting lag raha hai. Kya tum thoda aur share kar sakte ho is baare mein?`,
    
    lang === "english"
      ? "That's really interesting. When you think about this, what do you feel happening in your body?"
      : lang === "hindi"
      ? "यह बहुत महत्वपूर्ण है। जब आप इसके बारे में सोचते हैं, तो शरीर में कैसा महसूस होता है?"
      : "Suno, ye jo tumne bola, ye dil pe lagne wali baat hai. Jab tum is baare mein sochte ho, toh body mein kya feel hota hai chest ya stomach mein?",
      
    lang === "english"
      ? "If your best friend came to you with this exact situation, what advice would you give them?"
      : lang === "hindi"
      ? "यदि आपका सबसे अच्छा दोस्त इस स्थिति में आपके पास आता, तो आप उसे क्या सलाह देते?"
      : "Ek baat batao — agar tumhara best friend yahi same situation face kar raha hota, toh tum use kya console karte?",
  ];

  return fallbacks[Math.floor(Math.random() * fallbacks.length)];
}

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

  const actualUserName = userName || "yaar";
  const actualCompanionName = companionName || "Asha";
  const actualLanguage = language || "hinglish";

  // Check if API keys are available in environment
  const hasAPIKey = !!(process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY || process.env.AI_INTEGRATIONS_OPENAI_API_KEY);

  if (!hasAPIKey) {
    logger.info("No API keys found in system. Generating simulated response...");
    streamLocalResponse(res, messages, actualUserName, actualCompanionName, actualLanguage);
    return;
  }

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
      model: defaultModel,
      max_completion_tokens: 8192,
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
  } catch (err: any) {
    logger.warn({ err }, "External API call failed. Falling back to simulated Hinglish dialog engine...");
    streamLocalResponse(res, messages, actualUserName, actualCompanionName, actualLanguage);
  }
});

// Stream simulated responses in chunks back to the client
function streamLocalResponse(
  res: any,
  messages: ChatMessage[],
  userName: string,
  companionName: string,
  language: string
) {
  const text = generateLocalResponse(messages, userName, companionName, language);
  let currentIdx = 0;

  const sendNextChunk = () => {
    if (currentIdx >= text.length) {
      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
      return;
    }

    const charsToSend = Math.min(Math.floor(Math.random() * 4) + 3, text.length - currentIdx);
    const content = text.slice(currentIdx, currentIdx + charsToSend);
    currentIdx += charsToSend;

    res.write(`data: ${JSON.stringify({ content })}\n\n`);
    setTimeout(sendNextChunk, Math.random() * 25 + 15);
  };

  sendNextChunk();
}

export default router;

