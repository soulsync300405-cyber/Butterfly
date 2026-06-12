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
export const hasSR = typeof window !== "undefined" && !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
const SRClass: any = typeof window !== "undefined" ? ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null) : null;

// Global audio reference to allow cancellation
let currentAudio: HTMLAudioElement | null = null;
let isAudioCancelled = false;

// ── Core TTS using Google Translate API (Guaranteed Hinglish Voice) ───────────
function ttsSpeak(text: string, onEnd: () => void): void {
  if (!text.trim()) {
    setTimeout(onEnd, 500);
    return;
  }

  isAudioCancelled = false;

  // Split into manageable chunks (Google TTS limit is ~200 chars)
  const chunks = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g)?.map(c => c.trim()).filter(Boolean) || [text];
  let currentChunkIdx = 0;

  const playNextChunk = () => {
    if (isAudioCancelled || currentChunkIdx >= chunks.length) {
      currentAudio = null;
      onEnd();
      return;
    }

    const chunk = chunks[currentChunkIdx];
    // tl=hi-IN forces the perfect Hindi/Hinglish accent universally
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=hi-IN&client=tw-ob&q=${encodeURIComponent(chunk)}`;
    
    const audio = new Audio(url);
    currentAudio = audio;
    
    audio.onended = () => {
      currentChunkIdx++;
      playNextChunk();
    };
    
    audio.onerror = (e) => {
      console.warn("[TTS] Audio failed to load chunk, skipping...", e);
      currentChunkIdx++;
      playNextChunk();
    };

    audio.play().catch(e => {
      console.warn("[TTS] Playback blocked by browser:", e);
      currentAudio = null;
      onEnd(); // End immediately if blocked
    });
  };

  playNextChunk();
}

export function cancelTTS() {
  isAudioCancelled = true;
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.src = "";
    currentAudio = null;
  }
}

export function useAIVoiceCall(companionName: string, _voiceStyle?: string) {
  const [callState, setCallState] = useState<AICallState>("idle");
  const [transcript, setTranscript] = useState("");
  const [ashaText, setAshaText]   = useState("");
  const [error, setError]         = useState<string | null>(null);

  const { user } = useStore();
  const userName = user?.name || "Student";

  const activeRef      = useRef(false);
  const speakingRef    = useRef(false);
  const historyRef     = useRef<{ role: string; content: string }[]>([]);
  const recRef         = useRef<any>(null);
  const restartRef     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const errorRef       = useRef<string | null>(null);
  const transcriptRef  = useRef("");

  // Self-ref avoids stale closure when startListening calls itself recursively
  const listenFnRef = useRef<() => void>(() => {});

  const setTx = (t: string) => { transcriptRef.current = t; setTranscript(t); };

  // Remove old window.speechSynthesis useEffect hooks
  useEffect(() => {}, []);

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

    const reply = await fetchGeminiDirect(msgs);
    return cleanForTTS(reply);
  }, []);

  // ── Kill recognition instance ───────────────────────────────────────────────
  const killRec = useCallback(() => {
    if (restartRef.current) { clearTimeout(restartRef.current); restartRef.current = null; }
    if (recRef.current) {
      try { recRef.current.onend = null; recRef.current.onerror = null; recRef.current.abort(); } catch (_) {}
      recRef.current = null;
    }
  }, []);

  // ── Process user speech → AI reply → speak ─────────────────────────────────
  // After Asha finishes, state goes to "listening" but mic stays OFF.
  // User must press PTT button to speak again.
  const processSpoken = useCallback(async (text: string) => {
    if (!activeRef.current) return;
    setCallState("thinking");
    setTx("");
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
        // PTT mode: just go back to "listening" — mic stays silent
        setCallState("listening");
      }
    });
  }, [getAIReply]);

  // ── Start listening — SIMPLE loop ───────────────────────────────────────────
  // Pattern: start recognition → wait for onend → if text: process it, else: restart
  const startListening = useCallback(() => {
    if (!activeRef.current || speakingRef.current) return;
    killRec();

    setCallState("listening");
    setTx("");
    errorRef.current = null;

    if (!hasSR) {
      // No SR support — text input is always visible, nothing more to do
      return;
    }

    const rec = new SRClass();
    recRef.current = rec;

    rec.lang = "en-IN";
    rec.interimResults = true;
    rec.continuous = false;      // Chrome stops naturally after a pause — reliable
    rec.maxAlternatives = 3;     // pick best of 3 alternatives

    let heard = "";              // accumulates final results

    rec.onresult = (e: any) => {
      let interimStr = "";
      // Walk all results from this event
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) {
          heard += r[0].transcript + " ";
        } else {
          interimStr += r[0].transcript;
        }
      }
      // Show live transcript
      setTx((heard + interimStr).trim());
    };

    rec.onerror = (e: any) => {
      const err = e.error as string;
      // These are not real errors — just restart
      if (err === "no-speech" || err === "aborted") {
        recRef.current = null;
        if (activeRef.current && !speakingRef.current) {
          restartRef.current = setTimeout(() => listenFnRef.current(), 300);
        }
        return;
      }
      // Real errors
      errorRef.current = err;
      recRef.current = null;
      if (err === "network") {
        setError("Internet needed for voice recognition. Type below:");
      } else if (err === "not-allowed") {
        setError("Microphone blocked. Allow mic in browser and reload.");
      } else {
        setError(`Mic error (${err}). Type your message below:`);
      }
    };

    // onend fires every time recognition stops — with or without speech
    rec.onend = () => {
      recRef.current = null;
      if (!activeRef.current || speakingRef.current) return;
      if (errorRef.current) return; // error already shown

      const spokenText = heard.trim();
      heard = "";

      if (spokenText.length > 1) {
        // Got speech — process it
        processSpoken(spokenText);
      } else {
        // Nothing heard — keep listening
        restartRef.current = setTimeout(() => listenFnRef.current(), 250);
      }
    };

    try {
      rec.start();
    } catch (startErr: any) {
      // "Already started" or other — short delay then retry
      console.warn("[SR start]", startErr?.message);
      recRef.current = null;
      restartRef.current = setTimeout(() => listenFnRef.current(), 500);
    }
  }, [killRec, processSpoken]);

  // Keep ref current (avoids stale closure in recursive restart)
  useEffect(() => { listenFnRef.current = startListening; }, [startListening]);

  // ── Push-to-talk: START (hold button) ──────────────────────────────────────
  const startPTT = useCallback(() => {
    if (!activeRef.current || speakingRef.current) return;
    killRec();
    setCallState("listening");
    setTx("");
    errorRef.current = null;
    if (!hasSR) return;

    const rec = new SRClass();
    recRef.current = rec;
    rec.lang = "en-IN";
    rec.interimResults = true;
    rec.continuous = true;   // stays open while button is held
    rec.maxAlternatives = 3;
    let heard = "";

    rec.onresult = (e: any) => {
      let interimStr = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) heard += r[0].transcript + " ";
        else interimStr += r[0].transcript;
      }
      setTx((heard + interimStr).trim());
      transcriptRef.current = (heard + interimStr).trim();
    };
    rec.onerror = (e: any) => {
      if (e.error === "not-allowed") {
        setError("Microphone blocked. Allow mic in browser settings.");
      }
    };
    rec.onend = () => {}; // handled by stopPTT

    try { rec.start(); } catch (_) {}
  }, [killRec]);

  // ── Push-to-talk: STOP (release button) ────────────────────────────────────
  const stopPTT = useCallback(() => {
    if (!recRef.current) return;
    const rec = recRef.current;

    rec.onend = () => {
      recRef.current = null;
      const text = transcriptRef.current.trim();
      setTx("");
      transcriptRef.current = "";
      if (text.length > 1 && activeRef.current) {
        processSpoken(text);
      } else {
        // Nothing heard — just go back to idle listening state, wait for next PTT
        if (activeRef.current) setCallState("listening");
      }
    };

    try { rec.stop(); } catch (_) { recRef.current = null; }
  }, [processSpoken]);

  // ── sendText typed input ─────────────────────────────────────────────────────
  const sendText = useCallback(async (text: string) => {
    if (!text.trim() || !activeRef.current) return;
    killRec();
    await processSpoken(text.trim());
  }, [killRec, processSpoken]);

  const clearError = useCallback(() => {
    setError(null);
    errorRef.current = null;
    // PTT mode: don't auto-start mic, just clear the error
  }, []);
  // ── startCall ───────────────────────────────────────────────────────────────
  const startCall = useCallback(() => {
    activeRef.current = true;
    speakingRef.current = true;
    errorRef.current = null;
    historyRef.current = [];
    setError(null);
    setTx("");
    setCallState("speaking");

    const greeting = `Hey ${userName}! Main ${companionName} hoon. Aaj kaisa feel ho raha hai? Button dabao aur bolo.`;
    setAshaText(greeting);
    historyRef.current.push({ role: "assistant", content: greeting });

    ttsSpeak(greeting, () => {
      speakingRef.current = false;
      if (activeRef.current) {
        // PTT mode: mic stays off, wait for user to press button
        setCallState("listening");
      }
    });
  }, [companionName, userName]);

  const stopCall = useCallback(() => {
    activeRef.current = false;
    speakingRef.current = false;
    errorRef.current = null;
    killRec();
    cancelTTS();
    setCallState("idle");
    setTx("");
    setAshaText("");
    setError(null);
  }, [killRec]);

  useEffect(() => () => {
    activeRef.current = false;
    killRec();
    cancelTTS();
  }, [killRec]);

  return {
    callState, transcript, ashaText, error,
    startCall, stopCall, sendText, clearError,
    startPTT, stopPTT,
    hasSpeech: true, hasSR,
  };
}
