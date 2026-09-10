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

export interface VoicePersona {
  id: string;
  name: string;
  emoji: string;
  gender: "female" | "male";
  accent: string;
  pitch: number;
  rate: number;
  description: string;
  searchFilter: (v: SpeechSynthesisVoice) => boolean;
}

export const VOICE_PERSONAS: VoicePersona[] = [
  {
    id: "asha-warm",
    name: "Asha",
    emoji: "🌸",
    gender: "female",
    accent: "Warm Indian Female",
    pitch: 1.08,
    rate: 0.90,
    description: "Empathetic, warm, older sister companion",
    searchFilter: (v) => /neerja|swara|heera/i.test(v.name) || (/hi-IN|en-IN/i.test(v.lang) && /female|woman/i.test(v.name)),
  },
  {
    id: "ananya-calm",
    name: "Ananya",
    emoji: "🌿",
    gender: "female",
    accent: "Soft & Soothing",
    pitch: 1.16,
    rate: 0.82,
    description: "Very gentle, mindful, relaxed tone for anxiety relief",
    searchFilter: (v) => /neerja|swara|heera/i.test(v.name) || (/hi-IN|en-IN/i.test(v.lang) && /female/i.test(v.name)),
  },
  {
    id: "riya-energetic",
    name: "Riya",
    emoji: "⚡",
    gender: "female",
    accent: "Cheerful Hinglish",
    pitch: 1.12,
    rate: 1.00,
    description: "Upbeat, lively, cheerful best-friend energy",
    searchFilter: (v) => /neerja|heera|swara/i.test(v.name) || (/hi-IN|en-IN/i.test(v.lang) && /female/i.test(v.name)),
  },
  {
    id: "arjun-male",
    name: "Arjun",
    emoji: "👔",
    gender: "male",
    accent: "Calm Indian Male",
    pitch: 0.90,
    rate: 0.88,
    description: "Supportive, grounded brotherly companion",
    searchFilter: (v) => /ravi|prabhat|madhav|arjun/i.test(v.name) || (/hi-IN|en-IN/i.test(v.lang) && /male|man/i.test(v.name)),
  },
  {
    id: "kabir-deep",
    name: "Kabir",
    emoji: "🎙️",
    gender: "male",
    accent: "Deep Indian Male",
    pitch: 0.78,
    rate: 0.85,
    description: "Deep, reassuring, strong grounding voice",
    searchFilter: (v) => /ravi|prabhat|david|mark|george/i.test(v.name) || /male|man/i.test(v.name),
  },
  {
    id: "grace-global",
    name: "Grace",
    emoji: "🌐",
    gender: "female",
    accent: "Natural Global English",
    pitch: 1.05,
    rate: 0.92,
    description: "Polite, crystal-clear international accent",
    searchFilter: (v) => (v.lang === "en-GB" || v.lang === "en-US") && /female/i.test(v.name),
  },
];

function pickVoice(
  persona?: VoicePersona,
  customVoiceURI?: string
): { voice: SpeechSynthesisVoice | null; pitch: number; rate: number } {
  const voices = getVoices();
  const activePersona = persona || VOICE_PERSONAS[0];
  const targetPitch = activePersona.pitch;
  const targetRate = activePersona.rate;

  if (!voices.length) {
    return { voice: null, pitch: targetPitch, rate: targetRate };
  }

  // 1. Explicit user-selected device voice
  if (customVoiceURI) {
    const custom = voices.find(v => v.voiceURI === customVoiceURI || v.name === customVoiceURI);
    if (custom) return { voice: custom, pitch: targetPitch, rate: targetRate };
  }

  // 2. Persona search filter
  const personaMatch = voices.find(activePersona.searchFilter);
  if (personaMatch) return { voice: personaMatch, pitch: targetPitch, rate: targetRate };

  // 3. Indian voices matching gender
  if (activePersona.gender === "male") {
    const maleInd = voices.find(v => /hi-IN|en-IN/i.test(v.lang) && !/female|woman/i.test(v.name));
    if (maleInd) return { voice: maleInd, pitch: targetPitch, rate: targetRate };
    const anyMale = voices.find(v => /male|man/i.test(v.name) || (v.lang.startsWith("en") && !/female|woman/i.test(v.name)));
    if (anyMale) return { voice: anyMale, pitch: targetPitch, rate: targetRate };
  } else {
    const localIndian = voices.find(v => v.localService && /hi-IN|en-IN/i.test(v.lang));
    if (localIndian) return { voice: localIndian, pitch: targetPitch, rate: targetRate };
    const anyIndian = voices.find(v => /hi-IN|en-IN/i.test(v.lang));
    if (anyIndian) return { voice: anyIndian, pitch: targetPitch, rate: targetRate };
    const anyFemale = voices.find(v => /female|woman/i.test(v.name));
    if (anyFemale) return { voice: anyFemale, pitch: targetPitch, rate: targetRate };
  }

  // 4. Default voice
  const def = voices.find(v => v.default) || voices[0] || null;
  return { voice: def, pitch: targetPitch, rate: targetRate };
}

const hasSpeech = typeof window !== "undefined" && "speechSynthesis" in window;
const SRClass: any = typeof window !== "undefined"
  ? ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null)
  : null;
export const hasSR = !!SRClass;

// ── Core TTS with auto-fallback ───────────────────────────────────────────────
function ttsSpeak(
  text: string,
  onEnd: () => void,
  persona?: VoicePersona,
  customVoiceURI?: string,
  _useDefault = false
): void {
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

  const picked = _useDefault
    ? { voice: null, pitch: persona ? persona.pitch : 1, rate: persona ? persona.rate : 0.9 }
    : pickVoice(persona, customVoiceURI);

  const utt = new SpeechSynthesisUtterance(text);

  if (picked.voice) {
    utt.voice = picked.voice;
    utt.lang  = picked.voice.lang;
  } else {
    utt.lang = "en-US";
  }

  utt.rate   = picked.rate;
  utt.pitch  = picked.pitch;
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
    if (picked.voice && !picked.voice.localService && !_useDefault) {
      onlineTimeout = setTimeout(() => {
        if (!started && !done) {
          console.warn("[TTS] Voice timed out, retrying with default voice:", picked.voice?.name);
          utt.onerror = null;
          utt.onend = null;
          try { window.speechSynthesis.cancel(); } catch (_) {}
          ttsSpeak(text, onEnd, persona, customVoiceURI, true);
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

export function useAIVoiceCall(
  companionName: string,
  voiceStyle?: string,
  defaultLang: "en-IN" | "hi-IN" = "en-IN",
  companionGender?: "female" | "male" | "nonbinary" | string
) {
  const [callState, setCallState] = useState<AICallState>("idle");
  const [transcript, setTranscript] = useState("");
  const [ashaText, setAshaText]   = useState("");
  const [error, setError]         = useState<string | null>(null);
  const [isMuted, setIsMuted]     = useState(false);
  const [isUserSpeaking, setIsUserSpeaking] = useState(false);
  const [speechLang, setSpeechLang] = useState<"en-IN" | "hi-IN">(defaultLang);

  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedPersonaId, setSelectedPersonaId] = useState<string>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("soulsync_voice_persona");
      if (saved && VOICE_PERSONAS.some(p => p.id === saved)) return saved;
    }
    if (companionGender === "male") return "arjun-male";
    if (voiceStyle === "Energetic" || voiceStyle === "Witty") return "riya-energetic";
    if (voiceStyle === "Calm") return "ananya-calm";
    return "asha-warm";
  });
  const [selectedVoiceURI, setSelectedVoiceURI] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("soulsync_voice_uri") || "";
    }
    return "";
  });

  const selectedPersonaRef = useRef(selectedPersonaId);
  const selectedVoiceURIRef = useRef(selectedVoiceURI);

  useEffect(() => {
    selectedPersonaRef.current = selectedPersonaId;
  }, [selectedPersonaId]);

  useEffect(() => {
    selectedVoiceURIRef.current = selectedVoiceURI;
  }, [selectedVoiceURI]);

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
    const load = () => {
      const v = getVoices();
      if (v && v.length > 0) setAvailableVoices(v);
    };
    load();
    window.speechSynthesis.addEventListener("voiceschanged", load);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", load);
  }, []);

  const changePersona = useCallback((personaId: string) => {
    const found = VOICE_PERSONAS.find(p => p.id === personaId);
    if (!found) return;
    setSelectedPersonaId(personaId);
    selectedPersonaRef.current = personaId;
    if (typeof window !== "undefined") {
      localStorage.setItem("soulsync_voice_persona", personaId);
    }
  }, []);

  const changeCustomVoice = useCallback((uri: string) => {
    setSelectedVoiceURI(uri);
    selectedVoiceURIRef.current = uri;
    if (typeof window !== "undefined") {
      localStorage.setItem("soulsync_voice_uri", uri);
    }
  }, []);

  const previewVoice = useCallback((personaId?: string, customURI?: string) => {
    if (!hasSpeech) return;
    const targetPersonaId = personaId || selectedPersonaRef.current;
    const targetVoiceURI = customURI !== undefined ? customURI : selectedVoiceURIRef.current;
    const persona = VOICE_PERSONAS.find(p => p.id === targetPersonaId) || VOICE_PERSONAS[0];

    try {
      window.speechSynthesis.cancel();
    } catch (_) {}

    const sampleText = `Hey! Main ${persona.name} hoon. Kaisi lag rahi hai meri aawaaz?`;
    ttsSpeak(sampleText, () => {}, persona, targetVoiceURI);
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

    const currentPersona = VOICE_PERSONAS.find(p => p.id === selectedPersonaRef.current) || VOICE_PERSONAS[0];
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
    }, currentPersona, selectedVoiceURIRef.current);
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

    const currentPersona = VOICE_PERSONAS.find(p => p.id === selectedPersonaRef.current) || VOICE_PERSONAS[0];
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
    }, currentPersona, selectedVoiceURIRef.current);
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
    selectedPersonaId, selectedVoiceURI,
    changePersona, changeCustomVoice, previewVoice,
    availableVoices,
    startCall, stopCall, sendText, clearError,
    toggleMute, setLanguage, interruptAsha, commitCurrentSpeech,
    startPTT, stopPTT,
    hasSpeech, hasSR,
  };
}
