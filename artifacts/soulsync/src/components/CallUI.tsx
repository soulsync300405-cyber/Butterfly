import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, MicOff, Video, VideoOff, PhoneOff, Volume2, Camera, Shield } from "lucide-react";
import { AnimeAvatar } from "@/components/AnimeAvatar";
import type { Companion } from "@/lib/store";

interface CallUIProps {
  type: "ai" | "psychologist";
  companion?: Companion | null;
  psychName?: string;
  onEnd: () => void;
}

export function CallUI({ type, companion, psychName, onEnd }: CallUIProps) {
  const [permissionStep, setPermissionStep] = useState(true);
  const [micGranted, setMicGranted] = useState(false);
  const [camGranted, setCamGranted] = useState(false);
  const [muted, setMuted] = useState(false);
  const [camOff, setCamOff] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [remoteSpeaking, setRemoteSpeaking] = useState(true);
  const bars = Array.from({ length: 20 });

  useEffect(() => {
    if (!permissionStep) {
      const t = setInterval(() => setSeconds(s => s + 1), 1000);
      return () => clearInterval(t);
    }
    return undefined;
  }, [permissionStep]);

  useEffect(() => {
    if (!permissionStep) {
      const t = setInterval(() => setRemoteSpeaking(p => !p), 3500);
      return () => clearInterval(t);
    }
    return undefined;
  }, [permissionStep]);

  const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  const allGranted = micGranted && camGranted;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "radial-gradient(ellipse at center, #0f1f14 0%, #0a0c0a 80%)" }}>

      <AnimatePresence mode="wait">
        {permissionStep ? (
          <motion.div key="perm" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-card border border-border rounded-2xl p-8 w-full max-w-sm shadow-2xl space-y-6 mx-4">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center mx-auto">
                <Shield size={24} className="text-primary" />
              </div>
              <h2 className="text-xl font-bold text-foreground font-serif">Before we connect</h2>
              <p className="text-sm text-muted-foreground">
                {type === "ai" ? `Your AI companion ${companion?.name || "Asha"} needs these to see and hear you` : `Dr. ${psychName} needs these to connect with you`}
              </p>
            </div>

            <div className="space-y-3">
              {/* Microphone */}
              <div className={`flex items-center justify-between p-4 rounded-xl border transition-all ${micGranted ? "border-primary/40 bg-primary/5" : "border-border bg-muted/30"}`}>
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center ${micGranted ? "bg-primary/20" : "bg-muted"}`}>
                    <Mic size={16} className={micGranted ? "text-primary" : "text-muted-foreground"} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">Microphone</p>
                    <p className="text-xs text-muted-foreground">So they can hear you</p>
                  </div>
                </div>
                <button onClick={() => setMicGranted(true)}
                  className={`text-xs px-3 py-1.5 rounded-full font-medium transition-all ${micGranted ? "bg-primary/20 text-primary" : "bg-primary text-primary-foreground hover:opacity-90"}`}>
                  {micGranted ? "Granted" : "Allow"}
                </button>
              </div>

              {/* Camera */}
              <div className={`flex items-center justify-between p-4 rounded-xl border transition-all ${camGranted ? "border-primary/40 bg-primary/5" : "border-border bg-muted/30"}`}>
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center ${camGranted ? "bg-primary/20" : "bg-muted"}`}>
                    <Camera size={16} className={camGranted ? "text-primary" : "text-muted-foreground"} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">Camera</p>
                    <p className="text-xs text-muted-foreground">For video sessions</p>
                  </div>
                </div>
                <button onClick={() => setCamGranted(true)}
                  className={`text-xs px-3 py-1.5 rounded-full font-medium transition-all ${camGranted ? "bg-primary/20 text-primary" : "bg-primary text-primary-foreground hover:opacity-90"}`}>
                  {camGranted ? "Granted" : "Allow"}
                </button>
              </div>
            </div>

            <p className="text-[11px] text-muted-foreground text-center">Your privacy is protected. Video is never stored without your consent.</p>

            <div className="flex gap-3">
              <button onClick={onEnd} className="flex-1 py-3 rounded-xl border border-border text-sm font-medium text-muted-foreground hover:bg-muted/50 transition-colors">
                Cancel
              </button>
              <button onClick={() => { if (allGranted) setPermissionStep(false); }}
                disabled={!allGranted}
                className={`flex-1 py-3 rounded-xl text-sm font-semibold transition-all ${allGranted ? "bg-primary text-primary-foreground hover:opacity-90" : "bg-muted text-muted-foreground cursor-not-allowed"}`}>
                {allGranted ? "Start Call" : "Allow Both"}
              </button>
            </div>
          </motion.div>
        ) : (
          <motion.div key="call" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="w-full h-full flex flex-col items-center justify-between py-12 px-6">
            {/* Remote party info */}
            <div className="text-center space-y-1">
              <p className="text-white/50 text-xs tracking-widest uppercase">
                {type === "ai" ? "AI Session" : "Psychologist Session"}
              </p>
              <h2 className="text-white text-2xl font-bold font-serif">
                {type === "ai" ? (companion?.name || "Asha") : `Dr. ${psychName}`}
              </h2>
              <p className="text-white/40 text-sm">{fmt(seconds)}</p>
            </div>

            {/* Avatar area */}
            <div className="flex flex-col items-center gap-6">
              {type === "ai" ? (
                <AnimeAvatar speaking={remoteSpeaking} size={180}
                  style={companion?.appearance as any || "soft-pastel"}
                  gender={companion?.gender || "female"}
                  name={companion?.name || "Asha"}
                />
              ) : (
                <motion.div
                  className="w-44 h-44 rounded-full border-4 border-white/20 bg-primary/20 flex items-center justify-center"
                  animate={remoteSpeaking ? { boxShadow: ["0 0 0 0 rgba(255,255,255,0.1)", "0 0 0 20px rgba(255,255,255,0)", "0 0 0 0 rgba(255,255,255,0)"] } : {}}
                  transition={{ duration: 1.5, repeat: Infinity }}>
                  <span className="text-5xl font-bold text-white/80">{psychName?.slice(0, 2).toUpperCase() || "DR"}</span>
                </motion.div>
              )}

              {/* Waveform */}
              <div className="flex items-center gap-0.5" style={{ height: 36 }}>
                {bars.map((_, i) => (
                  <motion.div key={i} className="rounded-full"
                    style={{ width: 3, background: remoteSpeaking ? "linear-gradient(to top, #3A7A52, #4CAF75)" : "rgba(255,255,255,0.2)" }}
                    animate={remoteSpeaking ? { height: [3, Math.random() * 26 + 4, 3] } : { height: 3 }}
                    transition={{ duration: 0.2 + Math.random() * 0.3, repeat: Infinity, delay: i * 0.04 }}
                  />
                ))}
              </div>
            </div>

            {/* Self-view (mock) */}
            {!camOff && (
              <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                className="absolute top-4 right-4 w-24 h-32 rounded-xl bg-muted/20 border border-white/20 overflow-hidden flex items-center justify-center">
                <div className="text-white/30 text-xs">You</div>
              </motion.div>
            )}

            {/* Controls */}
            <div className="flex items-center gap-5">
              <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                onClick={() => setMuted(m => !m)}
                className={`w-13 h-13 w-14 h-14 rounded-full flex items-center justify-center border transition-all ${muted ? "bg-destructive/20 border-destructive/50" : "bg-white/10 border-white/20"}`}>
                {muted ? <MicOff size={20} className="text-destructive" /> : <Mic size={20} className="text-white" />}
              </motion.button>
              <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                onClick={onEnd}
                className="w-16 h-16 rounded-full bg-destructive flex items-center justify-center shadow-lg shadow-destructive/40">
                <PhoneOff size={24} className="text-white" />
              </motion.button>
              <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                onClick={() => setCamOff(c => !c)}
                className={`w-14 h-14 rounded-full flex items-center justify-center border transition-all ${camOff ? "bg-destructive/20 border-destructive/50" : "bg-white/10 border-white/20"}`}>
                {camOff ? <VideoOff size={20} className="text-destructive" /> : <Video size={20} className="text-white" />}
              </motion.button>
              <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                className="w-14 h-14 rounded-full bg-white/10 border border-white/20 flex items-center justify-center">
                <Volume2 size={20} className="text-white" />
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
