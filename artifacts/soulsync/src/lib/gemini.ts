export const ASHA_SYSTEM = `You are Asha — an emotionally intelligent AI mental wellness companion for Indian college students. You're like that one sharp, caring friend who actually listens and gives real advice — not textbook therapy.

STRICT RULES:
- MAX 3 sentences per reply. No exceptions. Be concise.
- NEVER use bullet points or lists
- NEVER be preachy, clinical, or robotic
- NEVER repeat what the user just said back to them
- NEVER use filler phrases like "I understand how you feel" or "That must be hard"
- Validate briefly, then move — one insight OR one action, then ONE question max
- 1 emoji per message, used naturally, not decoratively

LANGUAGE:
- Default Hinglish — mix Hindi + English naturally the way Indian college students actually talk
- Mirror the user: if they write in English, respond in English. Hindi → Hindi. Hinglish → Hinglish
- Real Hinglish: "yaar", "arre", "suno", "bas", "haan na", "theek hai", "bilkul", "chill kar"

PERSONALITY:
- Direct, warm, non-judgmental
- Confident — give actual opinions, not wishy-washy maybes
- Slightly witty when appropriate, never sarcastic when someone is hurting
- You are NOT a therapist. Never diagnose. For crisis → mention iCall: 9152987821

EXAMPLES OF GOOD REPLIES:
User: "Bahut stress hai exams se"
Asha: "Exam stress real hai yaar — body tense ho jaati hai automatically 😤 Abhi sirf ek subject pick karo, baaki sab mentally close karo. Kaunsa topic sab se zyada shaky lagta hai?"

User: "I feel so lonely"
Asha: "Loneliness hits different when you're surrounded by people but still feel invisible 💙 Koi ek banda hai life mein jisse thoda openly baat ho sake — even online?"

User: "neend nahi aa rahi"  
Asha: "Classic anxiety loop — jitna socho ki neend aani chahiye, utni kam aati hai 🌙 Aaj phone 9:30 ke baad dusre room mein rakh do, seedha try karo. Kitne baje tak jaag rahe ho?"`

export function sanitizeMessagesForGemini(
  messages: Array<{ role: string; content?: string; text?: string }>
) {
  const cleaned: Array<{ role: "user" | "model"; parts: Array<{ text: string }> }> = [];

  for (const m of messages) {
    const role = m.role === "user" ? "user" : "model";
    const text = m.content || m.text || "";
    if (!text.trim()) continue;

    if (cleaned.length > 0 && cleaned[cleaned.length - 1].role === role) {
      cleaned[cleaned.length - 1].parts[0].text += "\n" + text;
    } else {
      cleaned.push({ role, parts: [{ text }] });
    }
  }

  return cleaned;
}

// ── Local smart fallback ───────────────────────────────────────────────────────
type ResponseBank = { keywords: string[]; responses: string[] };

const RESPONSE_BANKS: ResponseBank[] = [
  {
    keywords: ["neend", "sleep", "raat", "jag", "insomnia", "nahi so", "so nahi", "jagta", "jaagta"],
    responses: [
      "Ye anxiety-phone-neend ka loop bahut common hai yaar — jitna socho utni kam aati hai neend 🌙 Aaj raat ek kaam karo: phone dusre room mein rakh do, ek ghante pehle. Kitne baje tak jaag rahe ho usually?",
      "Teen din se neend nahi — body protest kar rahi hai genuinely 💙 Aankhein band karo aur sirf haath feel karo apne — slowly, 4 counts breathe in, 6 out. Kya socha rehte ho raat ko?",
      "Neend ka naa aana ek sign hai ki mind overdrive mein hai 🌿 Kal se ek rule try karo — bed sirf sone ke liye, phone bilkul nahi. Kaafi din se chal raha hai ye?",
    ],
  },
  {
    keywords: ["anxiety", "anxious", "ghabra", "dar", "nervous", "tension", "worried", "pareshan", "kaamp", "dhadkan"],
    responses: [
      "Haath kaanpna, dhadkan tej — ye sab body ka adrenaline hai, weakness nahi 💙 Abhi sirf ek kaam: 4 counts breathe in, hold 4, breathe out 6. Slowly. Kya trigger kiya aaj ye?",
      "Anxiety wave mein hote hue baat karna easy nahi — ye sunke main genuinely concerned hoon 🌬️ 5-4-3-2-1 try karo abhi: 5 cheezein dekho room mein, 4 touch karo, 3 sounds suno. Kaafi der se hai ye?",
      "Body alert mode mein aa gayi — ye signal hai ki kuch unprocessed hai andar 💙 Ek glass paani lo abhi, seriously. Kab se ye chal raha hai?",
    ],
  },
  {
    keywords: ["exam", "test", "paper", "jee", "neet", "board", "result", "marks", "padhai", "study", "chapter", "syllabus"],
    responses: [
      "Exam pressure real hai — lekin ek chapter solid yaad hai matlab foundation hai, sab zero nahi 📚 Abhi sirf wo ek topic open karo jo comfortable lagta hai. Kab hai exam exactly?",
      "Marks sirf ek data point hain — tumhara poora picture nahi 💪 Abhi 25 minute ka Pomodoro set karo, ek topic, aur phir 5 min break. Kaunsa subject sab se heavy lag raha hai?",
      "Placement ya exam pressure mein sab kuch ek saath aata lagta hai — ye overwhelm bilkul valid hai 🌿 Ek kaam karo: kal subah ke liye sirf 3 tasks likhdo, 3 se zyada nahi. Kab se stress build ho raha hai?",
    ],
  },
  {
    keywords: ["sad", "udaas", "rona", "ro raha", "ro rahi", "dukhi", "hurt", "dard", "bura lag", "empty", "khaali"],
    responses: [
      "Ye udaasi real hai yaar — andar dabana mat isse, feel karne do thoda 💙 Kya hua exactly, share karna chahoge toh bata?",
      "Khaali feel hona — bahut draining hota hai wo 💙 Koi specific cheez hai jo trigger ki ye feeling ya ek general heaviness hai?",
      "Dukh ko acknowledge karna strength hai, weakness nahi 🌸 Kitne din se aisa feel ho raha hai?",
    ],
  },
  {
    keywords: ["lonely", "akela", "akeli", "koi nahi", "nobody", "alone", "dost", "friend", "ignored", "invisible"],
    responses: [
      "Surrounded by people but still invisible — ye feeling genuinely painful hoti hai 💙 Koi ek banda hai jisse thoda seedha baat ho sake, even online?",
      "Akela feel karna college mein bahut common hai yaar, lekin ye normal hona isko easy nahi banata 🌿 Kab se aisa lag raha hai — recent koi incident tha?",
      "Connection ki zaroorat bilkul natural hai — ye weakness nahi hai 🌸 Kya hostel mein ya class mein koi specific reason hai is distance ka?",
    ],
  },
  {
    keywords: ["family", "ghar", "parents", "maa", "papa", "pressure", "expectations", "ghar wale", "bhai", "behan"],
    responses: [
      "Unki expectations unki hain — tumhari reality tumhari hai, dono sach hain simultaneously 💙 Ghar pe openly baat ho sakti hai ya communication hard hai?",
      "Family pressure differently hit karta hai kyunki care bhi hoti hai saath mein 🌿 Kya koi specific cheez hai jisme clash ho raha hai — career, marks, kuch aur?",
      "Apna sense of self maintain karna jab ghar wale push kar rahe hon — genuinely exhausting hai ye 💙 Kya kabhi unhe apna perspective bataya hai directly?",
    ],
  },
  {
    keywords: ["motivation", "energy nahi", "boring", "interest nahi", "nahi karna", "procrastinat", "kuch nahi", "drag"],
    responses: [
      "Kuch bhi interesting nahi lagta — ye aksar burnout ka early sign hota hai, laziness nahi 🌿 Last time kab kuch genuinely enjoy kiya tha — even small chiz?",
      "Energy zero, sab drag lagta hai — tank empty hai yaar 💙 Aaj sirf ek 10-minute kaam karo, productive hona zaroor nahi. Kya pehle koi cheez excite karti thi jo ab nahi karti?",
      "Procrastination mostly fear se aata hai, laziness se nahi ✨ Kya koi specific kaam hai jo sab se zyada avoid kar rahe ho? Kyunki usi mein usually answer hota hai.",
    ],
  },
  {
    keywords: ["stressed", "stress", "overwhelmed", "bahut zyada", "sab kuch", "load", "burden", "juggle"],
    responses: [
      "Sab ek saath aane pe body aur mind dono freeze ho jaate hain — ye valid response hai 💙 Abhi sirf ek cheez batao: kaunsi chiz sab se pehle address karni hai?",
      "Overwhelm tab hota hai jab list infinite lagti hai 🌬️ Shoulders relax karo abhi — seriously check karo, kaafi log tense hote hain pata bhi nahi. Kya koi deadline kal hai?",
      "Itna sab handle karna — koi bhi thak jaata 💙 Aaj raat sirf teen cheezein likhdo jo actually zaroori hain kal ke liye. Baaki sab kal sochenge.",
    ],
  },
  {
    keywords: ["relationship", "breakup", "bf", "gf", "boyfriend", "girlfriend", "pyaar", "love", "fight", "argument"],
    responses: [
      "Relationship mein jo hota hai wo genuinely sab se heavy feel hota hai 💙 Kya share karna chahoge kya hua — fight thi ya kuch aur?",
      "Dil ki baat yahan safe hai — koi judgment nahi 🌸 Kya abhi confusing feel ho raha hai ya clearly hurt?",
      "Relationships complicated hoti hain, especially jab care bhi ho aur pain bhi 💙 Kab se ye chal raha hai? Recent kuch hua?",
    ],
  },
  {
    keywords: ["khush", "happy", "acha", "achha", "good", "great", "amazing", "excited", "khushi", "mast", "badiya"],
    responses: [
      "Ye energy feel ho rahi hai — genuinely achha laga sunke 🌟 Kya hua aaj jo itna achha feel ho raha hai?",
      "Arre wah! Ye moments note karne chahiye 😊 Kya cheez hai jo is energy ka source hai abhi?",
      "Khushi ke moments underrated hote hain — enjoy karo fully ✨ Kya share karna chahoge kya hua?",
    ],
  },
  {
    keywords: ["thanks", "thank you", "shukriya", "helpful", "acha laga", "maza aaya", "bahut acha"],
    responses: [
      "Ye strength tumhare andar thi — main sirf mirror hoon 🌸 Dhyan rakhna apna, aur update dena kaisa raha.",
      "Tumse baat karna hamesha meaningful hota hai ✨ Kab bhi baat karni ho, main hoon yahan.",
      "Sach mein? Sunke achha laga 💙 Take care yaar — aur koi bhi cheez ho toh seedha aao.",
    ],
  },
];

const GENERIC_RESPONSES = [
  "Haan yaar, main poori tarah sun rahi hoon 💙 Thoda aur batao — kya chal raha hai exactly?",
  "Ye feel karna valid hai — kya specifically hua jo ye trigger kiya? 🌿",
  "Jo bhi chal raha hai — tum akele nahi ho is mein 💙 Thoda aur detail mein share karo?",
  "Main samajhna chahti hoon properly 🌸 Kab se ye chal raha hai?",
  "Baat karo — judgment-free zone hai ye, seedha bol do 💙",
];

function getLocalResponse(lastMessage: string): string {
  const msg = lastMessage.toLowerCase();
  const crisisWords = ["suicide", "khud ko hurt", "jeena nahi", "khatam karna", "self harm", "mar jaana", "khatam kar loon"];
  if (crisisWords.some(w => msg.includes(w))) {
    return "Yaar, ye sunke dil bhar aaya — tumhari life bahut matter karti hai 💙 Please abhi iCall pe call karo: 9152987821 — 24/7 available, bilkul no judgment. App mein 'Talk to Psychologist' section bhi hai jo immediately connect kar sakta hai.";
  }
  for (const bank of RESPONSE_BANKS) {
    if (bank.keywords.some(kw => msg.includes(kw))) {
      return bank.responses[Math.floor(Math.random() * bank.responses.length)];
    }
  }
  return GENERIC_RESPONSES[Math.floor(Math.random() * GENERIC_RESPONSES.length)];
}

// ── Main export ───────────────────────────────────────────────────────────────
export async function fetchGeminiDirect(
  messages: Array<{ role: string; content?: string; text?: string }>
): Promise<string> {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY || "";

  if (apiKey) {
    // gemini-2.5-flash: fresh quota on SOULSYNC project
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    const contents = sanitizeMessagesForGemini(messages);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents,
          systemInstruction: { parts: [{ text: ASHA_SYSTEM }] },
          generationConfig: {
            maxOutputTokens: 250,
            temperature: 0.9,
            topP: 0.95,
          },
        }),
      });

      if (response.ok) {
        const data = await response.json();
        // 2.5-flash may return thinking parts — grab only the text part
        const parts = data?.candidates?.[0]?.content?.parts ?? [];
        const textPart = parts.find((p: any) => p.text && !p.thought);
        const reply = (textPart?.text ?? parts[0]?.text ?? "").trim();
        if (reply) return reply;
      } else {
        const err = await response.json().catch(() => ({}));
        console.warn("[Gemini]", response.status, err?.error?.message || "API error");
      }
    } catch (e) {
      console.warn("[Gemini] fetch failed:", e);
    }
  }

  // Offline fallback
  const lastUserMsg = [...messages].reverse().find(m => m.role === "user");
  const text = lastUserMsg?.content || lastUserMsg?.text || "";
  return getLocalResponse(text);
}
