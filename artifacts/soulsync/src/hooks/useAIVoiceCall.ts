import { useRef, useState, useCallback, useEffect } from "react";
import { useStore } from "@/lib/store";
import { fetchGeminiDirect, ASHA_SYSTEM, sanitizeMessagesForGemini } from "@/lib/gemini";

export type AICallState = "idle" | "listening" | "thinking" | "speaking";

const CALL_SYSTEM = `${ASHA_SYSTEM}

VOICE CALL MODE — ADDITIONAL RULES:
- You are speaking OUT LOUD, not typing. Responses must sound natural when spoken.
- MAX 2-3 sentences. Be concise but complete.
- NO markdown, NO bullet points, NO emojis, NO asterisks, NO special characters.
- Speak like a caring friend on a phone call — warm, direct, conversational Hinglish.
- End with one short follow-up question to keep the conversation going.`;

function cleanForTTS(text: string): string {
  return text
    .replace(/[*_`#[\](){}|~>]/g, "")
    .replace(/\p{Emoji_Presentation}/gu, "")
    .replace(/\p{Extended_Pictographic}/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

// ── Voice loader ──────────────────────────────────────────────────────────────
function getVoices(): SpeechSynthesisVoice[] {
  return typeof window !== "undefined" ? window.speechSynthesis.getVoices() : [];
}

function pickVoice(): SpeechSynthesisVoice | null {
  const voices = getVoices();
  if (!voices.length) return null;

  // Log all voices once so we can see what's available
  if (!(window as any).__voicesLogged) {
    (window as any).__voicesLogged = true;
    console.log("[Asha Voices available]:\n" +
      voices.map(v => `  ${v.localService ? "✅LOCAL " : "☁️ONLINE"} | ${v.name} | ${v.lang}`).join("\n")
    );
  }

  // Priority: natural-sounding neural female voices first.
  // These sound much more human than local TTS voices.
  const priority = [
    // 🥇 Neerja/Swara — Indian female neural voices, perfect for Hinglish
    (v: SpeechSynthesisVoice) => /neerja|swara/i.test(v.name),
    // Indian female fallback
    (v: SpeechSynthesisVoice) => /heera/i.test(v.name),
    // Any female Indian voice (hi-IN or en-IN)
    (v: SpeechSynthesisVoice) => /hi-IN|en-IN/i.test(v.lang) && /female|woman/i.test(v.name),
    // Any Indian voice
    (v: SpeechSynthesisVoice) => /hi-IN|en-IN/i.test(v.lang),
    // Hindi generic
    (v: SpeechSynthesisVoice) => /hindi/i.test(v.name),
    // UK English female (sounds better for Hindi phonetics than US)
    (v: SpeechSynthesisVoice) => v.lang === "en-GB" && /female/i.test(v.name),
    // Any female voice globally
    (v: SpeechSynthesisVoice) => /female|woman/i.test(v.name),
    // Any English voice
    (v: SpeechSynthesisVoice) => v.lang.startsWith("en"),
  ];

  for (const fn of priority) {
    const match = voices.find(fn);
    if (match) {
      console.log("[Asha] Using voice:", match.name, `(${match.lang})`, match.localService ? "LOCAL" : "ONLINE");
      return match;
    }
  }
  return voices[0] ?? null;
}

const hasSpeech = typeof window !== "undefined" && "speechSynthesis" in window;
const SRClass: any = typeof window !== "undefined"
  ? ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null)
  : null;
export const hasSR = !!SRClass;

// ── Core TTS with auto-fallback ───────────────────────────────────────────────
// Tries the preferred voice. If it doesn't start within 1.5s (online voice
// failing silently), cancels and retries with the browser's default voice.
function ttsSpeak(text: string, onEnd: () => void, _useDefault = false): void {
  if (!hasSpeech || !text.trim()) {
    setTimeout(onEnd, Math.min(text.length * 55, 5000));
    return;
  }

  const voice = _useDefault ? null : pickVoice();
  const utt = new SpeechSynthesisUtterance(text);

  if (voice) {
    utt.voice = voice;
    utt.lang  = voice.lang;
  } else {
    // When voice=null: browser uses its own default — DO NOT force hi-IN here
    // because if the OS doesn't have a Hindi voice installed, forcing hi-IN 
    // causes the SpeechSynthesis engine to completely crash and stay silent!
    utt.lang = "en-US";
  }

  utt.rate   = 0.88;
  utt.pitch  = 1.1;
  utt.volume = 1;

  let started = false;
  let done    = false;
  let ka: ReturnType<typeof setInterval>;
  let onlineTimeout: ReturnType<typeof setTimeout> | null = null;

  const finish = () => {
    if (done) return;
    done = true;
    if (onlineTimeout) clearTimeout(onlineTimeout);
    clearInterval(ka);
    onEnd();
  };

  // onstart fires when audio actually begins playing
  utt.onstart = () => {
    started = true;
    if (onlineTimeout) { clearTimeout(onlineTimeout); onlineTimeout = null; }
  };

  utt.onend = finish;
  utt.onerror = (e) => {
    if (e.error !== "interrupted" && e.error !== "canceled") {
      console.warn("[TTS error]", e.error);
    }
    finish();
  };

  const doSpeak = () => {
    if (done) return;
    window.speechSynthesis.speak(utt);

    // Online voice safety net: if onstart hasn't fired in 1.5s, the online
    // voice silently failed → cancel and retry with browser default voice.
    if (voice && !voice.localService && !_useDefault) {
      onlineTimeout = setTimeout(() => {
        if (!started && !done) {
          console.warn("[TTS] Online voice timed out, falling back to default:", voice.name);
          window.speechSynthesis.cancel();
          ttsSpeak(text, onEnd, true); // retry with default
        }
      }, 1500);
    }

    // Keepalive for long responses (Chrome/Edge cut off after ~15s)
    ka = setInterval(() => {
      if (done) { clearInterval(ka); return; }
      if (window.speechSynthesis.speaking) {
        window.speechSynthesis.pause();
        window.speechSynthesis.resume();
      } else {
        clearInterval(ka);
      }
    }, 10000);
  };

  if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
    window.speechSynthesis.cancel();
    setTimeout(doSpeak, 120);
  } else {
    doSpeak();
  }
}

export function useAIVoiceCall(companionName: string, _voiceStyle?: string, defaultLang: "en-IN" | "hi-IN" = "en-IN") {
  const [callState, setCallState] = useState<AICallState>("idle");
  const [transcript, setTranscript] = useState("");
  const [ashaText, setAshaText]   = useState("");
  const [error, setError]         = useState<string | null>(null);
  const [isMuted, setIsMuted]     = useState(false);
  const [isUserSpeaking, setIsUserSpeaking] = useState(false);
  const [speechLang, setSpeechLang] = useState<"en-IN" | "hi-IN">(defaultLang);

  const { user } = useStore();
  const userName = user?.name || "Student";

  const activeRef         = useRef(false);
  const speakingRef       = useRef(false);
  const isMutedRef        = useRef(false);
  const speechLangRef     = useRef<"en-IN" | "hi-IN">(defaultLang);
  const historyRef        = useRef<{ role: string; content: string }[]>([]);
  const recRef            = useRef<any>(null);
  const restartRef        = useRef<ReturnType<typeof setTimeout> | null>(null);
  const silenceTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const errorRef          = useRef<string | null>(null);
  const transcriptRef     = useRef("");

  // Self-ref avoids stale closure when startListening calls itself recursively
  const listenFnRef = useRef<() => void>(() => {});

  const setTx = (t: string) => { transcriptRef.current = t; setTranscript(t); };

  // Ensure voices are loaded (Chrome loads them lazily)
  useEffect(() => {
    if (!hasSpeech) return;
    const load = () => { /* accessing getVoices() triggers caching */ getVoices(); };
    load();
    window.speechSynthesis.addEventListener("voiceschanged", load);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", load);
  }, []);

  // ── Get AI reply ────────────────────────────────────────────────────────────
  const getAIReply = useCallback(async (userText: string): Promise<string> => {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY || "";
    const msgs = [...historyRef.current, { role: "user", content: userText }];

    if (apiKey) {
      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: sanitizeMessagesForGemini(msgs),
              systemInstruction: { parts: [{ text: CALL_SYSTEM }] },
              generationConfig: {
                maxOutputTokens: 200,
                temperature: 0.88,
                topP: 0.95,
                thinkingConfig: { thinkingBudget: 0 },
              },
            }),
          }
        );
        if (res.ok) {
          const data = await res.json();
          const parts = data?.candidates?.[0]?.content?.parts ?? [];
          const tp = parts.find((p: any) => p.text && !p.thought);
          const raw = (tp?.text ?? parts[0]?.text ?? "").trim();
          const cleaned = cleanForTTS(raw);
          if (cleaned) return cleaned;
        }
      } catch (e) { console.warn("[Call AI]", e); }
    }

    const reply = await fetchGeminiDirect(msgs, null);
    return cleanForTTS(reply);
  }, []);

  // ── Kill recognition instance ───────────────────────────────────────────────
  const killRec = useCallback(() => {
    if (restartRef.current) { clearTimeout(restartRef.current); restartRef.current = null; }
    if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null; }
    if (recRef.current) {
      try {
        recRef.current.onend = null;
        recRef.current.onerror = null;
        recRef.current.onresult = null;
        recRef.current.abort();
      } catch (_) {}
      recRef.current = null;
    }
  }, []);

  // ── Process user speech → AI reply → speak ─────────────────────────────────
  const processSpoken = useCallback(async (text: string) => {
    if (!activeRef.current) return;
    killRec();

    setCallState("thinking");
    setIsUserSpeaking(false);
    historyRef.current.push({ role: "user", content: text });

    const reply = await getAIReply(text);
    if (!activeRef.current) return;

    historyRef.current.push({ role: "assistant", content: reply });
    speakingRef.current = true;
    setCallState("speaking");
    setAshaText(reply);

    ttsSpeak(reply, () => {
      speakingRef.current = false;
      if (activeRef.current) {
        if (!isMutedRef.current) {
          setCallState("listening");
          // Cooldown before opening mic so speaker echo/reverb doesn't re-enter mic
          setTimeout(() => {
            if (activeRef.current && !speakingRef.current && !isMutedRef.current) {
              setTx("");
              listenFnRef.current();
            }
          }, 350);
        } else {
          setCallState("listening");
        }
      }
    });
  }, [killRec, getAIReply]);

  // ── Start listening — Hands-Free Continuous Loop with Silence Detection ─────
  const startListening = useCallback(() => {
    if (!activeRef.current || speakingRef.current || isMutedRef.current) return;
    killRec();

    setCallState("listening");
    setTx("");
    setIsUserSpeaking(false);
    errorRef.current = null;

    if (!hasSR) return;

    const rec = new SRClass();
    recRef.current = rec;

    rec.lang = speechLangRef.current;
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 2;

    let accumulatedFinal = "";

    rec.onresult = (e: any) => {
      if (!activeRef.current || speakingRef.current) return;
      let interimStr = "";

      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) {
          accumulatedFinal += r[0].transcript + " ";
        } else {
          interimStr += r[0].transcript;
        }
      }

      const combined = (accumulatedFinal + interimStr).trim();
      if (combined) {
        setTx(combined);
        setIsUserSpeaking(true);

        // Voice activity silence detection: when user pauses for 1300ms after speaking, commit automatically!
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = setTimeout(() => {
          if (activeRef.current && !speakingRef.current && combined.length > 1) {
            processSpoken(combined);
          }
        }, 1300);
      }
    };

    rec.onerror = (e: any) => {
      const err = e.error as string;
      if (err === "no-speech" || err === "aborted") {
        // Natural idle pauses or intentional cancellation — do not treat as fatal error
        return;
      }
      errorRef.current = err;
      if (err === "not-allowed") {
        setError("Microphone permission denied. Allow mic access in browser.");
      } else if (err === "network") {
        console.warn("[SpeechRecognition] network warning");
      } else {
        console.warn("[SpeechRecognition error]", err);
      }
    };

    rec.onend = () => {
      recRef.current = null;
      if (!activeRef.current || speakingRef.current || isMutedRef.current) return;

      const pending = transcriptRef.current.trim();
      if (pending.length > 1) {
        processSpoken(pending);
      } else {
        // Restart smoothly if stopped by browser timeout while still listening
        restartRef.current = setTimeout(() => {
          if (activeRef.current && !speakingRef.current && !isMutedRef.current) {
            listenFnRef.current();
          }
        }, 200);
      }
    };

    try {
      rec.start();
    } catch (startErr: any) {
      console.warn("[SR start]", startErr?.message);
      recRef.current = null;
      restartRef.current = setTimeout(() => listenFnRef.current(), 400);
    }
  }, [killRec, processSpoken]);

  // Keep ref current to avoid stale closure in recursive restarts
  useEffect(() => { listenFnRef.current = startListening; }, [startListening]);

  // ── Interrupt Asha immediately ─────────────────────────────────────────────
  const interruptAsha = useCallback(() => {
    if (!activeRef.current) return;
    if (hasSpeech) {
      try { window.speechSynthesis.cancel(); } catch (_) {}
    }
    speakingRef.current = false;
    if (!isMutedRef.current) {
      setCallState("listening");
      setTx("");
      startListening();
    }
  }, [startListening]);

  // ── Commit current speech immediately (Skip silence wait) ───────────────────
  const commitCurrentSpeech = useCallback(() => {
    const text = transcriptRef.current.trim();
    if (text.length > 0 && activeRef.current) {
      processSpoken(text);
    }
  }, [processSpoken]);

  // ── Mic Mute / Unmute ──────────────────────────────────────────────────────
  const toggleMute = useCallback(() => {
    setIsMuted(prev => {
      const next = !prev;
      isMutedRef.current = next;
      if (next) {
        killRec();
        setIsUserSpeaking(false);
      } else {
        if (activeRef.current && !speakingRef.current) {
          startListening();
        }
      }
      return next;
    });
  }, [killRec, startListening]);

  // ── Language Selector ──────────────────────────────────────────────────────
  const setLanguage = useCallback((lang: "en-IN" | "hi-IN") => {
    setSpeechLang(lang);
    speechLangRef.current = lang;
    if (activeRef.current && !speakingRef.current && !isMutedRef.current) {
      startListening();
    }
  }, [startListening]);

  // ── Push-to-talk backwards compatibility ───────────────────────────────────
  const startPTT = useCallback(() => {
    if (isMutedRef.current) toggleMute();
    startListening();
  }, [toggleMute, startListening]);

  const stopPTT = useCallback(() => {
    commitCurrentSpeech();
  }, [commitCurrentSpeech]);

  // ── Send typed text ────────────────────────────────────────────────────────
  const sendText = useCallback(async (text: string) => {
    if (!text.trim() || !activeRef.current) return;
    killRec();
    await processSpoken(text.trim());
  }, [killRec, processSpoken]);

  const clearError = useCallback(() => {
    setError(null);
    errorRef.current = null;
    if (activeRef.current && !speakingRef.current && !isMutedRef.current) {
      startListening();
    }
  }, [startListening]);

  // ── startCall ───────────────────────────────────────────────────────────────
  const startCall = useCallback(() => {
    activeRef.current = true;
    speakingRef.current = true;
    isMutedRef.current = false;
    setIsMuted(false);
    setIsUserSpeaking(false);
    errorRef.current = null;
    historyRef.current = [];
    setError(null);
    setTx("");
    setCallState("speaking");

    const greeting = `Hey ${userName}! Main ${companionName} hoon. Aaj kaisa lag raha hai? Main sun rahi hoon, batao.`;
    setAshaText(greeting);
    historyRef.current.push({ role: "assistant", content: greeting });

    ttsSpeak(greeting, () => {
      speakingRef.current = false;
      if (activeRef.current && !isMutedRef.current) {
        setCallState("listening");
        setTimeout(() => {
          if (activeRef.current && !speakingRef.current && !isMutedRef.current) {
            setTx("");
            startListening();
          }
        }, 350);
      }
    });
  }, [companionName, userName, startListening]);

  // ── stopCall ────────────────────────────────────────────────────────────────
  const stopCall = useCallback(() => {
    activeRef.current = false;
    speakingRef.current = false;
    isMutedRef.current = false;
    errorRef.current = null;
    if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null; }
    killRec();
    if (hasSpeech) { try { window.speechSynthesis.cancel(); } catch (_) {} }
    setCallState("idle");
    setTx("");
    setAshaText("");
    setIsUserSpeaking(false);
    setError(null);
  }, [killRec]);

  useEffect(() => () => {
    activeRef.current = false;
    killRec();
    if (hasSpeech) { try { window.speechSynthesis.cancel(); } catch (_) {} }
  }, [killRec]);

  return {
    callState, transcript, ashaText, error,
    isMuted, isUserSpeaking, speechLang,
    startCall, stopCall, sendText, clearError,
    toggleMute, setLanguage, interruptAsha, commitCurrentSpeech,
    startPTT, stopPTT,
    hasSpeech, hasSR,
  };
}
