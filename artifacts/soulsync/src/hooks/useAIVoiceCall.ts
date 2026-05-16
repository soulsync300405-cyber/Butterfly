import { useRef, useState, useCallback, useEffect } from "react";

export type AICallState = "idle" | "listening" | "thinking" | "speaking";

const ASHA_VOICE_REPLIES: { keywords: string[]; replies: string[] }[] = [
  {
    keywords: ["neend", "sleep", "sona", "raat", "jaag"],
    replies: [
      "Neend nahi aa rahi? Main samajh sakti hoon yaar. Chalo ek kaam karte hain — phone rakh do, aankhein band karo, aur meri awaaz suno. Breathe in slowly... 1, 2, 3, 4.",
      "Sleep problems bahut common hain, especially jab stress zyada hota hai. Kya aaj raat koi specific cheez hai jo mind mein chal rahi hai?",
    ],
  },
  {
    keywords: ["anxious", "anxiety", "nervous", "ghabra", "darr", "scared"],
    replies: [
      "Anxiety feel ho raha hai? Body mein kaahan feel ho raha hai — chest mein, stomach mein? Let's ground ourselves. 5 cheezein batao jo tum abhi dekh sakte ho.",
      "Ye feelings real hain aur valid hain. Main yahan hoon. Ek deep breath lo mere saath — breathe in 4 counts, hold 4, out 4. Try karte hain?",
    ],
  },
  {
    keywords: ["exam", "test", "study", "padhai", "marks", "fail"],
    replies: [
      "Exams ka pressure bahut real hota hai. Lekin ek cheez yaad raho — tum sirf ek exam nahi ho. Tum ek poora insaan ho. Abhi sirf ek step — kaunsa subject sabse hard lag raha hai?",
      "Exam stress ke time mein body ko extra care chahiye. Paani piya? Thoda khaya? Chhoti chhoti cheezein count karti hain.",
    ],
  },
  {
    keywords: ["sad", "udaas", "dukhi", "cry", "rona", "depressed", "bura"],
    replies: [
      "Udaas feel ho raha hai. Ye bilkul theek hai — emotions ko feel karna important hai. Kya hua? Batana chahoge?",
      "Kabhi kabhi sirf kisi ke saath baat karna hi kaafi hota hai. Main sun rahi hoon, poori tarah. Share karo.",
    ],
  },
  {
    keywords: ["overwhelmed", "bohot", "bahut", "zyada", "overload", "thak"],
    replies: [
      "Overwhelmed feel ho raha hai — bilkul samajh sakti hoon. Jab sab kuch ek saath aata hai toh bahut heavy lagta hai. Aaj ke liye sirf ek kaam choose karo. Baki kal ke liye.",
      "Thakaan real hai. Body aur mind dono ko rest chahiye. Kya aaj kuch ek cheez thi jo acchi lagi, chahe kitni bhi chhoti ho?",
    ],
  },
  {
    keywords: ["lonely", "akela", "friends", "dost", "relationship", "pyar", "love"],
    replies: [
      "Akela feel karna bahut difficult hota hai. Lekin yaad raho — tum yahan ho, aur main yahan hoon. Ye connection real hai.",
      "Relationships complicated hoti hain. Kya koi specific situation hai jo bother kar rahi hai? Bata sakte ho openly.",
    ],
  },
  {
    keywords: ["better", "acha", "theek", "good", "happy", "khush", "great"],
    replies: [
      "Yeh sunke bahut accha laga! Kya hua? Share karo — good news celebrate karni chahiye!",
      "Bahut achha! Ye progress hai. Chhoti victories bhi matter karti hain. Tumne kya kiya alag is baar?",
    ],
  },
  {
    keywords: ["hello", "hi", "heyy", "kaise", "how", "namaste", "hey"],
    replies: [
      "Heyy! Aaj kaisa feel ho raha hai? Main yahan hoon poori tarah tumhare liye.",
      "Hi yaar! Batao — aaj din kaisa chal raha hai? Kuch hua jo share karna chahte ho?",
    ],
  },
];

const DEFAULT_REPLIES = [
  "Haan, main sun rahi hoon. Thoda aur batao — kya specifically bother kar raha hai tumhe?",
  "Interesting. Aur jab aisa hota hai, body mein kya feel hota hai? Koi tightness chest mein ya stomach mein?",
  "Main samajh sakti hoon. Ye feelings bahut real hain. Tum akele nahi ho is mein.",
  "Ye baat soch ke dekho — agar koi dost yahi situation mein hota toh tum usse kya kehte?",
  "Hmm, ye sunke lagta hai ki tum bahut strong ho, even if it doesn't feel that way right now.",
  "Acha, aur kab se yeh feel ho raha hai? Koi specific moment tha jab ye shuru hua?",
  "Main yahan hoon. Baat karte rehte hain. Koi rush nahi hai.",
];

function pickReply(transcript: string): string {
  const lower = transcript.toLowerCase();
  for (const entry of ASHA_VOICE_REPLIES) {
    if (entry.keywords.some(kw => lower.includes(kw))) {
      return entry.replies[Math.floor(Math.random() * entry.replies.length)];
    }
  }
  return DEFAULT_REPLIES[Math.floor(Math.random() * DEFAULT_REPLIES.length)];
}

type SpeechRecognitionInstance = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: { results: { [i: number]: { [i: number]: { transcript: string } } } }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

export function useAIVoiceCall(companionName: string, companionVoice?: string) {
  const [callState, setCallState] = useState<AICallState>("idle");
  const [transcript, setTranscript] = useState("");
  const [ashaText, setAshaText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const synthRef = useRef(window.speechSynthesis);
  const activeRef = useRef(false);

  const speak = useCallback((text: string, onDone?: () => void) => {
    synthRef.current.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    utt.lang = "hi-IN";
    utt.rate = 0.95;
    utt.pitch = 1.1;

    if (companionVoice) {
      const voices = synthRef.current.getVoices();
      const match = voices.find(v => v.name.toLowerCase().includes(companionVoice.toLowerCase()));
      if (match) utt.voice = match;
    }

    utt.onend = () => {
      setCallState("listening");
      onDone?.();
    };
    setCallState("speaking");
    setAshaText(text);
    synthRef.current.speak(utt);
  }, [companionVoice]);

  const startListening = useCallback(() => {
    if (!activeRef.current) return;
    const SR = (window as unknown as Record<string, unknown>)["SpeechRecognition"] as (new () => SpeechRecognitionInstance) | undefined
      || (window as unknown as Record<string, unknown>)["webkitSpeechRecognition"] as (new () => SpeechRecognitionInstance) | undefined;

    if (!SR) {
      setError("Speech recognition not supported in this browser.");
      return;
    }

    const recognition = new SR();
    recognitionRef.current = recognition;
    recognition.lang = "hi-IN";
    recognition.interimResults = true;
    recognition.continuous = false;

    recognition.onresult = (e) => {
      const t = e.results[0][0].transcript;
      setTranscript(t);
    };

    recognition.onerror = (e) => {
      if (e.error !== "no-speech" && e.error !== "aborted") {
        setError(`Mic error: ${e.error}`);
      }
    };

    recognition.onend = () => {
      if (!activeRef.current) return;
      const finalTranscript = transcript;
      if (finalTranscript.trim().length > 2) {
        setCallState("thinking");
        setTimeout(() => {
          if (!activeRef.current) return;
          const reply = pickReply(finalTranscript);
          setTranscript("");
          speak(reply, () => {
            if (activeRef.current) {
              setTimeout(startListening, 600);
            }
          });
        }, 800 + Math.random() * 600);
      } else {
        setTimeout(startListening, 400);
      }
    };

    setCallState("listening");
    try { recognition.start(); } catch (_) {}
  }, [transcript, speak]);

  const startCall = useCallback(() => {
    activeRef.current = true;
    setCallState("speaking");
    setError(null);
    const greeting = `Heyy! ${companionName} bol rahi hoon. Aaj kaisa feel ho raha hai? Main poori tarah yahan hoon tumhare liye.`;
    setAshaText(greeting);
    speak(greeting, () => {
      if (activeRef.current) setTimeout(startListening, 500);
    });
  }, [companionName, speak, startListening]);

  const stopCall = useCallback(() => {
    activeRef.current = false;
    recognitionRef.current?.abort();
    synthRef.current.cancel();
    setCallState("idle");
    setTranscript("");
    setAshaText("");
  }, []);

  useEffect(() => {
    return () => {
      activeRef.current = false;
      recognitionRef.current?.abort();
      synthRef.current.cancel();
    };
  }, []);

  return { callState, transcript, ashaText, error, startCall, stopCall };
}
