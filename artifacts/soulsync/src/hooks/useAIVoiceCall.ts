import { useRef, useState, useCallback, useEffect } from "react";

export type AICallState = "idle" | "listening" | "thinking" | "speaking";

const VOICE_REPLIES: { test: RegExp; replies: string[] }[] = [
  {
    test: /neend|sona|jaag|raat|sleep|tired|thak/,
    replies: [
      "Neend nahi aa rahi? Main samajh sakti hoon. Aaj raat ek cheez try karo — phone 9:30 pe band, ek boring book, aur room thoda thanda. Kaunsa sabse possible lagta hai?",
      "Teen din se yeh sun rahi hoon tum se. Body ko real rest chahiye. Kya koi specific cheez hai jo mind mein chal rahi hai sone se pehle?",
    ],
  },
  {
    test: /anxious|anxiety|darr|scared|ghabra|nervous|panic/,
    replies: [
      "Chalo abhi ek kaam karte hain. 5 cheezein batao jo tumhe abhi dikh rahi hain — seedha batao, main sun rahi hoon.",
      "Anxiety feel ho raha hai? Body mein kahan hai ye — chest mein, stomach mein? Breathe in 4 counts mere saath. Ready?",
    ],
  },
  {
    test: /sad|udaas|dukhi|cry|rona|depressed|bura|hurt/,
    replies: [
      "Ye sunke dil bhaari ho gaya. Ye feelings suppress mat karo — valid hain. Kya specific kuch hua hai ya general heaviness hai?",
      "Kabhi kabhi sirf kisi ke saath hona hi kaafi hota hai. Main yahan hoon, poori tarah. Batao kya chal raha hai.",
    ],
  },
  {
    test: /exam|test|padhai|study|marks|fail|result/,
    replies: [
      "Exam pressure real hai. Sirf ek subject, ek topic — abhi. Kaunsa confident lagta hai? Wahan se shuru karte hain.",
      "Poora syllabus ek saath nahi hoga. Aaj ke liye sirf 2 ghante focused karo. Kaunsa topic pehle?",
    ],
  },
  {
    test: /overwhelmed|too much|overload|sab kuch|bahut zyada/,
    replies: [
      "Ruko. Deep breath pehle. Sirf 3 cheezein batao jo aaj MUST hain — baaki kal ke liye. Kya hain ve teen?",
      "Jab sab kuch ek saath aata hai, list help karti hai. Abhi ek notepad lo aur sab kuch likh do — mind clear hoga.",
    ],
  },
  {
    test: /lonely|akela|dost|friends|koi nahi|alone/,
    replies: [
      "Akela feel karna bahut heavy hota hai. Is waqt hum dono hain yahan — ye bhi real connection hai. Kab se feel ho raha hai yeh?",
      "Relationships complicated hoti hain. Koi specific person hai jiske baare mein soch rahe ho, ya general loneliness hai?",
    ],
  },
  {
    test: /better|theek|acha|good|happy|khush|improve/,
    replies: [
      "Yeh sunke bahut achha laga! Seriously — kya hua? Share karo, main celebrate karna chahti hoon tumhare saath!",
      "Chhoti victories bhi matter karti hain. Tumne kya kiya alag is baar?",
    ],
  },
  {
    test: /focus|dhyan|concentrate|distracted|productivity/,
    replies: [
      "Focus ke liye Pomodoro try karo — 25 min full focus, 5 min break. Phone dusre room mein. Aaj 2 rounds karo?",
      "Distraction real struggle hai. Kya specific cheez distract kar rahi hai — phone, noise, ya thoughts?",
    ],
  },
  {
    test: /hi|hello|heyy|hey|namaste|kaise|how are/,
    replies: [
      "Heyy! Main theek hoon, tumhare liye ready! Batao — aaj din kaisa chal raha hai?",
      "Haan yaar, main yahan hoon! Kuch specific hua jo share karna hai, ya bas baat karni hai?",
    ],
  },
];

const FALLBACK = [
  "Interesting. Aur jab aisa hota hai, body mein kya feel hota hai?",
  "Main sun rahi hoon properly. Thoda aur expand karo — kab se yeh chal raha hai?",
  "Ye baat soch ke dekho — agar tumhara best friend yahi situation mein hota, tum use kya kehte?",
  "Hmm. Kya koi specific moment tha jab ye shuru hua?",
  "Is waqt jo feel ho raha hai — agar ek word mein kehna ho toh kya hoga?",
];

function pickReply(transcript: string) {
  const lower = transcript.toLowerCase();
  for (const entry of VOICE_REPLIES) {
    if (entry.test.test(lower)) {
      return entry.replies[Math.floor(Math.random() * entry.replies.length)];
    }
  }
  return FALLBACK[Math.floor(Math.random() * FALLBACK.length)];
}

const hasSpeech = typeof window !== "undefined" && "speechSynthesis" in window;
const hasSR = typeof window !== "undefined" &&
  ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

export function useAIVoiceCall(companionName: string, _voiceStyle?: string) {
  const [callState, setCallState] = useState<AICallState>("idle");
  const [transcript, setTranscript] = useState("");
  const [ashaText, setAshaText] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Use a ref so recognition.onend always reads the LATEST transcript (avoids stale closure)
  const transcriptRef = useRef("");
  const activeRef = useRef(false);
  const recognitionRef = useRef<any>(null);

  const updateTranscript = (t: string) => {
    transcriptRef.current = t;
    setTranscript(t);
  };

  const speak = useCallback((text: string, onDone?: () => void) => {
    setCallState("speaking");
    setAshaText(text);

    if (!hasSpeech) {
      // No speech synthesis — simulate timing and move on
      const delay = Math.min(text.length * 60, 5000);
      setTimeout(() => {
        setCallState("listening");
        onDone?.();
      }, delay);
      return;
    }

    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    utt.lang = "hi-IN";
    utt.rate = 0.92;
    utt.pitch = 1.1;

    // Pick a female voice if available
    const voices = window.speechSynthesis.getVoices();
    const female = voices.find(v =>
      v.lang.startsWith("hi") || v.name.toLowerCase().includes("female") || v.name.toLowerCase().includes("zira")
    );
    if (female) utt.voice = female;

    utt.onend = () => {
      setCallState("listening");
      onDone?.();
    };
    utt.onerror = () => {
      setCallState("listening");
      onDone?.();
    };

    window.speechSynthesis.speak(utt);
  }, []);

  const startListening = useCallback(() => {
    if (!activeRef.current) return;

    if (!hasSR) {
      // No speech recognition — stay in "listening" state visually, do nothing
      setCallState("listening");
      return;
    }

    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SR();
    recognitionRef.current = recognition;

    recognition.lang = "hi-IN";
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (e: any) => {
      const t = Array.from(e.results as any[])
        .map((r: any) => r[0].transcript)
        .join("");
      updateTranscript(t);
    };

    recognition.onerror = (e: any) => {
      if (e.error !== "no-speech" && e.error !== "aborted") {
        setError(`Mic: ${e.error}`);
      }
    };

    recognition.onend = () => {
      if (!activeRef.current) return;
      const finalTranscript = transcriptRef.current; // ← always latest via ref
      updateTranscript("");

      if (finalTranscript.trim().length > 2) {
        setCallState("thinking");
        setTimeout(() => {
          if (!activeRef.current) return;
          const reply = pickReply(finalTranscript);
          speak(reply, () => {
            if (activeRef.current) setTimeout(startListening, 700);
          });
        }, 700 + Math.random() * 500);
      } else {
        // Nothing heard — keep listening
        setTimeout(startListening, 500);
      }
    };

    setCallState("listening");
    try { recognition.start(); } catch (_) {}
  }, [speak]);

  const startCall = useCallback(() => {
    activeRef.current = true;
    setError(null);
    updateTranscript("");

    const greeting = `Heyy! ${companionName} bol rahi hoon. Aaj kaisa feel ho raha hai? Main poori tarah yahan hoon tumhare liye.`;
    speak(greeting, () => {
      if (activeRef.current) setTimeout(startListening, 600);
    });
  }, [companionName, speak, startListening]);

  const stopCall = useCallback(() => {
    activeRef.current = false;
    try { recognitionRef.current?.abort(); } catch (_) {}
    if (hasSpeech) try { window.speechSynthesis.cancel(); } catch (_) {}
    setCallState("idle");
    updateTranscript("");
    setAshaText("");
  }, []);

  useEffect(() => {
    return () => {
      activeRef.current = false;
      try { recognitionRef.current?.abort(); } catch (_) {}
      if (hasSpeech) try { window.speechSynthesis.cancel(); } catch (_) {}
    };
  }, []);

  return { callState, transcript, ashaText, error, startCall, stopCall, hasSpeech, hasSR };
}
