import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mic, MicOff, Video, VideoOff, PhoneOff, Volume2, VolumeX,
  Camera, Shield, Wifi, WifiOff, Eye, EyeOff, Sparkles, Radio,
  Check, ChevronDown, X, Settings2
} from "lucide-react";
import { AnimeAvatar } from "@/components/AnimeAvatar";
import type { Companion } from "@/lib/store";
import { useAIVoiceCall, VOICE_PERSONAS, type VoicePersona } from "@/hooks/useAIVoiceCall";
import { useWebRTC } from "@/hooks/useWebRTC";

interface CallUIProps {
  type: "ai-voice" | "ai-video" | "psychologist";
  companion?: Companion | null;
  psychName?: string;
  onEnd: () => void;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

async function requestStream(callType: "ai-voice" | "ai-video" | "psychologist"): Promise<MediaStream | null> {
  // In pure AI voice calls, no camera or WebRTC stream is needed (mic is handled directly by useAIVoiceCall)
  if (callType === "ai-voice") return null;

  // In AI video calls, only camera is needed for visual emotion analysis — do not capture audio to avoid mic contention
  if (callType === "ai-video") {
    try {
      return await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    } catch {
      return null;
    }
  }

  // Psychologist WebRTC call needs both video and audio
  try {
    return await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  } catch {
    try {
      return await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      return null;
    }
  }
}

function useLocalStream(callType: "ai-voice" | "ai-video" | "psychologist") {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [hasVideo, setHasVideo] = useState(false);
  const [hasAudio, setHasAudio] = useState(false);
  const [muted, setMuted] = useState(false);
  const [camOff, setCamOff] = useState(false);

  const start = useCallback(async () => {
    if (callType === "ai-voice") return null;
    const s = await requestStream(callType);
    if (s) {
      setStream(s);
      setHasVideo(s.getVideoTracks().length > 0);
      setHasAudio(s.getAudioTracks().length > 0);
    }
    return s;
  }, [callType]);

  const stop = useCallback(() => {
    stream?.getTracks().forEach(t => t.stop());
    setStream(null);
  }, [stream]);

  const toggleMute = useCallback(() => {
    stream?.getAudioTracks().forEach(t => { t.enabled = !t.enabled; });
    setMuted(m => !m);
  }, [stream]);

  const toggleCam = useCallback(() => {
    stream?.getVideoTracks().forEach(t => { t.enabled = !t.enabled; });
    setCamOff(c => !c);
  }, [stream]);

  return { stream, hasVideo, hasAudio, muted, camOff, start, stop, toggleMute, toggleCam };
}

// ── Camera frame capture hook (1 FPS for AI vision) ─────────────────────────
function useFrameCapture(stream: MediaStream | null, active: boolean) {
  const videoRef = useRef<HTMLVideoElement>(document.createElement("video"));
  const canvasRef = useRef<HTMLCanvasElement>(document.createElement("canvas"));
  const [lastFrame, setLastFrame] = useState<string | null>(null);

  useEffect(() => {
    if (!stream || !active) return;
    const video = videoRef.current;
    video.srcObject = stream;
    video.play().catch(() => {});

    const interval = setInterval(() => {
      const canvas = canvasRef.current;
      canvas.width = 320;
      canvas.height = 240;
      const ctx = canvas.getContext("2d");
      if (ctx && video.readyState >= 2) {
        ctx.drawImage(video, 0, 0, 320, 240);
        setLastFrame(canvas.toDataURL("image/jpeg", 0.7));
      }
    }, 1000);

    return () => {
      clearInterval(interval);
      video.srcObject = null;
    };
  }, [stream, active]);

  return lastFrame;
}

// ── Duration timer ───────────────────────────────────────────────────────────
function useDuration(running: boolean) {
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    if (!running) { setSecs(0); return; }
    const t = setInterval(() => setSecs(s => s + 1), 1000);
    return () => clearInterval(t);
  }, [running]);
  const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  return fmt(secs);
}

// ── Voice Selector Modal ─────────────────────────────────────────────────────
interface VoiceSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedPersonaId: string;
  selectedVoiceURI: string;
  onSelectPersona: (id: string) => void;
  onSelectVoiceURI: (uri: string) => void;
  onPreview: (id: string, uri?: string) => void;
  availableVoices: SpeechSynthesisVoice[];
}

function VoiceSelectorModal({
  isOpen,
  onClose,
  selectedPersonaId,
  selectedVoiceURI,
  onSelectPersona,
  onSelectVoiceURI,
  onPreview,
  availableVoices,
}: VoiceSelectorModalProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-3xl border border-white/15 overflow-hidden shadow-2xl flex flex-col max-h-[88vh]"
        style={{ background: "rgba(10, 18, 13, 0.96)", backdropFilter: "blur(20px)" }}
      >
        {/* Top header */}
        <div className="px-6 pt-5 pb-4 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center text-primary">
              <Volume2 size={18} />
            </div>
            <div>
              <h3 className="text-white font-bold text-base font-serif">Select AI Voice Persona</h3>
              <p className="text-white/40 text-xs">Choose the tone and accent for real-time conversation</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/15 flex items-center justify-center text-white/60 hover:text-white transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Personas grid */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {VOICE_PERSONAS.map((p) => {
              const isSelected = selectedPersonaId === p.id;
              return (
                <div
                  key={p.id}
                  onClick={() => onSelectPersona(p.id)}
                  className={`relative p-3.5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between gap-2.5 ${
                    isSelected
                      ? "border-primary bg-primary/15 shadow-lg shadow-primary/10 ring-1 ring-primary/40"
                      : "border-white/10 bg-white/4 hover:border-white/20 hover:bg-white/6"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <span className="text-2xl">{p.emoji}</span>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-white text-sm font-bold">{p.name}</span>
                          {isSelected && (
                            <span className="w-4 h-4 rounded-full bg-primary flex items-center justify-center text-white">
                              <Check size={10} strokeWidth={3} />
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-primary/90 font-medium">{p.accent}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onPreview(p.id);
                      }}
                      className="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 border border-white/15 text-[10px] font-semibold text-white flex items-center gap-1 transition-colors cursor-pointer"
                      title="Preview this voice"
                    >
                      <Volume2 size={11} /> Test
                    </button>
                  </div>
                  <p className="text-white/50 text-xs leading-relaxed">{p.description}</p>
                </div>
              );
            })}
          </div>

          {/* Advanced: Device System Voices */}
          <div className="pt-1">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center justify-between w-full px-3 py-2 rounded-xl text-xs text-white/50 hover:text-white/80 transition-colors bg-white/3 hover:bg-white/6 border border-white/6 cursor-pointer"
            >
              <span className="flex items-center gap-2 font-medium">
                <Settings2 size={13} className="text-primary/70" />
                Custom System Voices {availableVoices.length > 0 ? `(${availableVoices.length} detected)` : ""}
              </span>
              <ChevronDown
                size={14}
                className={`transition-transform duration-200 ${showAdvanced ? "rotate-180" : ""}`}
              />
            </button>

            {showAdvanced && (
              <div className="mt-2 p-3 rounded-2xl bg-white/4 border border-white/8 space-y-2">
                <p className="text-[11px] text-white/40">
                  Override with any specific voice installed on your system or browser:
                </p>
                <select
                  value={selectedVoiceURI}
                  onChange={(e) => onSelectVoiceURI(e.target.value)}
                  className="w-full bg-black/60 border border-white/15 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-primary"
                >
                  <option value="">✨ Auto-Match by Persona (Recommended)</option>
                  {availableVoices.map((v) => (
                    <option key={v.voiceURI || v.name} value={v.voiceURI || v.name}>
                      {v.name} ({v.lang}){v.localService ? " [Local]" : " [Online]"}
                    </option>
                  ))}
                </select>
                {selectedVoiceURI && (
                  <button
                    type="button"
                    onClick={() => onSelectVoiceURI("")}
                    className="text-[11px] text-primary hover:underline cursor-pointer"
                  >
                    Reset to Persona Recommended Voice
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/10 bg-black/30 flex items-center justify-between">
          <button
            type="button"
            onClick={() => onPreview(selectedPersonaId, selectedVoiceURI)}
            className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-xs text-white font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Volume2 size={13} /> Listen Sample
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-primary hover:bg-primary/90 text-xs font-bold text-white transition-opacity cursor-pointer shadow-md shadow-primary/20"
          >
            Apply & Done
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Main CallUI ──────────────────────────────────────────────────────────────
export function CallUI({ type, companion, psychName, onEnd }: CallUIProps) {
  const [phase, setPhase] = useState<"permission" | "starting" | "active">("permission");
  const [voiceTestResult, setVoiceTestResult] = useState<"untested" | "ok" | "fail">("untested");
  const [showVoiceModal, setShowVoiceModal] = useState(false);
  const local = useLocalStream(type);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const [speakerMuted, setSpeakerMuted] = useState(false);
  const [typeInput, setTypeInput] = useState("");
  const synthUnlockedRef = useRef(false);

  const roomId = `psych-${(psychName || "asha").toLowerCase().replace(/\s+/g, "-")}-room`;
  const webrtc = useWebRTC(roomId, type === "psychologist" ? local.stream : null);

  const aiCall = useAIVoiceCall(
    companion?.name || "Asha",
    companion?.voiceStyle,
    "hi-IN",
    companion?.gender
  );

  const currentPersona = VOICE_PERSONAS.find(p => p.id === aiCall.selectedPersonaId) || VOICE_PERSONAS[0];

  const duration = useDuration(phase === "active");
  const _frame = useFrameCapture(local.stream, phase === "active" && type === "ai-video");

  // Wire local stream → local video element
  useEffect(() => {
    if (localVideoRef.current && local.stream) {
      localVideoRef.current.srcObject = local.stream;
    }
  }, [local.stream]);

  // Wire remote stream → remote video element
  useEffect(() => {
    if (remoteVideoRef.current && webrtc.remoteStream) {
      remoteVideoRef.current.srcObject = webrtc.remoteStream;
    }
  }, [webrtc.remoteStream]);

  // ── Prepare speech synthesis on button click (synchronous, in gesture context)
  const unlockSynth = () => {
    if (synthUnlockedRef.current || typeof window === "undefined" || !("speechSynthesis" in window)) return;
    synthUnlockedRef.current = true;
    // Just clear any stale state — Edge/Chrome don't need a dummy utterance
    // if synthesis was never started (avoids creating a pending utterance that
    // interferes with the greeting speak() call).
    try { window.speechSynthesis.cancel(); } catch (_) {}
  };

  // ── Test voice button handler (synchronous — user gesture context preserved)
  const handleTestVoice = () => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      setVoiceTestResult("fail");
      return;
    }
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance("Hello, voice is working!");
    utt.volume = 1;
    utt.rate = 0.9;
    utt.onend = () => setVoiceTestResult("ok");
    utt.onerror = () => setVoiceTestResult("fail");
    window.speechSynthesis.speak(utt);
    synthUnlockedRef.current = true;
  };

  const handleStart = useCallback(async () => {
    // CRITICAL: Unlock TTS synchronously HERE — before any await.
    // Chrome blocks speechSynthesis.speak() if the first call isn't
    // in the direct synchronous user-gesture handler.
    unlockSynth();

    setPhase("starting");
    // Small pause so the unlock utterance registers before we proceed
    await new Promise(r => setTimeout(r, 150));
    await local.start();

    if (type === "psychologist") {
      webrtc.connect();
    } else {
      aiCall.startCall();
    }

    setTimeout(() => setPhase("active"), 600);
  }, [local, type, webrtc, aiCall]);

  const handleEnd = useCallback(() => {
    local.stop();
    aiCall.stopCall();
    if (type === "psychologist") webrtc.disconnect();
    onEnd();
  }, [local, aiCall, type, webrtc, onEnd]);

  const handleTypeSend = useCallback(() => {
    const text = typeInput.trim();
    if (!text) return;
    setTypeInput("");
    aiCall.sendText(text);
  }, [typeInput, aiCall]);

  const bars = Array.from({ length: 24 });
  const aiSpeaking = (type === "ai-voice" || type === "ai-video") && aiCall.callState === "speaking";
  const aiListening = (type === "ai-voice" || type === "ai-video") && aiCall.callState === "listening";
  const isAIBusy = aiCall.callState === "thinking" || aiCall.callState === "speaking";

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "radial-gradient(ellipse 120% 100% at 50% 0%, #0d1f15 0%, #070a08 100%)" }}>

      {/* Subtle grid texture */}
      <div className="absolute inset-0 opacity-[0.03]"
        style={{ backgroundImage: "linear-gradient(rgba(255,255,255,.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.3) 1px, transparent 1px)", backgroundSize: "40px 40px" }} />

      {/* Ambient glow */}
      <motion.div animate={{ opacity: [0.15, 0.25, 0.15] }} transition={{ duration: 4, repeat: Infinity }}
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] rounded-full blur-3xl"
        style={{ background: "radial-gradient(ellipse, #3A7A52 0%, transparent 70%)" }} />

      <AnimatePresence mode="wait">

        {/* ══ PERMISSION SCREEN ══════════════════════════════════════════════ */}
        {phase === "permission" && (
          <motion.div key="perm"
            initial={{ opacity: 0, scale: 0.92, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            transition={{ type: "spring", stiffness: 280, damping: 26 }}
            className="relative w-full max-w-sm mx-4 space-y-5">

            {/* Glass card */}
            <div className="rounded-3xl border border-white/10 overflow-hidden shadow-2xl"
              style={{ background: "rgba(10,16,11,0.85)", backdropFilter: "blur(24px)" }}>

              {/* Top gradient strip */}
              <div className="h-1 bg-gradient-to-r from-primary via-emerald-400 to-teal-500" />

              <div className="p-7 space-y-6">
                {/* Icon + title */}
                <div className="text-center space-y-3">
                  <motion.div animate={{ rotate: [0, 5, -5, 0] }} transition={{ duration: 4, repeat: Infinity }}
                    className="w-14 h-14 rounded-2xl mx-auto flex items-center justify-center border border-primary/30"
                    style={{ background: "rgba(58,122,82,0.15)" }}>
                    <Shield size={26} className="text-primary" />
                  </motion.div>
                  <div>
                    <h2 className="text-xl font-black text-white font-serif">
                      {(type === "ai-voice" || type === "ai-video") ? `Connect with ${companion?.name || "Asha"}` : `Call Dr. ${psychName}`}
                    </h2>
                    <p className="text-white/50 text-sm mt-1">
                      {(type === "ai-voice" || type === "ai-video")
                        ? (type === "ai-video" ? "Your AI companion needs your camera and mic to see and hear you" : "Your AI companion needs your mic to hear you")
                        : "Allow access so your psychologist can see and hear you clearly"}
                    </p>
                  </div>
                </div>

                {/* Permission items */}
                <div className="space-y-2.5">
                  {[
                    { icon: Mic, label: "Microphone", sub: "Real-time voice conversation", show: true },
                    { icon: Camera, label: "Camera", sub: (type === "ai-video" || type === "ai-voice") ? "Visual context for your AI companion" : "Face-to-face session", show: type !== "ai-voice" },
                  ].filter(item => item.show).map(item => (
                    <div key={item.label}
                      className="flex items-center gap-4 rounded-2xl border border-white/8 px-4 py-3.5"
                      style={{ background: "rgba(255,255,255,0.04)" }}>
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center border border-primary/20"
                        style={{ background: "rgba(58,122,82,0.12)" }}>
                        <item.icon size={17} className="text-primary" />
                      </div>
                      <div className="flex-1">
                        <p className="text-white text-sm font-semibold">{item.label}</p>
                        <p className="text-white/40 text-xs">{item.sub}</p>
                      </div>
                      <motion.div animate={{ scale: [1, 1.1, 1] }} transition={{ duration: 2, repeat: Infinity }}
                        className="w-2 h-2 rounded-full bg-primary" />
                    </div>
                  ))}
                </div>

                {/* Voice Persona Card on Permission Screen */}
                {(type === "ai-voice" || type === "ai-video") && (
                  <div
                    className="rounded-2xl border border-white/10 p-3 flex items-center justify-between gap-2"
                    style={{ background: "rgba(255,255,255,0.04)" }}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-primary/15 border border-primary/25 flex items-center justify-center text-lg shrink-0">
                        {currentPersona.emoji}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-white text-xs font-bold truncate">{currentPersona.name}</span>
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/30 font-medium whitespace-nowrap">
                            {currentPersona.accent}
                          </span>
                        </div>
                        <p className="text-white/40 text-[11px] truncate">{currentPersona.description}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => aiCall.previewVoice(currentPersona.id, aiCall.selectedVoiceURI)}
                        className="px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-[11px] font-semibold text-white/90 flex items-center gap-1 transition-colors cursor-pointer"
                        title="Preview voice"
                      >
                        <Volume2 size={12} /> Test
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowVoiceModal(true)}
                        className="px-2.5 py-1.5 rounded-xl bg-primary/20 hover:bg-primary/30 border border-primary/30 text-[11px] font-bold text-primary transition-colors cursor-pointer"
                      >
                        Change
                      </button>
                    </div>
                  </div>
                )}

                {/* Privacy note */}
                <p className="text-center text-[11px] text-white/30 flex items-center justify-center gap-1.5">
                  <Shield size={10} className="text-primary/60" />
                  End-to-end encrypted · Never stored without consent
                </p>

                {/* Buttons */}
                <div className="flex gap-3">
                  <button onClick={onEnd}
                    className="flex-1 py-3.5 rounded-2xl border border-white/10 text-white/60 text-sm font-medium hover:border-white/20 hover:text-white/80 transition-all">
                    Cancel
                  </button>
                  <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                    onClick={handleStart}
                    className="flex-1 py-3.5 rounded-2xl text-sm font-bold text-white relative overflow-hidden"
                    style={{ background: "linear-gradient(135deg, #3A7A52 0%, #2d6142 100%)" }}>
                    <motion.div className="absolute inset-0"
                      animate={{ x: ["-100%", "200%"] }}
                      transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                      style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent)", transform: "skewX(-20deg)" }} />
                    {(type === "ai-voice" || type === "ai-video") ? "Start AI Session" : "Join Call"}
                  </motion.button>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* ══ STARTING ═══════════════════════════════════════════════════════ */}
        {phase === "starting" && (
          <motion.div key="starting" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="flex flex-col items-center gap-4">
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              className="w-12 h-12 rounded-full border-2 border-primary/30 border-t-primary" />
            <p className="text-white/60 text-sm">
              {(type === "ai-voice" || type === "ai-video") ? "Connecting to Asha..." : "Joining room..."}
            </p>
          </motion.div>
        )}

        {/* ══ ACTIVE CALL ════════════════════════════════════════════════════ */}
        {phase === "active" && (
          <motion.div key="active" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="w-full h-full flex flex-col">

            {/* ── AI CALL LAYOUT ── */}
            {(type === "ai-voice" || type === "ai-video") && (
              <div className="flex-1 flex flex-col items-center justify-between py-10 px-6 relative">

                {/* Top bar */}
                <div className="w-full flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <motion.div animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.5, repeat: Infinity }}
                      className="w-2 h-2 rounded-full bg-primary" />
                    <span className="text-white/50 text-xs uppercase tracking-widest">AI Session</span>
                  </div>
                  <div className="flex items-center gap-3">
                    {/* Call state badge */}
                    <AnimatePresence mode="wait">
                      {aiCall.isMuted ? (
                        <motion.div key="muted"
                          initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.85 }}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-red-500/30 bg-red-500/15">
                          <MicOff size={12} className="text-red-400" />
                          <span className="text-xs text-red-300 font-semibold">Mic Muted</span>
                        </motion.div>
                      ) : aiCall.isUserSpeaking ? (
                        <motion.div key="user-speaking"
                          initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.85 }}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-blue-500/30 bg-blue-500/15">
                          <motion.div animate={{ scale: [1, 1.5, 1] }} transition={{ duration: 0.6, repeat: Infinity }}
                            className="w-2 h-2 rounded-full bg-blue-400" />
                          <span className="text-xs text-blue-300 font-semibold">Hearing you...</span>
                        </motion.div>
                      ) : aiCall.callState === "listening" ? (
                        <motion.div key="listening"
                          initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.85 }}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-primary/30"
                          style={{ background: "rgba(58,122,82,0.15)" }}>
                          <motion.div animate={{ scale: [1, 1.4, 1] }} transition={{ duration: 0.8, repeat: Infinity }}
                            className="w-1.5 h-1.5 rounded-full bg-primary" />
                          <span className="text-xs text-primary font-semibold">Listening (Speak now)</span>
                        </motion.div>
                      ) : aiCall.callState === "thinking" ? (
                        <motion.div key="thinking"
                          initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.85 }}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-amber-500/30"
                          style={{ background: "rgba(245,158,11,0.12)" }}>
                          <motion.span animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 0.6, repeat: Infinity }}
                            className="text-xs text-amber-400 font-semibold">Asha is thinking...</motion.span>
                        </motion.div>
                      ) : aiCall.callState === "speaking" ? (
                        <motion.div key="speaking"
                          initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.85 }}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-emerald-500/30"
                          style={{ background: "rgba(16,185,129,0.1)" }}>
                          <Sparkles size={11} className="text-emerald-400" />
                          <span className="text-xs text-emerald-400 font-semibold">Speaking</span>
                        </motion.div>
                      ) : null}
                    </AnimatePresence>
                    <span className="text-white/30 text-sm font-mono">{duration}</span>
                  </div>
                </div>

                {/* Avatar + waveform */}
                <div className="flex flex-col items-center gap-6">
                  {/* Outer pulsing ring */}
                  <div
                    onClick={aiSpeaking ? aiCall.interruptAsha : undefined}
                    className={`relative ${aiSpeaking ? "cursor-pointer" : ""}`}
                    title={aiSpeaking ? "Click to interrupt Asha and speak" : ""}
                  >
                    {aiSpeaking && (
                      <>
                        <motion.div animate={{ scale: [1, 1.25, 1], opacity: [0.2, 0, 0.2] }}
                          transition={{ duration: 1.8, repeat: Infinity }}
                          className="absolute inset-0 rounded-full border-2 border-primary" style={{ margin: -24 }} />
                        <motion.div animate={{ scale: [1, 1.45, 1], opacity: [0.12, 0, 0.12] }}
                          transition={{ duration: 1.8, repeat: Infinity, delay: 0.3 }}
                          className="absolute inset-0 rounded-full border border-primary" style={{ margin: -40 }} />
                      </>
                    )}
                    {aiCall.isUserSpeaking && (
                      <motion.div animate={{ scale: [1, 1.2, 1], opacity: [0.35, 0, 0.35] }}
                        transition={{ duration: 1, repeat: Infinity }}
                        className="absolute inset-0 rounded-full border-2 border-blue-400" style={{ margin: -18 }} />
                    )}
                    <AnimeAvatar speaking={aiSpeaking} size={180}
                      style={companion?.appearance as any || "soft-pastel"}
                      gender={companion?.gender || "female"}
                      name={companion?.name || "Asha"}
                    />
                  </div>

                  {/* Name */}
                  <div className="text-center">
                    <h2 className="text-white text-2xl font-black font-serif">{companion?.name || "Asha"}</h2>
                    <p className="text-white/40 text-sm">Your AI Wellness Companion</p>
                  </div>

                  {/* Interrupt prompt when Asha is talking */}
                  {aiSpeaking && (
                    <motion.button
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      onClick={aiCall.interruptAsha}
                      className="px-3 py-1 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 text-white/80 hover:text-white text-xs font-medium cursor-pointer transition-colors"
                    >
                      ✋ Tap to interrupt Asha
                    </motion.button>
                  )}

                  {/* Waveform */}
                  <div className="flex items-center gap-[3px]" style={{ height: 40 }}>
                    {bars.map((_, i) => (
                      <motion.div key={i} className="rounded-full"
                        style={{
                          width: 3,
                          background: aiSpeaking
                            ? `linear-gradient(to top, #3A7A52, ${i % 2 === 0 ? "#4CAF75" : "#34D399"})`
                            : aiCall.isUserSpeaking || aiCall.micVolume > 8
                              ? `linear-gradient(to top, #2563EB, #60A5FA)`
                              : aiListening && !aiCall.isMuted
                                ? `linear-gradient(to top, rgba(58,122,82,0.4), rgba(58,122,82,0.6))`
                                : "rgba(255,255,255,0.1)"
                        }}
                        animate={aiSpeaking
                          ? { height: [4, Math.random() * 28 + 8, 4] }
                          : aiCall.isUserSpeaking || aiCall.micVolume > 8
                            ? { height: [4, Math.min(36, Math.max(8, (aiCall.micVolume / 100) * 36 + (i % 4) * 3)), 4] }
                            : aiListening && !aiCall.isMuted
                              ? { height: [3, Math.max(3, (aiCall.micVolume / 100) * 16 + 3), 3] }
                              : { height: 4 }}
                        transition={{ duration: 0.15 + (i % 4) * 0.04, repeat: Infinity, delay: i * 0.02 }}
                      />
                    ))}
                  </div>

                  {/* Real-time mic volume level badge */}
                  {aiListening && !aiCall.isMuted && (
                    <motion.div
                      initial={{ opacity: 0, y: -2 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-center gap-2 px-3.5 py-1.5 rounded-full border transition-all"
                      style={{
                        background: aiCall.micVolume > 8 ? "rgba(16, 185, 129, 0.15)" : "rgba(255, 255, 255, 0.05)",
                        borderColor: aiCall.micVolume > 8 ? "rgba(16, 185, 129, 0.4)" : "rgba(255, 255, 255, 0.1)"
                      }}
                    >
                      <span className={`text-[11px] font-medium flex items-center gap-1.5 ${aiCall.micVolume > 8 ? "text-emerald-400 font-bold" : "text-white/50"}`}>
                        <span className={`w-2 h-2 rounded-full ${aiCall.micVolume > 8 ? "bg-emerald-400 animate-pulse" : "bg-white/20"}`} />
                        {aiCall.micVolume > 8 ? "Hearing your voice..." : "Mic active — speak now"}
                      </span>
                      {/* Audio Level Dots */}
                      <div className="flex items-center gap-1 pl-1">
                        {[10, 25, 45, 65, 85].map((lvl, idx) => (
                          <div
                            key={idx}
                            className={`w-1.5 h-1.5 rounded-full transition-all duration-75 ${
                              aiCall.micVolume >= lvl
                                ? "bg-emerald-400 scale-125 shadow-sm shadow-emerald-400/60"
                                : "bg-white/20 scale-100"
                            }`}
                          />
                        ))}
                      </div>
                      {(aiCall.isUserSpeaking || aiCall.micVolume > 8) && (
                        <button
                          onClick={aiCall.commitCurrentSpeech}
                          className="ml-1 px-2.5 py-0.5 rounded-md bg-primary hover:bg-primary/90 text-white font-bold text-[10px] cursor-pointer shadow transition-transform active:scale-95"
                          title="Finish speaking & send now"
                        >
                          Done ➔
                        </button>
                      )}
                    </motion.div>
                  )}
                </div>

                {/* Transcript + response bubbles */}
                <div className="w-full max-w-sm space-y-2">
                  <AnimatePresence>
                    {aiCall.transcript && (
                      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                        className="flex flex-col items-end gap-1">
                        <div className="max-w-[85%] px-4 py-2.5 rounded-2xl rounded-br-sm text-sm text-white flex items-center justify-between gap-3 shadow-lg"
                          style={{ background: "rgba(37, 99, 235, 0.25)", border: "1px solid rgba(96, 165, 250, 0.3)", backdropFilter: "blur(8px)" }}>
                          <span className="flex-1">{aiCall.transcript}</span>
                          {aiCall.callState === "listening" && (
                            <button
                              onClick={aiCall.commitCurrentSpeech}
                              title="Send now without waiting for pause"
                              className="px-2 py-1 rounded-md bg-primary hover:bg-primary/80 text-[10px] font-bold text-white cursor-pointer transition-colors"
                            >
                              Send ➔
                            </button>
                          )}
                        </div>
                        <span className="text-[10px] text-white/40 pr-2">Hearing you in real time...</span>
                      </motion.div>
                    )}
                    {aiCall.ashaText && (
                      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                        <div className="max-w-[85%] px-4 py-2.5 rounded-2xl rounded-bl-sm text-sm text-white/90 border border-primary/20 shadow-lg"
                          style={{ background: "rgba(58,122,82,0.25)", backdropFilter: "blur(8px)" }}>
                          {aiCall.ashaText}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Vision indicator */}
                  {local.hasVideo && (
                    <div className="flex items-center gap-1.5 justify-center mt-1">
                      <Eye size={11} className="text-primary/60" />
                      <span className="text-[10px] text-white/30">Asha can see your environment</span>
                    </div>
                  )}

                  {/* Error badge */}
                  {aiCall.error && (
                    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                      className="flex items-center justify-between px-3 py-2 rounded-xl border border-amber-500/30"
                      style={{ background: "rgba(245,158,11,0.08)" }}>
                      <span className="text-[10px] text-amber-400 font-semibold">
                        ⚠️ {aiCall.error}
                      </span>
                      <button
                        onClick={aiCall.clearError}
                        className="text-[10px] text-primary font-bold hover:underline bg-transparent border-none cursor-pointer"
                      >
                        Retry mic
                      </button>
                    </motion.div>
                  )}

                  {/* Always-visible text input — type any time */}
                  <div className="flex gap-2 bg-white/5 border border-white/10 rounded-2xl px-3 py-2 mt-1">
                    <input
                      type="text"
                      value={typeInput}
                      onChange={(e) => setTypeInput(e.target.value)}
                      placeholder={isAIBusy ? "Asha is speaking..." : "Type if in a quiet place..."}
                      disabled={isAIBusy}
                      className="flex-1 bg-transparent border-none text-white text-xs outline-none placeholder:text-white/25 disabled:opacity-40"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleTypeSend();
                      }}
                    />
                    <button
                      onClick={handleTypeSend}
                      disabled={isAIBusy || !typeInput.trim()}
                      className="text-[10px] text-primary font-bold disabled:opacity-30 bg-transparent border-none cursor-pointer hover:text-primary/80 transition-colors"
                    >
                      Send
                    </button>
                  </div>
                </div>

                {/* Controls */}
                <div className="flex flex-col items-center gap-3">
                  {/* Speech Language & Voice Switcher Pills */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => aiCall.setLanguage(aiCall.speechLang === "hi-IN" ? "en-IN" : "hi-IN")}
                      className="px-3 py-1 rounded-full bg-white/10 hover:bg-white/15 border border-white/15 text-xs text-white/80 font-medium transition-colors cursor-pointer flex items-center gap-1.5"
                      title="Toggle speech recognition between Hinglish/Hindi and English"
                    >
                      <span>🗣️</span>
                      <span>Lang: <strong>{aiCall.speechLang === "hi-IN" ? "🇮🇳 Hinglish / Hindi" : "🌐 English"}</strong></span>
                    </button>

                    <button
                      onClick={() => setShowVoiceModal(true)}
                      className="px-3 py-1 rounded-full bg-white/10 hover:bg-white/15 border border-white/15 text-xs text-white/80 font-medium transition-colors cursor-pointer flex items-center gap-1.5"
                      title="Change AI voice persona"
                    >
                      <span>{currentPersona.emoji}</span>
                      <span>Voice: <strong>{currentPersona.name}</strong></span>
                      <ChevronDown size={11} className="text-white/40" />
                    </button>
                  </div>

                  {/* Primary Controls */}
                  <div className="flex items-center gap-4">
                    {/* Mic Mute / Unmute Button */}
                    <CtrlBtn
                      icon={aiCall.isMuted ? MicOff : Mic}
                      active={!aiCall.isMuted}
                      onClick={aiCall.toggleMute}
                      label={aiCall.isMuted ? "Unmute" : aiCall.isUserSpeaking ? "Hearing..." : "Mic On"}
                    />

                    {/* Speaker Mute / Unmute */}
                    <CtrlBtn
                      icon={speakerMuted ? VolumeX : Volume2}
                      active={!speakerMuted}
                      onClick={() => setSpeakerMuted(m => !m)}
                      label="Speaker"
                    />

                    {/* End Call */}
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.93 }}
                      onClick={handleEnd}
                      className="w-16 h-16 rounded-full flex items-center justify-center shadow-2xl shadow-red-900/40 cursor-pointer"
                      style={{ background: "linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)" }}
                      title="End Call"
                    >
                      <PhoneOff size={22} className="text-white" />
                    </motion.button>

                    {/* Camera for video */}
                    {type !== "ai-voice" && (
                      <CtrlBtn
                        icon={local.camOff ? EyeOff : Camera}
                        active={!local.camOff}
                        onClick={local.toggleCam}
                        label="Camera"
                      />
                    )}
                  </div>

                  {/* Real-time speech advisory hint */}
                  <p className="text-[11px] text-white/40 text-center font-medium max-w-xs">
                    {aiCall.isMuted
                      ? "Mic muted — click Unmute when ready to talk"
                      : aiCall.isUserSpeaking
                        ? "🎙️ Hearing you live... pause to let Asha reply"
                        : "🎙️ Hands-free mode: speak naturally, Asha will reply out loud"}
                  </p>
                </div>


                {/* Local PiP */}
                {local.hasVideo && !local.camOff && (
                  <motion.div initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }}
                    className="absolute top-16 right-5 w-24 h-32 rounded-2xl overflow-hidden border border-white/15 shadow-xl">
                    <video ref={localVideoRef} autoPlay muted playsInline
                      className="w-full h-full object-cover" style={{ transform: "scaleX(-1)" }} />
                    <div className="absolute bottom-1.5 left-1.5 text-[9px] text-white/60 bg-black/40 px-1.5 py-0.5 rounded-full">You</div>
                  </motion.div>
                )}
              </div>
            )}

            {/* ── HUMAN / PSYCHOLOGIST CALL LAYOUT ── */}
            {type === "psychologist" && (
              <div className="flex-1 relative flex flex-col">

                {/* Remote video (full) */}
                <div className="flex-1 relative bg-black flex items-center justify-center overflow-hidden">
                  {webrtc.remoteStream ? (
                    <video ref={remoteVideoRef} autoPlay playsInline
                      className="w-full h-full object-cover" />
                  ) : (
                    <div className="flex flex-col items-center gap-4">
                      <motion.div
                        animate={webrtc.status === "connecting"
                          ? { boxShadow: ["0 0 0 0 rgba(58,122,82,0.3)", "0 0 0 24px rgba(58,122,82,0)", "0 0 0 0 rgba(58,122,82,0)"] }
                          : {}}
                        transition={{ duration: 1.8, repeat: Infinity }}
                        className="w-36 h-36 rounded-full border-2 border-white/15 flex items-center justify-center"
                        style={{ background: "rgba(58,122,82,0.1)" }}>
                        <span className="text-4xl font-black text-white/70">
                          {psychName?.slice(0, 2).toUpperCase() || "DR"}
                        </span>
                      </motion.div>
                      <div className="text-center space-y-1">
                        <p className="text-white font-bold font-serif text-lg">Dr. {psychName}</p>
                        <div className="flex items-center justify-center gap-2">
                          {webrtc.status === "connecting" && (
                            <>
                              <motion.div animate={{ opacity: [1, 0.2, 1] }} transition={{ duration: 1.2, repeat: Infinity }}
                                className="flex gap-1">
                                {[0, 1, 2].map(i => (
                                  <motion.div key={i} animate={{ scale: [1, 1.3, 1] }}
                                    transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
                                    className="w-1.5 h-1.5 rounded-full bg-primary" />
                                ))}
                              </motion.div>
                              <span className="text-white/50 text-sm">Waiting for Dr. {psychName}...</span>
                            </>
                          )}
                          {webrtc.status === "error" && (
                            <div className="flex items-center gap-2 text-red-400 text-sm">
                              <WifiOff size={14} />
                              <span>Connection failed — check your network</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Top HUD */}
                  <div className="absolute top-0 inset-x-0 flex items-center justify-between px-5 pt-5 pb-8"
                    style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.6), transparent)" }}>
                    <div className="flex items-center gap-2">
                      <motion.div animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.5, repeat: Infinity }}
                        className={`w-2 h-2 rounded-full ${webrtc.status === "connected" ? "bg-primary" : "bg-amber-400"}`} />
                      <span className="text-white/60 text-xs uppercase tracking-widest">
                        {webrtc.status === "connected" ? "Psychologist Session" : webrtc.status === "connecting" ? "Connecting..." : "Session"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {webrtc.status === "connected"
                        ? <Wifi size={13} className="text-primary" />
                        : <motion.div animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 0.8, repeat: Infinity }}>
                            <Wifi size={13} className="text-amber-400" />
                          </motion.div>}
                      <span className="text-white/50 text-sm font-mono">{duration}</span>
                    </div>
                  </div>
                </div>

                {/* Bottom controls + PiP */}
                <div className="relative px-6 pb-8 pt-6 flex flex-col gap-4"
                  style={{ background: "linear-gradient(to top, rgba(0,0,0,0.85), transparent)" }}>

                  {/* PiP self-view */}
                  <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
                    className="absolute right-5 -top-36 w-28 h-40 rounded-2xl overflow-hidden border-2 border-white/15 shadow-2xl">
                    {local.hasVideo && !local.camOff ? (
                      <video ref={localVideoRef} autoPlay muted playsInline
                        className="w-full h-full object-cover" style={{ transform: "scaleX(-1)" }} />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center"
                        style={{ background: "rgba(15,20,16,0.9)" }}>
                        <VideoOff size={20} className="text-white/30" />
                      </div>
                    )}
                    <div className="absolute bottom-1.5 left-1.5 text-[9px] text-white/60 bg-black/50 px-1.5 py-0.5 rounded-full">You</div>
                  </motion.div>

                  <div className="flex items-center justify-center gap-4">
                    <CtrlBtn icon={local.muted ? MicOff : Mic} active={!local.muted} danger={local.muted}
                      onClick={local.toggleMute} label={local.muted ? "Unmute" : "Mute"} />
                    <CtrlBtn icon={speakerMuted ? VolumeX : Volume2} active={!speakerMuted}
                      onClick={() => setSpeakerMuted(m => !m)} label="Speaker" />
                    <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.93 }}
                      onClick={handleEnd}
                      className="w-16 h-16 rounded-full flex items-center justify-center shadow-2xl shadow-red-900/40"
                      style={{ background: "linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)" }}>
                      <PhoneOff size={22} className="text-white" />
                    </motion.button>
                    <CtrlBtn icon={local.camOff ? VideoOff : Video} active={!local.camOff} danger={local.camOff}
                      onClick={local.toggleCam} label={local.camOff ? "Start cam" : "Stop cam"} />
                    <CtrlBtn icon={Shield} active label="Secure" onClick={() => {}} />
                  </div>

                  <p className="text-center text-[10px] text-white/20">
                    HIPAA compliant · End-to-end encrypted · No recording without consent
                  </p>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <VoiceSelectorModal
        isOpen={showVoiceModal}
        onClose={() => setShowVoiceModal(false)}
        selectedPersonaId={aiCall.selectedPersonaId}
        selectedVoiceURI={aiCall.selectedVoiceURI}
        onSelectPersona={aiCall.changePersona}
        onSelectVoiceURI={aiCall.changeCustomVoice}
        onPreview={aiCall.previewVoice}
        availableVoices={aiCall.availableVoices}
      />
    </motion.div>
  );
}

// ── Control button ────────────────────────────────────────────────────────────
function CtrlBtn({ icon: Icon, active, danger, onClick, label }: {
  icon: React.ElementType;
  active?: boolean;
  danger?: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.88 }}
      onClick={onClick}
      title={label}
      className="flex flex-col items-center gap-1.5 group">
      <div className={`w-13 h-13 w-12 h-12 rounded-2xl flex items-center justify-center border transition-all ${
        danger
          ? "border-red-500/40 bg-red-900/30"
          : active
            ? "border-white/15 bg-white/10 group-hover:bg-white/15"
            : "border-white/8 bg-white/5 group-hover:bg-white/10"
      }`}>
        <Icon size={18} className={danger ? "text-red-400" : active ? "text-white" : "text-white/40"} />
      </div>
      <span className="text-[9px] text-white/30 group-hover:text-white/50 transition-colors">{label}</span>
    </motion.button>
  );
}
