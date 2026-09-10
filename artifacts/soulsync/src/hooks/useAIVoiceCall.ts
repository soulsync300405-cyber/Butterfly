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

  // 1. Local Indian voices first (zero network lag, never fails)
  const localIndian = voices.find(v => v.localService && /hi-IN|en-IN/i.test(v.lang));
  if (localIndian) return localIndian;

  // 2. High-quality neural Indian voices (Neerja, Swara, Heera)
  const neuralIndian = voices.find(v => /neerja|swara|heera/i.test(v.name));
  if (neuralIndian) return neuralIndian;

  // 3. Any Indian voice
  const anyIndian = voices.find(v => /hi-IN|en-IN/i.test(v.lang));
  if (anyIndian) return anyIndian;

  // 4. Any female voice (local preferred)
  const localFemale = voices.find(v => v.localService && /female|woman/i.test(v.name));
  if (localFemale) return localFemale;

  const anyFemale = voices.find(v => /female|woman/i.test(v.name));
  if (anyFemale) return anyFemale;

  // 5. Default voice
  const def = voices.find(v => v.default);
  if (def) return def;

  return voices[0] ?? null;
}

const hasSpeech = typeof window !== "undefined" && "speechSynthesis" in window;
const SRClass: any = typeof window !== "undefined"
  ? ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null)
  : null;
export const hasSR = !!SRClass;

// ── Core TTS with auto-fallback ───────────────────────────────────────────────
function ttsSpeak(text: string, onEnd: () => void, _useDefault = false): void {
  if (!hasSpeech || !text.trim()) {
    setTimeout(onEnd, 800);
    return;
  }

  // Ensure speech synthesis is active and not paused by Chrome
  try {
    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
    }
  } catch (_) {}

  const voice = _useDefault ? null : pickVoice();
  const utt = new SpeechSynthesisUtterance(text);

  if (voice) {
    utt.voice = voice;
    utt.lang  = voice.lang;
  } else {
    utt.lang = "en-US";
  }

  utt.rate   = 0.9;
  utt.pitch  = 1.05;
  utt.volume = 1;

  let started = false;
  let done    = false;
  let ka: ReturnType<typeof setInterval>;
  let onlineTimeout: ReturnType<typeof setTimeout> | null = null;
  let watchdog: ReturnType<typeof setTimeout> | null = null;

  const finish = () => {
    if (done) return;
    done = true;
    if (onlineTimeout) { clearTimeout(onlineTimeout); onlineTimeout = null; }
    if (watchdog) { clearTimeout(watchdog); watchdog = null; }
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
    try {
      window.speechSynthesis.speak(utt);
    } catch (err) {
      console.warn("[TTS speak err]", err);
      finish();
      return;
    }

    // Online voice safety net: if onstart hasn't fired in 1.2s, cancel & retry with default
    if (voice && !voice.localService && !_useDefault) {
      onlineTimeout = setTimeout(() => {
        if (!started && !done) {
          console.warn("[TTS] Voice timed out, retrying with default voice:", voice.name);
          // CRITICAL: detach listeners before cancelling so old utterance does NOT call finish()!
          utt.onerror = null;
          utt.onend = null;
          try { window.speechSynthesis.cancel(); } catch (_) {}
          ttsSpeak(text, onEnd, true); // retry with default
        }
      }, 1200);
    }

    // Safety watchdog: after speech duration timeout, force finish so loop never locks
    watchdog = setTimeout(() => {
      if (!done) {
        console.warn("[TTS watchdog] Speech timeout reached, continuing loop");
        finish();
      }
    }, Math.max(text.length * 110, 6000));

    // Keepalive for long responses (Chrome cuts off after ~15s)
    ka = setInterval(() => {
      if (done) { clearInterval(ka); return; }
      if (window.speechSynthesis.speaking) {
        window.speechSynthesis.pause();
        window.speechSynthesis.resume();
      } else {
        clearInterval(ka);
      }
    }, 8000);
  };

  if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
    try { window.speechSynthesis.cancel(); } catch (_) {}
    setTimeout(doSpeak, 80);
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
  const isProcessingRef   = useRef(false);
  const speechLangRef     = useRef<"en-IN" | "hi-IN">(defaultLang);
  const historyRef        = useRef<{ role: string; content: string }[]>([]);
  const recRef            = useRef<any>(null);
  const restartRef        = useRef<ReturnType<typeof setTimeout> | null>(null);
  const silenceTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const errorRef          = useRef<string | null>(null);
  const transcriptRef     = useRef("");
  const latestSpeechRef   = useRef("");

  // Self-ref avoids stale closure when startListening calls itself recursively
  const listenFnRef = useRef<() => void>(() => {});

  const setTx = (t: string) => { transcriptRef.current = t; setTranscript(t); };

  // Ensure voices are loaded (Chrome loads them lazily)
  useEffect(() => {
    if (!hasSpeech) return;
    const load = () => { getVoices(); };
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
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
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
    if (!activeRef.current || isProcessingRef.current) return;
    const cleanText = text.trim();
    if (cleanText.length <= 1) return;

    isProcessingRef.current = true;
    killRec();

    setCallState("thinking");
    setIsUserSpeaking(false);
    setTx(cleanText);
    historyRef.current.push({ role: "user", content: cleanText });

    let reply = "";
    try {
      reply = await getAIReply(cleanText);
    } catch (err) {
      console.warn("[Call AI reply err]", err);
    }

    if (!activeRef.current) {
      isProcessingRef.current = false;
      return;
    }

    if (!reply || !reply.trim()) {
      reply = "Haan yaar, main sun rahi hoon. Thoda aur detail mein batao?";
    }

    historyRef.current.push({ role: "assistant", content: reply });
    speakingRef.current = true;
    setCallState("speaking");
    setAshaText(reply);

    ttsSpeak(reply, () => {
      speakingRef.current = false;
      isProcessingRef.current = false;
      latestSpeechRef.current = "";

      if (activeRef.current) {
        if (!isMutedRef.current) {
          setCallState("listening");
          // 400ms cooldown so speaker echo does not re-enter mic
          setTimeout(() => {
            if (activeRef.current && !speakingRef.current && !isMutedRef.current) {
              setTx("");
              listenFnRef.current();
            }
          }, 400);
        } else {
          setCallState("listening");
        }
      }
    });
  }, [killRec, getAIReply]);

  // ── Start listening — Hands-Free Continuous Loop with Silence Detection ─────
  const startListening = useCallback(() => {
    if (!activeRef.current || speakingRef.current || isMutedRef.current || isProcessingRef.current) return;
    killRec();

    setCallState("listening");
    setIsUserSpeaking(false);
    errorRef.current = null;
    latestSpeechRef.current = "";

    if (!hasSR) return;

    const rec = new SRClass();
    recRef.current = rec;

    rec.lang = speechLangRef.current;
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 2;

    let accumulatedFinal = "";

    rec.onresult = (e: any) => {
      if (!activeRef.current || speakingRef.current || isProcessingRef.current) return;
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
        latestSpeechRef.current = combined;
        setTx(combined);
        setIsUserSpeaking(true);

        // Voice activity silence detection: when user pauses for 900ms after speaking, commit automatically!
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = setTimeout(() => {
          if (activeRef.current && !speakingRef.current && !isProcessingRef.current) {
            const speechToProcess = latestSpeechRef.current.trim();
            if (speechToProcess.length > 1) {
              processSpoken(speechToProcess);
            }
          }
        }, 900);
      }
    };

    rec.onerror = (e: any) => {
      const err = e.error as string;
      if (err === "no-speech" || err === "aborted") {
        return;
      }
      errorRef.current = err;
      if (err === "not-allowed") {
        setError("Microphone permission denied. Allow mic access in browser.");
      } else {
        console.warn("[SpeechRecognition error]", err);
      }
    };

    rec.onend = () => {
      recRef.current = null;
      if (!activeRef.current || speakingRef.current || isMutedRef.current || isProcessingRef.current) return;

      const speechToProcess = latestSpeechRef.current.trim();
      if (speechToProcess.length > 1) {
        processSpoken(speechToProcess);
      } else {
        // Restart smoothly to keep mic listening
        restartRef.current = setTimeout(() => {
          if (activeRef.current && !speakingRef.current && !isMutedRef.current && !isProcessingRef.current) {
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
