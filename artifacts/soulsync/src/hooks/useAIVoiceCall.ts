import { useRef, useState, useCallback, useEffect } from "react";
import { useStore } from "@/lib/store";
import { fetchGeminiDirect, fetchGeminiAudioDirect, ASHA_SYSTEM, sanitizeMessagesForGemini } from "@/lib/gemini";

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

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const res = reader.result as string;
      const base64 = res.split(",")[1] || "";
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
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
  samplePhrase: string;
  searchFilter: (v: SpeechSynthesisVoice) => boolean;
}

export function isFemaleVoice(v: SpeechSynthesisVoice): boolean {
  const n = v.name.toLowerCase();
  return /female|woman|girl|hazel|susan|zira|eva|catherine|linda|jenny|aria|neerja|swara|aditi|kalpana|veena|heera|sangeeta|kavya|priya|ananya|shruti|salli|joanna|kendra|ivy|kimberly|emma|amy|olivia|victoria|serena|stephanie|sarah/i.test(n);
}

export function isMaleVoice(v: SpeechSynthesisVoice): boolean {
  const n = v.name.toLowerCase();
  return /male|man|boy|george|clayton|david|mark|ravi|prabhat|madhav|arjun|guy|christopher|eric|stefan|brian|russell|joey|justin|matthew|michael|paul|daniel|thomas|richard|james|steve|kevin|alexander|john|tom|bill/i.test(n);
}

export const VOICE_PERSONAS: VoicePersona[] = [
  {
    id: "asha-warm",
    name: "Asha",
    emoji: "🌸",
    gender: "female",
    accent: "Warm Indian Female",
    pitch: 1.06,
    rate: 0.92,
    description: "Empathetic, warm, older sister companion",
    samplePhrase: "Hey! Main Asha hoon. Main tumhari baat sunne ke liye hamesha yahan hoon.",
    searchFilter: (v) => /neerja|swara|heera|kalpana|veena|aditi|hazel/i.test(v.name) || (/hi-IN|en-IN/i.test(v.lang) && isFemaleVoice(v)),
  },
  {
    id: "ananya-calm",
    name: "Ananya",
    emoji: "🌿",
    gender: "female",
    accent: "Soft & Soothing",
    pitch: 0.92,
    rate: 0.80,
    description: "Very gentle, mindful, relaxed tone for anxiety relief",
    samplePhrase: "Namaste. Main Ananya hoon. Shant ho jao, hum milkar sambhal lenge.",
    searchFilter: (v) => /susan|aria|catherine|zira/i.test(v.name) || (/hi-IN|en-IN/i.test(v.lang) && /swara|neerja/i.test(v.name)),
  },
  {
    id: "riya-energetic",
    name: "Riya",
    emoji: "⚡",
    gender: "female",
    accent: "Cheerful Hinglish",
    pitch: 1.22,
    rate: 1.08,
    description: "Upbeat, lively, cheerful best-friend energy",
    samplePhrase: "Hey buddy! Main Riya hoon. Batao aaj kya scene hai, tension mat lo!",
    searchFilter: (v) => /heera|swara|aditi|hazel|jenny/i.test(v.name) || (/hi-IN|en-IN/i.test(v.lang) && isFemaleVoice(v)),
  },
  {
    id: "arjun-male",
    name: "Arjun",
    emoji: "👔",
    gender: "male",
    accent: "Calm Indian Male",
    pitch: 0.95,
    rate: 0.90,
    description: "Supportive, grounded brotherly companion",
    samplePhrase: "Hey dost, main Arjun hoon. Sab theek ho jayega, aaram se baat karte hain.",
    searchFilter: (v) => /clayton|ravi|madhav|arjun|guy|brian/i.test(v.name) || (/hi-IN|en-IN/i.test(v.lang) && isMaleVoice(v)),
  },
  {
    id: "kabir-deep",
    name: "Kabir",
    emoji: "🎙️",
    gender: "male",
    accent: "Deep Indian Male",
    pitch: 0.74,
    rate: 0.84,
    description: "Deep, reassuring, strong grounding voice",
    samplePhrase: "Hello. Main Kabir hoon. Take your time, main sun raha hoon.",
    searchFilter: (v) => /george|david|mark|prabhat|ravi|christopher/i.test(v.name) || (/hi-IN|en-IN/i.test(v.lang) && isMaleVoice(v)),
  },
  {
    id: "grace-global",
    name: "Grace",
    emoji: "🌐",
    gender: "female",
    accent: "Natural Global English",
    pitch: 1.08,
    rate: 0.98,
    description: "Polite, crystal-clear international accent",
    samplePhrase: "Hello! I am Grace, delighted to accompany you and listen today.",
    searchFilter: (v) => /susan|amy|olivia|victoria|emma/i.test(v.name) || ((v.lang === "en-GB" || v.lang === "en-US") && isFemaleVoice(v)),
  },
];

export function getMappedVoiceForPersona(
  persona: VoicePersona,
  voices: SpeechSynthesisVoice[]
): SpeechSynthesisVoice | null {
  if (!voices.length) return null;
  // 1. Direct persona filter match
  const match = voices.find(persona.searchFilter);
  if (match) return match;

  // 2. Gender matching with Indian / English priority
  if (persona.gender === "male") {
    const maleInd = voices.find(v => (/hi-IN|en-IN/i.test(v.lang) || /india/i.test(v.name)) && isMaleVoice(v));
    if (maleInd) return maleInd;
    const anyMale = voices.find(v => isMaleVoice(v));
    if (anyMale) return anyMale;
  } else {
    const femaleInd = voices.find(v => (/hi-IN|en-IN/i.test(v.lang) || /india/i.test(v.name)) && isFemaleVoice(v));
    if (femaleInd) return femaleInd;
    const anyFemale = voices.find(v => isFemaleVoice(v));
    if (anyFemale) return anyFemale;
  }

  return voices.find(v => v.default) || voices[0] || null;
}

function pickVoice(
  persona?: VoicePersona,
  customVoiceURI?: string,
  pitchMod = 1.0,
  rateMod = 1.0
): { voice: SpeechSynthesisVoice | null; pitch: number; rate: number } {
  const voices = getVoices();
  const activePersona = persona || VOICE_PERSONAS[0];
  const targetPitch = Math.max(0.5, Math.min(1.8, activePersona.pitch * pitchMod));
  const targetRate = Math.max(0.5, Math.min(1.8, activePersona.rate * rateMod));

  if (!voices.length) {
    return { voice: null, pitch: targetPitch, rate: targetRate };
  }

  // 1. Explicit user-selected device voice
  if (customVoiceURI) {
    const custom = voices.find(v => v.voiceURI === customVoiceURI || v.name === customVoiceURI);
    if (custom) return { voice: custom, pitch: targetPitch, rate: targetRate };
  }

  // 2. Persona matched voice
  const bestVoice = getMappedVoiceForPersona(activePersona, voices);
  return { voice: bestVoice, pitch: targetPitch, rate: targetRate };
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
  _useDefault = false,
  pitchMod = 1.0,
  rateMod = 1.0
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
    ? { voice: null, pitch: (persona ? persona.pitch : 1) * pitchMod, rate: (persona ? persona.rate : 0.9) * rateMod }
    : pickVoice(persona, customVoiceURI, pitchMod, rateMod);

  const utt = new SpeechSynthesisUtterance(text);

  if (picked.voice) {
    utt.voice = picked.voice;
    utt.lang  = picked.voice.lang;
  } else {
    utt.lang = "en-US";
  }

  utt.rate   = Math.max(0.5, Math.min(1.8, picked.rate));
  utt.pitch  = Math.max(0.5, Math.min(1.8, picked.pitch));
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
  defaultLang: "en-IN" | "hi-IN" = "hi-IN",
  companionGender?: "female" | "male" | "nonbinary" | string
) {
  const [callState, setCallState] = useState<AICallState>("idle");
  const [transcript, setTranscript] = useState("");
  const [ashaText, setAshaText]   = useState("");
  const [error, setError]         = useState<string | null>(null);
  const [isMuted, setIsMuted]     = useState(false);
  const [isUserSpeaking, setIsUserSpeaking] = useState(false);
  const [speechLang, setSpeechLang] = useState<"en-IN" | "hi-IN">(defaultLang);
  const [micVolume, setMicVolume] = useState(0);

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

  const activeRef               = useRef(false);
  const speakingRef             = useRef(false);
  const isMutedRef              = useRef(false);
  const isProcessingRef         = useRef(false);
  const speechLangRef           = useRef<"en-IN" | "hi-IN">(defaultLang);
  const historyRef              = useRef<{ role: string; content: string }[]>([]);
  const recRef                  = useRef<any>(null);
  const restartRef              = useRef<ReturnType<typeof setTimeout> | null>(null);
  const silenceTimerRef         = useRef<ReturnType<typeof setTimeout> | null>(null);
  const errorRef                = useRef<string | null>(null);
  const transcriptRef           = useRef("");
  const latestSpeechRef         = useRef("");
  const micStreamRef            = useRef<MediaStream | null>(null);
  const audioContextRef         = useRef<AudioContext | null>(null);
  const analyserRef             = useRef<AnalyserNode | null>(null);
  const analyserIntervalRef     = useRef<ReturnType<typeof setInterval> | null>(null);
  const mediaRecorderRef        = useRef<MediaRecorder | null>(null);
  const audioChunksRef          = useRef<Blob[]>([]);
  const hasUserSpokenAudioRef   = useRef(false);
  const isStartingRef           = useRef(false);

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

  const [pitchModifier, setPitchModifier] = useState<number>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("soulsync_voice_pitch");
      if (saved) return parseFloat(saved) || 1.0;
    }
    return 1.0;
  });

  const [rateModifier, setRateModifier] = useState<number>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("soulsync_voice_rate");
      if (saved) return parseFloat(saved) || 1.0;
    }
    return 1.0;
  });

  const pitchModifierRef = useRef(pitchModifier);
  const rateModifierRef  = useRef(rateModifier);

  useEffect(() => { pitchModifierRef.current = pitchModifier; }, [pitchModifier]);
  useEffect(() => { rateModifierRef.current = rateModifier; }, [rateModifier]);

  const changePitch = useCallback((val: number) => {
    setPitchModifier(val);
    pitchModifierRef.current = val;
    if (typeof window !== "undefined") {
      localStorage.setItem("soulsync_voice_pitch", String(val));
    }
  }, []);

  const changeRate = useCallback((val: number) => {
    setRateModifier(val);
    rateModifierRef.current = val;
    if (typeof window !== "undefined") {
      localStorage.setItem("soulsync_voice_rate", String(val));
    }
  }, []);

  const refreshVoices = useCallback(() => {
    if (!hasSpeech) return;
    const v = getVoices();
    if (v && v.length > 0) {
      setAvailableVoices(v);
    }
  }, []);

  const changePersona = useCallback((personaId: string) => {
    const found = VOICE_PERSONAS.find(p => p.id === personaId);
    if (!found) return;
    setSelectedPersonaId(personaId);
    selectedPersonaRef.current = personaId;
    setSelectedVoiceURI("");
    selectedVoiceURIRef.current = "";
    if (typeof window !== "undefined") {
      localStorage.setItem("soulsync_voice_persona", personaId);
      localStorage.removeItem("soulsync_voice_uri");
    }
  }, []);

  const changeCustomVoice = useCallback((uri: string) => {
    setSelectedVoiceURI(uri);
    selectedVoiceURIRef.current = uri;
    if (typeof window !== "undefined") {
      localStorage.setItem("soulsync_voice_uri", uri);
    }
  }, []);

  const previewVoice = useCallback((personaId?: string, customURI?: string, pitchMod?: number, rateMod?: number) => {
    if (!hasSpeech) return;
    const targetPersonaId = personaId || selectedPersonaRef.current;
    const targetVoiceURI = customURI !== undefined ? customURI : selectedVoiceURIRef.current;
    const persona = VOICE_PERSONAS.find(p => p.id === targetPersonaId) || VOICE_PERSONAS[0];
    const finalPitchMod = pitchMod !== undefined ? pitchMod : pitchModifierRef.current;
    const finalRateMod = rateMod !== undefined ? rateMod : rateModifierRef.current;

    try {
      window.speechSynthesis.cancel();
    } catch (_) {}

    const sampleText = persona.samplePhrase || `Hey! Main ${persona.name} hoon. Kaisi lag rahi hai meri aawaaz?`;
    ttsSpeak(sampleText, () => {}, persona, targetVoiceURI, false, finalPitchMod, finalRateMod);
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
  // ── Kill recognition instance ───────────────────────────────────────────────
  const killRec = useCallback(() => {
    if (restartRef.current) { clearTimeout(restartRef.current); restartRef.current = null; }
    if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null; }
    if (recRef.current) {
      try {
        recRef.current.onend = null;
        recRef.current.onerror = null;
        recRef.current.onresult = null;
        recRef.current.onspeechstart = null;
        recRef.current.abort();
      } catch (_) {}
      recRef.current = null;
    }
  }, []);

  // ── MediaRecorder Audio Fallback for Bulletproof Speech Recognition ──────────
  const startMediaRecording = useCallback(() => {
    if (!micStreamRef.current) return;
    try {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") return;
      audioChunksRef.current = [];

      const mime = typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported("audio/mp4")
        ? "audio/mp4"
        : "";

      const rec = mime ? new MediaRecorder(micStreamRef.current, { mimeType: mime }) : new MediaRecorder(micStreamRef.current);
      mediaRecorderRef.current = rec;

      rec.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };
      rec.start(150);
    } catch (err) {
      console.warn("[MediaRecorder start err]", err);
    }
  }, []);

  const stopMediaRecording = useCallback((): Promise<{ blob: Blob; mimeType: string } | null> => {
    return new Promise((resolve) => {
      const rec = mediaRecorderRef.current;
      if (!rec || rec.state === "inactive") {
        if (audioChunksRef.current.length > 0) {
          const mime = rec?.mimeType || "audio/webm";
          resolve({ blob: new Blob(audioChunksRef.current, { type: mime }), mimeType: mime });
        } else {
          resolve(null);
        }
        return;
      }

      rec.onstop = () => {
        const mime = rec.mimeType || "audio/webm";
        const blob = new Blob(audioChunksRef.current, { type: mime });
        audioChunksRef.current = [];
        resolve({ blob, mimeType: mime });
      };

      try {
        rec.stop();
      } catch {
        resolve(null);
      }
    });
  }, []);

  // ── Process spoken text via Gemini ──────────────────────────────────────────
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
      hasUserSpokenAudioRef.current = false;

      if (activeRef.current) {
        if (!isMutedRef.current) {
          setCallState("listening");
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

  // ── Direct Audio Fallback (Gemini Multimodal) ───────────────────────────────
  const processSpokenAudio = useCallback(async () => {
    if (!activeRef.current || isProcessingRef.current) return;
    isProcessingRef.current = true;
    killRec();

    setCallState("thinking");
    setIsUserSpeaking(false);

    const recorded = await stopMediaRecording();
    if (!recorded || recorded.blob.size < 1200) {
      // Audio was too short or empty
      isProcessingRef.current = false;
      hasUserSpokenAudioRef.current = false;
      if (activeRef.current && !isMutedRef.current) {
        setCallState("listening");
        setTimeout(() => {
          if (activeRef.current && !speakingRef.current && !isMutedRef.current) {
            listenFnRef.current();
          }
        }, 200);
      }
      return;
    }

    try {
      setTx("Hearing your voice...");
      const base64 = await blobToBase64(recorded.blob);

      const { userTranscript, reply } = await fetchGeminiAudioDirect(
        base64,
        recorded.mimeType,
        historyRef.current,
        companionName
      );

      if (!activeRef.current) {
        isProcessingRef.current = false;
        return;
      }

      const displayTranscript = userTranscript.trim() || "Spoke to companion";
      setTx(displayTranscript);
      historyRef.current.push({ role: "user", content: displayTranscript });

      const finalReply = reply.trim() || "Haan yaar, main sun rahi hoon. Batao?";
      historyRef.current.push({ role: "assistant", content: finalReply });

      speakingRef.current = true;
      setCallState("speaking");
      setAshaText(finalReply);

      const currentPersona = VOICE_PERSONAS.find(p => p.id === selectedPersonaRef.current) || VOICE_PERSONAS[0];
      ttsSpeak(finalReply, () => {
        speakingRef.current = false;
        isProcessingRef.current = false;
        latestSpeechRef.current = "";
        hasUserSpokenAudioRef.current = false;

        if (activeRef.current) {
          if (!isMutedRef.current) {
            setCallState("listening");
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
      }, currentPersona, selectedVoiceURIRef.current, false, pitchModifierRef.current, rateModifierRef.current);
    } catch (err) {
      console.warn("[Process audio error]", err);
      isProcessingRef.current = false;
      hasUserSpokenAudioRef.current = false;
      if (activeRef.current && !isMutedRef.current) {
        setCallState("listening");
        setTimeout(() => {
          if (activeRef.current && !speakingRef.current && !isMutedRef.current) {
            listenFnRef.current();
          }
        }, 200);
      }
    }
  }, [companionName, killRec, stopMediaRecording]);

  // ── Setup live Web Audio Analyser & VAD ──────────────────────────────────────
  const setupAudioAnalyser = useCallback((stream: MediaStream) => {
    try {
      if (analyserIntervalRef.current) clearInterval(analyserIntervalRef.current);
      if (audioContextRef.current) {
        try { audioContextRef.current.close(); } catch (_) {}
      }

      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      audioContextRef.current = ctx;

      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 128;
      analyser.smoothingTimeConstant = 0.3;
      source.connect(analyser);
      analyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      analyserIntervalRef.current = setInterval(() => {
        if (!activeRef.current || isMutedRef.current || speakingRef.current) {
          setMicVolume(0);
          return;
        }

        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        const vol = Math.min(100, Math.round((avg / 128) * 100));
        setMicVolume(vol);

        // VAD: User starts speaking
        if (vol > 8 && activeRef.current && !speakingRef.current && !isProcessingRef.current) {
          setIsUserSpeaking(true);
          hasUserSpokenAudioRef.current = true;
          startMediaRecording();

          if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = null;
          }
        } else if (hasUserSpokenAudioRef.current && vol <= 5 && activeRef.current && !speakingRef.current && !isProcessingRef.current) {
          // VAD: User was speaking, pause detected -> commit after 900ms
          if (!silenceTimerRef.current) {
            silenceTimerRef.current = setTimeout(() => {
              silenceTimerRef.current = null;
              if (activeRef.current && !speakingRef.current && !isProcessingRef.current && hasUserSpokenAudioRef.current) {
                const speech = latestSpeechRef.current.trim();
                if (speech.length > 1) {
                  processSpoken(speech);
                } else {
                  processSpokenAudio();
                }
              }
            }, 900);
          }
        }
      }, 50);
    } catch (e) {
      console.warn("[Analyser setup err]", e);
    }
  }, [startMediaRecording, processSpoken, processSpokenAudio]);

  // ── Start listening — Hands-Free Continuous Loop with Silence Detection ─────
  const startListening = useCallback(() => {
    if (!activeRef.current || speakingRef.current || isMutedRef.current || isProcessingRef.current) return;
    killRec();

    setCallState("listening");
    setIsUserSpeaking(false);
    errorRef.current = null;
    latestSpeechRef.current = "";
    hasUserSpokenAudioRef.current = false;

    // Start background audio buffer
    startMediaRecording();

    if (!hasSR) return;

    try {
      const rec = new SRClass();
      recRef.current = rec;

      rec.lang = speechLangRef.current;
      rec.continuous = true;
      rec.interimResults = true;
      rec.maxAlternatives = 2;

      let accumulatedFinal = "";

      rec.onspeechstart = () => {
        if (!activeRef.current || speakingRef.current || isProcessingRef.current) return;
        setIsUserSpeaking(true);
        hasUserSpokenAudioRef.current = true;
      };

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
          hasUserSpokenAudioRef.current = true;

          if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = setTimeout(() => {
            if (activeRef.current && !speakingRef.current && !isProcessingRef.current) {
              const speechToProcess = latestSpeechRef.current.trim();
              if (speechToProcess.length > 1) {
                processSpoken(speechToProcess);
              } else {
                processSpokenAudio();
              }
            }
          }, 900);
        }
      };

      rec.onerror = (e: any) => {
        const err = e.error as string;
        if (err === "no-speech" || err === "aborted") return;
        console.warn("[SpeechRecognition error]", err);
        if (err === "not-allowed") {
          setError("Microphone permission denied. Allow mic access in browser.");
        }
      };

      rec.onend = () => {
        recRef.current = null;
        if (!activeRef.current || speakingRef.current || isMutedRef.current || isProcessingRef.current) return;

        const speechToProcess = latestSpeechRef.current.trim();
        if (speechToProcess.length > 1) {
          processSpoken(speechToProcess);
        } else if (hasUserSpokenAudioRef.current) {
          processSpokenAudio();
        } else {
          restartRef.current = setTimeout(() => {
            if (activeRef.current && !speakingRef.current && !isMutedRef.current && !isProcessingRef.current) {
              listenFnRef.current();
            }
          }, 300);
        }
      };

      rec.start();
    } catch (startErr: any) {
      console.warn("[SR start]", startErr?.message);
      recRef.current = null;
      restartRef.current = setTimeout(() => listenFnRef.current(), 400);
    }
  }, [killRec, processSpoken, processSpokenAudio, startMediaRecording]);

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
    if (!activeRef.current || isProcessingRef.current) return;
    const text = transcriptRef.current.trim();
    if (text.length > 0) {
      processSpoken(text);
    } else if (hasUserSpokenAudioRef.current) {
      processSpokenAudio();
    }
  }, [processSpoken, processSpokenAudio]);

  // ── Mic Mute / Unmute ──────────────────────────────────────────────────────
  const toggleMute = useCallback(() => {
    setIsMuted(prev => {
      const next = !prev;
      isMutedRef.current = next;
      if (micStreamRef.current) {
        micStreamRef.current.getAudioTracks().forEach(t => { t.enabled = !next; });
      }
      if (next) {
        killRec();
        setIsUserSpeaking(false);
        setMicVolume(0);
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
  const startCall = useCallback(async () => {
    activeRef.current = true;
    speakingRef.current = true;
    isMutedRef.current = false;
    isProcessingRef.current = false;
    hasUserSpokenAudioRef.current = false;
    setIsMuted(false);
    setIsUserSpeaking(false);
    errorRef.current = null;
    historyRef.current = [];
    setError(null);
    setTx("");
    setMicVolume(0);
    setCallState("speaking");

    // Acquire mic stream for real-time live audio volume meter & fallback audio recorder
    try {
      if (typeof navigator !== "undefined" && navigator.mediaDevices?.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
        micStreamRef.current = stream;
        setupAudioAnalyser(stream);
      }
    } catch (e: any) {
      console.warn("[Mic stream access err]", e);
      if (e?.name === "NotAllowedError" || e?.name === "PermissionDeniedError") {
        setError("Microphone permission denied. Allow mic in browser settings.");
      }
    }

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
    }, currentPersona, selectedVoiceURIRef.current, false, pitchModifierRef.current, rateModifierRef.current);
  }, [companionName, userName, startListening, setupAudioAnalyser]);

  // ── stopCall ────────────────────────────────────────────────────────────────
  const stopCall = useCallback(() => {
    activeRef.current = false;
    speakingRef.current = false;
    isMutedRef.current = false;
    isProcessingRef.current = false;
    hasUserSpokenAudioRef.current = false;
    errorRef.current = null;
    if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null; }
    killRec();

    if (analyserIntervalRef.current) {
      clearInterval(analyserIntervalRef.current);
      analyserIntervalRef.current = null;
    }
    if (audioContextRef.current) {
      try { audioContextRef.current.close(); } catch (_) {}
      audioContextRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      try { mediaRecorderRef.current.stop(); } catch (_) {}
      mediaRecorderRef.current = null;
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(t => t.stop());
      micStreamRef.current = null;
    }

    if (hasSpeech) { try { window.speechSynthesis.cancel(); } catch (_) {} }
    setCallState("idle");
    setTx("");
    setAshaText("");
    setIsUserSpeaking(false);
    setMicVolume(0);
    setError(null);
  }, [killRec]);

  useEffect(() => () => {
    activeRef.current = false;
    killRec();
    if (analyserIntervalRef.current) clearInterval(analyserIntervalRef.current);
    if (audioContextRef.current) {
      try { audioContextRef.current.close(); } catch (_) {}
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(t => t.stop());
    }
    if (hasSpeech) { try { window.speechSynthesis.cancel(); } catch (_) {} }
  }, [killRec]);

  return {
    callState, transcript, ashaText, error,
    isMuted, isUserSpeaking, speechLang,
    micVolume,
    selectedPersonaId, selectedVoiceURI,
    pitchModifier, rateModifier,
    changePitch, changeRate, refreshVoices,
    changePersona, changeCustomVoice, previewVoice,
    availableVoices,
    startCall, stopCall, sendText, clearError,
    toggleMute, setLanguage, interruptAsha, commitCurrentSpeech,
    startPTT, stopPTT,
    hasSpeech, hasSR,
  };
}
