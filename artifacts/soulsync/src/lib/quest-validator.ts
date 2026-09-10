/**
 * Quest Verification Engine
 * Provides realistic validation for wellness quests:
 * - Anti-gibberish & keyboard-mash detection
 * - Mental health emotion taxonomy verification (>130 affective states)
 * - CBT Cognitive Reframing evaluation (Gemini 1.5 Flash + robust local semantic NLP fallback)
 * - Sensory grounding validation
 */

// ── 1. Anti-Gibberish & Keyboard-Mash Detection ──────────────────────────────
const KEYBOARD_ROWS = [
  "qwertyuiop",
  "asdfghjkl",
  "zxcvbnm",
  "1234567890",
];

export function detectGibberish(text: string): { isGibberish: boolean; reason?: string } {
  const trimmed = text.trim();
  if (trimmed.length < 3) {
    return { isGibberish: true, reason: "Entry is too short. Please provide a genuine response." };
  }

  const lower = trimmed.toLowerCase();

  // Check 1: Repeating single characters like "aaaaaa", ".....", "11111"
  if (/^(.)\1{3,}$/.test(lower)) {
    return { isGibberish: true, reason: "Repeated characters detected. Please write a meaningful reflection." };
  }

  // Check 2: Keyboard row walks (e.g. "asdfgh", "qwerty", "zxcvb")
  for (const row of KEYBOARD_ROWS) {
    for (let i = 0; i <= row.length - 4; i++) {
      const walk = row.substring(i, i + 4);
      const revWalk = walk.split("").reverse().join("");
      if (lower.includes(walk) || lower.includes(revWalk)) {
        return { isGibberish: true, reason: "Keyboard mash detected. Take a quiet moment to write your real thoughts." };
      }
    }
  }

  // Check 3: Consecutive consonants without vowels (e.g. "sdfghjk", "bcdfgh")
  const consonantClusters = lower.match(/[bcdfghjklmnpqrstvwxyz]{5,}/g);
  if (consonantClusters && consonantClusters.length > 0) {
    return { isGibberish: true, reason: "Random consonant string detected. Please type recognizable words." };
  }

  // Check 4: Character variety / low entropy
  const uniqueChars = new Set(lower.replace(/\s+/g, "").split(""));
  if (lower.length >= 8 && uniqueChars.size <= 2) {
    return { isGibberish: true, reason: "Input lacks variety. Please share a realistic thought or observation." };
  }

  return { isGibberish: false };
}


// ── 2. Emotion Taxonomy Verification ─────────────────────────────────────────
// Comprehensive taxonomy of affective states recognized in psychology & CBT
export const EMOTION_TAXONOMY = new Set([
  // Anxiety / Fear / Panic
  "anxious", "anxiety", "worried", "worry", "fearful", "fear", "nervous", "stressed", "stress",
  "panicked", "panic", "overwhelmed", "uneasy", "dread", "apprehensive", "jittery", "restless",
  "tense", "alarmed", "vulnerable", "insecure", "shaky", "terrified", "frightened",

  // Sadness / Low Energy / Grief
  "sad", "sadness", "depressed", "depression", "down", "melancholy", "gloomy", "heartbroken",
  "grief", "hopeless", "lonely", "isolated", "empty", "numb", "exhausted", "fatigued",
  "drained", "weary", "burnt out", "burnout", "disappointed", "discouraged", "defeated",
  "helpless", "heavy", "sorrowful",

  // Anger / Frustration / Irritation
  "angry", "anger", "frustrated", "frustration", "irritated", "annoyed", "bitter", "enraged",
  "resentful", "agitated", "furious", "mad", "defensive", "cranky", "impatient", "grouchy",

  // Guilt / Shame / Self-Doubt
  "guilty", "guilt", "ashamed", "shame", "embarrassed", "inadequate", "unworthy", "remorseful",
  "regretful", "regret", "self-conscious", "flawed", "worthless",

  // Calm / Peace / Grounded
  "calm", "peaceful", "peace", "relaxed", "serene", "grounded", "content", "tranquil",
  "centered", "still", "composed", "relieved", "relief", "soothed", "safe", "stable",

  // Joy / Gratitude / Optimism
  "happy", "happiness", "joyful", "joy", "grateful", "gratitude", "thankful", "optimistic",
  "hopeful", "hope", "inspired", "excited", "cheerful", "proud", "delighted", "energized",
  "empowered", "confident", "curious", "satisfied", "loving", "connected", "compassionate",

  // Confusion / Disorientation
  "confused", "overstimulated", "distracted", "scattered", "indecisive", "foggy", "detached",
  "ambivalent", "torn", "hesitant", "unsure",

  // Hindi / Hinglish common expressions
  "pareshaan", "pareshan", "chinta", "khush", "shant", "thaka", "thaki", "udas", "udaas", "gussa"
]);

export function validateEmotionWord(input: string): {
  isValid: boolean;
  normalized: string;
  feedback: string;
} {
  const gibberishCheck = detectGibberish(input);
  if (gibberishCheck.isGibberish) {
    return {
      isValid: false,
      normalized: input.trim(),
      feedback: gibberishCheck.reason || "Please enter a real feeling or emotion.",
    };
  }

  const cleaned = input.toLowerCase().trim().replace(/[.,!?;:"'()]/g, "");
  const words = cleaned.split(/\s+/);

  // Check if any word or multi-word phrase matches our emotion taxonomy
  let matchedEmotion = "";
  for (const word of words) {
    if (EMOTION_TAXONOMY.has(word)) {
      matchedEmotion = word;
      break;
    }
  }

  // Also check 2-word combinations like "burnt out"
  if (!matchedEmotion) {
    for (let i = 0; i < words.length - 1; i++) {
      const pair = `${words[i]} ${words[i + 1]}`;
      if (EMOTION_TAXONOMY.has(pair)) {
        matchedEmotion = pair;
        break;
      }
    }
  }

  if (matchedEmotion) {
    return {
      isValid: true,
      normalized: matchedEmotion.charAt(0).toUpperCase() + matchedEmotion.slice(1),
      feedback: `Recognized emotion: "${matchedEmotion}". Naming it helps calm your amygdala.`,
    };
  }

  // Check for common non-emotion answers like objects or actions
  const commonObjects = ["car", "phone", "pen", "table", "chair", "laptop", "book", "food", "water", "apple", "banana", "cat", "dog", "money", "bed", "work", "school", "exam"];
  const containsObject = words.some(w => commonObjects.includes(w));

  if (containsObject) {
    return {
      isValid: false,
      normalized: input,
      feedback: `"${input}" refers to a physical object or activity rather than an affective state. Try feelings like "overwhelmed", "hopeful", "restless", or "calm".`,
    };
  }

  // If word is >= 4 chars, allow if it ends in emotional suffixes like -ed, -ful, -ing, -ous, -ic
  if (/^[a-z]{4,}$/.test(cleaned) && /(ed|ful|ing|ous|ic|less)$/.test(cleaned)) {
    return {
      isValid: true,
      normalized: cleaned.charAt(0).toUpperCase() + cleaned.slice(1),
      feedback: `Emotional state recorded: "${cleaned}". Self-awareness is the first step to emotional balance.`,
    };
  }

  return {
    isValid: false,
    normalized: input,
    feedback: `"${input}" is not recognized as an emotion. Try naming how you felt, such as "anxious", "overwhelmed", "grateful", "fatigued", or "relieved".`,
  };
}


// ── 3. CBT Cognitive Reframing Validation ────────────────────────────────────
export interface ReframeEvaluation {
  isValid: boolean;
  score: number; // 0 - 100
  feedback: string;
  compassionAspect?: string;
}

export async function validateReframe(
  originalThought: string,
  userReframe: string,
  companionName: string = "Asha"
): Promise<ReframeEvaluation> {
  const gibberishCheck = detectGibberish(userReframe);
  if (gibberishCheck.isGibberish) {
    return {
      isValid: false,
      score: 10,
      feedback: gibberishCheck.reason || "Please provide a genuine, constructive thought.",
    };
  }

  const trimmed = userReframe.trim();
  if (trimmed.split(/\s+/).length < 4) {
    return {
      isValid: false,
      score: 25,
      feedback: "A helpful cognitive reframe should be a complete sentence (at least 4-5 words). Explain how you can view this with self-compassion or growth.",
    };
  }

  // 1. Try evaluating with Gemini 1.5 Flash if API key is present
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY || "";
  if (apiKey) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
      const prompt = `You are ${companionName}, an expert clinical CBT psychologist.
Evaluate this student's cognitive reframe exercise:
Original Negative Self-Criticism: "${originalThought}"
User's Attempted Reframe: "${userReframe}"

Does the user's reframe represent a genuine, constructive, compassionate, or growth-oriented reframing of the original thought?
OR is it gibberish, an empty evasion, or just repeating the negative thought?

Respond ONLY with a valid JSON object matching this schema:
{
  "isValid": boolean,
  "score": number (0 to 100),
  "feedback": "Short 1-2 sentence coaching response explaining why it's a good reframe or what is missing"
}`;

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: "application/json", temperature: 0.2 }
        })
      });

      if (res.ok) {
        const data = await res.json();
        const rawJson = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (rawJson) {
          const parsed = JSON.parse(rawJson);
          return {
            isValid: Boolean(parsed.isValid),
            score: Number(parsed.score) || 80,
            feedback: parsed.feedback || "Well done! That reframe shifts the perspective towards growth.",
          };
        }
      }
    } catch (e) {
      console.warn("[QuestValidator Gemini check failed, using semantic fallback]:", e);
    }
  }

  // 2. Semantic NLP Fallback Analyzer
  return evaluateReframeSemantic(originalThought, userReframe);
}

function evaluateReframeSemantic(originalThought: string, reframe: string): ReframeEvaluation {
  const lower = reframe.toLowerCase();
  const origLower = originalThought.toLowerCase();

  // If user just typed the exact same negative thought
  if (lower === origLower || (origLower.length > 5 && lower.includes(origLower) && lower.length < origLower.length + 5)) {
    return {
      isValid: false,
      score: 20,
      feedback: "You've repeated the negative criticism. Try rewording it with understanding and a perspective of learning.",
    };
  }

  // Compassionate and growth-oriented markers
  const growthMarkers = [
    "learn", "learning", "grow", "growth", "progress", "practice", "trying", "my best",
    "patience", "human", "mistake", "step by step", "improve", "time", "capable",
    "handle", "okay to", "it is okay", "one day", "effort", "process", "breathe",
    "can get better", "not alone", "worthy", "proud", "forgive", "kind"
  ];

  // Defeatist markers (words that indicate the user doubled down on negativity)
  const defeatistMarkers = [
    "i am useless", "i hate myself", "i give up", "always fail", "never do anything right",
    "i suck", "loser", "stupid", "idiot", "worst person", "hopeless forever"
  ];

  let foundDefeatist = defeatistMarkers.some(m => lower.includes(m));
  if (foundDefeatist) {
    return {
      isValid: false,
      score: 15,
      feedback: "That still carries harsh self-criticism. Imagine what you would say to a close friend in this situation, and speak that same kindness to yourself.",
    };
  }

  let matchedGrowth = growthMarkers.filter(m => lower.includes(m));
  const wordCount = lower.split(/\s+/).length;

  if (matchedGrowth.length >= 1 || wordCount >= 7) {
    return {
      isValid: true,
      score: Math.min(95, 60 + matchedGrowth.length * 15),
      feedback: "Beautiful reframe! Framing setbacks as learning opportunities helps build long-term emotional resilience.",
      compassionAspect: matchedGrowth[0] || "growth mindset"
    };
  }

  return {
    isValid: false,
    score: 40,
    feedback: "You're getting close, but try to explicitly include self-compassion (e.g. 'I am doing my best', 'Mistakes help me learn', or 'I will take it step by step').",
  };
}


// ── 4. Sensory Grounding Check ───────────────────────────────────────────────
export function validateSensoryObservation(stepIndex: number, text: string): {
  isValid: boolean;
  feedback: string;
} {
  const gibberishCheck = detectGibberish(text);
  if (gibberishCheck.isGibberish) {
    return {
      isValid: false,
      feedback: gibberishCheck.reason || "Please describe real physical details around you.",
    };
  }

  const trimmed = text.trim();
  const words = trimmed.toLowerCase().split(/[\s,]+/);

  if (words.length < 1 || (words.length === 1 && words[0].length < 3)) {
    return {
      isValid: false,
      feedback: "Please name at least one specific object, texture, or sound in your immediate space.",
    };
  }

  return {
    isValid: true,
    feedback: `Anchored: "${trimmed}". Bringing attention to the immediate physical present interrupts cognitive loops.`,
  };
}
