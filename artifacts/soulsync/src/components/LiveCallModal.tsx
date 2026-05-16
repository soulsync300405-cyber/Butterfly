import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mic, MicOff, Video, VideoOff, PhoneOff,
  MessageCircle, X, Send, Shield, Wifi
} from "lucide-react";
import type { LiveMsg } from "@/hooks/useStudentCall";

interface LiveCallModalProps {
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  peerName: string;
  role: "user" | "psych";              // who is viewing this modal
  messages: LiveMsg[];
  onSendMessage: (text: string) => void;
  onEnd: () => void;
  status: "connecting" | "active" | "ended";
}

export function LiveCallModal({
  localStream, remoteStream, peerName, role,
  messages, onSendMessage, onEnd, status,
}: LiveCallModalProps) {
  const localVidRef  = useRef<HTMLVideoElement>(null);
  const remoteVidRef = useRef<HTMLVideoElement>(null);
  const chatEndRef   = useRef<HTMLDivElement>(null);

  const [muted, setMuted]       = useState(false);
  const [camOff, setCamOff]     = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [input, setInput]       = useState("");
  const [secs, setSecs]         = useState(0);

  // Wire streams → video elements
  useEffect(() => {
    if (localVidRef.current && localStream) {
      localVidRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteVidRef.current && remoteStream) {
      remoteVidRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  // Timer
  useEffect(() => {
    if (status !== "active") return;
    const t = setInterval(() => setSecs(s => s + 1), 1000);
    return () => clearInterval(t);
  }, [status]);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const fmt = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  const toggleMute = () => {
    localStream?.getAudioTracks().forEach(t => { t.enabled = !t.enabled; });
    setMuted(m => !m);
  };
  const toggleCam = () => {
    localStream?.getVideoTracks().forEach(t => { t.enabled = !t.enabled; });
    setCamOff(c => !c);
  };

  const send = () => {
    if (!input.trim()) return;
    onSendMessage(input.trim());
    setInput("");
  };

  const hasLocalVideo  = !!localStream?.getVideoTracks().length;
  const hasRemoteVideo = !!remoteStream?.getVideoTracks().length;

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex"
      style={{ background: "radial-gradient(ellipse 130% 100% at 50% 0%, #0c1c13 0%, #060908 100%)" }}
    >
      {/* Grid texture */}
      <div className="absolute inset-0 opacity-[0.025]"
        style={{ backgroundImage: "linear-gradient(rgba(255,255,255,.4) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.4) 1px, transparent 1px)", backgroundSize: "48px 48px" }} />

      {/* Ambient glow */}
      <motion.div animate={{ opacity: [0.12, 0.22, 0.12] }} transition={{ duration: 5, repeat: Infinity }}
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[280px] rounded-full blur-3xl pointer-events-none"
        style={{ background: "radial-gradient(ellipse, #3A7A52 0%, transparent 70%)" }} />

      {/* ── Main video area ── */}
      <div className="flex-1 relative flex flex-col">

        {/* Remote video / waiting */}
        <div className="flex-1 relative flex items-center justify-center overflow-hidden">
          {hasRemoteVideo ? (
            <video ref={remoteVidRef} autoPlay playsInline
              className="w-full h-full object-cover" />
          ) : (
            <div className="flex flex-col items-center gap-5">
              {status === "connecting" ? (
                <>
                  <motion.div animate={{ rotate: 360 }}
                    transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
                    className="w-16 h-16 rounded-full border-2 border-primary/30 border-t-primary" />
                  <p className="text-white/50 text-sm">Connecting to {peerName}...</p>
                </>
              ) : (
                <>
                  <motion.div
                    animate={{ boxShadow: ["0 0 0 0px rgba(58,122,82,0.3)", "0 0 0 20px rgba(58,122,82,0)", "0 0 0 0px rgba(58,122,82,0)"] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="w-28 h-28 rounded-full border-2 border-white/15 flex items-center justify-center"
                    style={{ background: "rgba(58,122,82,0.12)" }}>
                    <span className="text-4xl font-black text-white/60">
                      {peerName.slice(0, 2).toUpperCase()}
                    </span>
                  </motion.div>
                  <p className="text-white/60 font-semibold">{peerName}</p>
                  <p className="text-white/30 text-sm">Audio only — camera not available</p>
                </>
              )}
            </div>
          )}

          {/* Top HUD */}
          <div className="absolute inset-x-0 top-0 flex items-center justify-between px-5 pt-5"
            style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.65), transparent)" }}>
            <div className="flex items-center gap-2.5">
              <motion.div animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.5, repeat: Infinity }}
                className={`w-2 h-2 rounded-full ${status === "active" ? "bg-primary" : "bg-amber-400"}`} />
              <span className="text-white/60 text-xs uppercase tracking-widest">
                {status === "connecting" ? "Connecting..." : `${role === "user" ? "Psychologist" : "Patient"} Session`}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {status === "active"
                ? <Wifi size={13} className="text-primary" />
                : <motion.div animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 0.9, repeat: Infinity }}>
                    <Wifi size={13} className="text-amber-400" />
                  </motion.div>}
              <span className="text-white/50 text-sm font-mono">{fmt(secs)}</span>
            </div>
          </div>

          {/* Local PiP */}
          <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
            className="absolute top-16 right-4 w-28 h-40 rounded-2xl overflow-hidden border-2 border-white/15 shadow-2xl bg-black">
            {hasLocalVideo && !camOff ? (
              <video ref={localVidRef} autoPlay muted playsInline
                className="w-full h-full object-cover" style={{ transform: "scaleX(-1)" }} />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <VideoOff size={20} className="text-white/25" />
              </div>
            )}
            <div className="absolute bottom-1.5 left-1.5 text-[9px] text-white/50 bg-black/50 px-1.5 py-0.5 rounded-full">You</div>
          </motion.div>
        </div>

        {/* Bottom controls */}
        <div className="px-6 pb-8 pt-4 flex flex-col gap-4"
          style={{ background: "linear-gradient(to top, rgba(0,0,0,0.8), transparent)" }}>

          {/* HIPAA note */}
          <div className="flex items-center justify-center gap-1.5">
            <Shield size={10} className="text-primary/50" />
            <span className="text-[10px] text-white/25">End-to-end encrypted · HIPAA compliant</span>
          </div>

          <div className="flex items-center justify-center gap-4">
            <CtrlBtn icon={muted ? MicOff : Mic} active={!muted} danger={muted}
              label={muted ? "Unmute" : "Mute"} onClick={toggleMute} />

            <CtrlBtn icon={camOff ? VideoOff : Video} active={!camOff}
              label="Camera" onClick={toggleCam} />

            {/* End */}
            <motion.button whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.93 }}
              onClick={onEnd}
              className="w-16 h-16 rounded-full flex items-center justify-center shadow-2xl shadow-red-900/40"
              style={{ background: "linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)" }}>
              <PhoneOff size={22} className="text-white" />
            </motion.button>

            <CtrlBtn icon={MessageCircle} active={chatOpen}
              label="Chat" onClick={() => setChatOpen(o => !o)}
              badge={!chatOpen && messages.filter(m =>
                (role === "user" ? m.role === "psych" : m.role === "user")
              ).length > 0} />

            <div className="w-12 h-12" /> {/* spacer */}
          </div>
        </div>
      </div>

      {/* ── Live chat panel ── */}
      <AnimatePresence>
        {chatOpen && (
          <motion.div
            initial={{ width: 0, opacity: 0 }} animate={{ width: 320, opacity: 1 }} exit={{ width: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="flex-shrink-0 flex flex-col overflow-hidden border-l border-white/10"
            style={{ background: "rgba(8,14,10,0.9)", backdropFilter: "blur(20px)" }}>

            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3.5 border-b border-white/8">
              <div>
                <p className="text-white font-bold text-sm">Live Session Chat</p>
                <p className="text-white/35 text-xs">Messages are end-to-end encrypted</p>
              </div>
              <button onClick={() => setChatOpen(false)} className="text-white/40 hover:text-white/70 transition-colors">
                <X size={16} />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
              {messages.length === 0 && (
                <p className="text-center text-white/25 text-xs pt-8">
                  Messages will appear here during the session
                </p>
              )}
              {messages.map(msg => {
                const isMe = (role === "user" && msg.role === "user") || (role === "psych" && msg.role === "psych");
                return (
                  <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[78%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                      isMe
                        ? "rounded-br-sm text-white"
                        : "rounded-bl-sm text-white/90 border border-white/10"
                    }`}
                      style={isMe
                        ? { background: "rgba(58,122,82,0.7)" }
                        : { background: "rgba(255,255,255,0.06)" }}>
                      {!isMe && <p className="text-[10px] text-white/40 mb-0.5">{msg.sender}</p>}
                      {msg.text}
                      <p className="text-[9px] opacity-40 mt-1 text-right">{msg.time}</p>
                    </div>
                  </div>
                );
              })}
              <div ref={chatEndRef} />
            </div>

            {/* Input */}
            <div className="px-3 py-3 border-t border-white/8">
              <div className="flex items-center gap-2 rounded-xl border border-white/12 px-3 py-2"
                style={{ background: "rgba(255,255,255,0.05)" }}>
                <input
                  value={input} onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && !e.shiftKey && send()}
                  placeholder="Type a message..."
                  className="flex-1 bg-transparent text-white text-sm placeholder-white/25 focus:outline-none"
                />
                <motion.button whileTap={{ scale: 0.9 }} onClick={send}
                  className={`p-1.5 rounded-lg transition-colors ${input.trim() ? "text-primary hover:text-primary/80" : "text-white/20"}`}>
                  <Send size={15} />
                </motion.button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Control button ────────────────────────────────────────────────────────────
function CtrlBtn({
  icon: Icon, active, danger, label, onClick, badge,
}: {
  icon: React.ElementType; active: boolean; danger?: boolean;
  label: string; onClick: () => void; badge?: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <motion.button whileHover={{ scale: 1.07 }} whileTap={{ scale: 0.92 }}
        onClick={onClick}
        className={`relative w-12 h-12 rounded-2xl flex items-center justify-center transition-colors ${
          danger
            ? "bg-destructive/20 text-destructive border border-destructive/30"
            : active
              ? "border border-white/15 text-white"
              : "border border-white/8 text-white/35"
        }`}
        style={active && !danger ? { background: "rgba(255,255,255,0.12)" } : { background: "rgba(255,255,255,0.04)" }}>
        <Icon size={18} />
        {badge && (
          <span className="absolute -top-1 -right-1 w-3 h-3 bg-primary rounded-full" />
        )}
      </motion.button>
      <span className="text-[10px] text-white/35">{label}</span>
    </div>
  );
}
