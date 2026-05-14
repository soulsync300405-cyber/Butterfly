import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageCircle, Target, BookOpen, UserCheck, BarChart2, Settings as SettingsIcon,
  Send, Mic, MicOff, Eye, Phone, Video, ChevronRight, Flame, Star, X,
  Play, Pause, CheckCircle, Clock, Trophy, TrendingUp, Bell, Lock, Volume2,
  LogOut, Sliders, RefreshCw, ChevronDown, ChevronUp, Shield, AlertTriangle,
  Calendar, ArrowRight, MoreVertical, Sparkles
} from "lucide-react";
import { AnimeAvatar } from "@/components/AnimeAvatar";
import { MusicPlayer } from "@/components/MusicPlayer";
import { CallUI } from "@/components/CallUI";
import { useStore } from "@/lib/store";
import {
  QUESTS, COURSES, PSYCHOLOGISTS, MOOD_DATA, ASHA_RESPONSES, SCHEDULE_SLOTS
} from "@/lib/data";
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

const CATEGORY_COLORS: Record<string, string> = {
  ADHD: "#F59E0B", OCD: "#EC4899", Anxiety: "#EF4444",
  Focus: "#3A7A52", Breathing: "#06B6D4", Grounding: "#8B5CF6",
};

interface NavItem { id: string; label: string; icon: typeof MessageCircle }

const NAV: NavItem[] = [
  { id: "chat", label: "Chat", icon: MessageCircle },
  { id: "quests", label: "Quests", icon: Target },
  { id: "learn", label: "EQ Learning", icon: BookOpen },
  { id: "psych", label: "Talk to Psychologist", icon: UserCheck },
  { id: "analytics", label: "Analytics", icon: BarChart2 },
  { id: "settings", label: "Settings", icon: SettingsIcon },
];

export function StudentApp({ onLogout }: { onLogout: () => void }) {
  const [tab, setTab] = useState("chat");
  const { user, companion, completedQuests, settings } = useStore();

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <aside className="w-64 flex-shrink-0 bg-card border-r border-border flex flex-col">
        {/* Brand */}
        <div className="px-4 py-5 border-b border-border">
          <h1 className="text-xl font-black font-serif text-primary">SoulSync</h1>
        </div>

        {/* User card */}
        <div className="mx-3 mt-3 p-3 rounded-xl bg-primary/5 border border-primary/15">
          <div className="flex items-center gap-3">
            <AnimeAvatar size={36} style={companion?.appearance as any || "soft-pastel"} gender={companion?.gender || "female"} />
            <div className="min-w-0">
              <p className="text-foreground font-semibold text-sm truncate">{user?.name || "User"}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[10px] text-primary font-bold">Lv. {user?.level || 1}</span>
                <span className="text-[10px] text-muted-foreground">{user?.xp || 0} XP</span>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-1.5 mt-2.5">
            {[{ label: "Streak", value: `${user?.streak || 0}d`, icon: Flame },
              { label: "Sessions", value: `${user?.sessions || 0}`, icon: MessageCircle },
              { label: "Quests", value: `${completedQuests.length}`, icon: Target }].map(item => (
              <div key={item.label} className="text-center bg-background rounded-lg p-1.5">
                <item.icon size={11} className="text-primary mx-auto mb-0.5" />
                <div className="text-foreground text-xs font-bold">{item.value}</div>
                <div className="text-muted-foreground text-[9px]">{item.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
          {NAV.map(item => (
            <button key={item.id} onClick={() => setTab(item.id)} data-testid={`nav-${item.id}`}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-sm ${tab === item.id ? "bg-primary text-primary-foreground font-semibold shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"}`}>
              <item.icon size={16} />
              {item.label}
              {item.id === "quests" && completedQuests.length > 0 && (
                <span className="ml-auto text-[10px] bg-primary/20 text-primary rounded-full px-1.5 py-0.5 font-bold">{completedQuests.length}</span>
              )}
            </button>
          ))}
        </nav>

        {/* Music Player */}
        <MusicPlayer />

        {/* Logout */}
        <button onClick={onLogout} className="flex items-center gap-2 px-4 py-3 text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-colors text-sm">
          <LogOut size={14} /> Sign out
        </button>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div key={tab} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.15 }} className="h-full overflow-y-auto">
            {tab === "chat" && <ChatTab />}
            {tab === "quests" && <QuestsTab />}
            {tab === "learn" && <LearnTab />}
            {tab === "psych" && <PsychTab />}
            {tab === "analytics" && <AnalyticsTab />}
            {tab === "settings" && <SettingsTab />}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}

// ─── CHAT TAB ────────────────────────────────────────────────────────────────
function ChatTab() {
  const { companion, user } = useStore();
  const [messages, setMessages] = useState([
    { id: 1, role: "ai", text: `Haan yaar, main sun rahi hoon. Aaj kaisa feel ho raha hai?`, time: "10:02", speaking: false },
    { id: 2, role: "user", text: "Bahut overwhelmed hoon. Exams ke wajah se neend nahi aa rahi", time: "10:03" },
    { id: 3, role: "ai", text: "Samajh sakti hoon. Ye feelings bilkul valid hain. Ek kaam karte hain — abhi sirf ek deep breath lo mere saath. Breathe in... 4 counts. Ready?", time: "10:03", speaking: false },
  ]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [recording, setRecording] = useState(false);
  const [showCall, setShowCall] = useState(false);
  const [callType, setCallType] = useState<"ai" | "psychologist">("ai");
  const [showVision, setShowVision] = useState(false);
  const [visionResult, setVisionResult] = useState<any>(null);
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [overrideMsg, setOverrideMsg] = useState("");
  const [overrideSent, setOverrideSent] = useState(false);
  const [showCustomizer, setShowCustomizer] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const cName = companion?.name || "Asha";

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, typing]);

  const send = () => {
    if (!input.trim()) return;
    const userMsg = { id: Date.now(), role: "user", text: input, time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) };
    setMessages(p => [...p, userMsg]);
    setInput("");
    setTyping(true);
    setTimeout(() => {
      setTyping(false);
      const r = ASHA_RESPONSES[Math.floor(Math.random() * ASHA_RESPONSES.length)];
      setMessages(p => [...p, { id: Date.now() + 1, role: "ai", text: r, time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }), speaking: false }]);
    }, 1400 + Math.random() * 800);
  };

  const sendOverride = () => {
    if (!overrideMsg.trim()) return;
    setMessages(p => [...p, { id: Date.now(), role: "override", text: `[From Dr. Priya Iyer]: ${overrideMsg}`, time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }), speaking: false }]);
    setOverrideMsg("");
    setOverrideSent(true);
    setTimeout(() => setOverrideSent(false), 3000);
  };

  const runVision = () => {
    setShowVision(true);
    setVisionResult(null);
    setTimeout(() => setVisionResult({
      emotion: "Mild Anxiety", fatigue: 68, focus: 42, advice: "Looks like you might be a bit tense. Try rolling your shoulders back slowly — 3 times. Small movements, big relief."
    }), 2200);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-4 px-5 py-3 border-b border-border bg-card sticky top-0 z-10">
        <AnimeAvatar speaking={typing} size={44} style={companion?.appearance as any || "soft-pastel"} gender={companion?.gender || "female"} />
        <div>
          <p className="font-bold text-foreground font-serif">{cName}</p>
          <div className="flex items-center gap-1.5">
            <motion.div animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 2, repeat: Infinity }}
              className="w-1.5 h-1.5 rounded-full bg-green-500" />
            <span className="text-green-600 text-xs">{typing ? "typing..." : "Active now"}</span>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {/* Session override badge */}
          <motion.button whileHover={{ scale: 1.03 }} onClick={() => setOverrideOpen(o => !o)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${overrideOpen ? "bg-amber-500/15 border-amber-500/40 text-amber-700" : "bg-muted border-border text-muted-foreground hover:text-foreground"}`}>
            <Shield size={11} /> Session Override
            {overrideOpen ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
          </motion.button>
          <button onClick={() => setShowCustomizer(true)} className="p-2 rounded-xl hover:bg-muted transition-colors text-muted-foreground hover:text-foreground" title="Customize companion">
            <Sliders size={16} />
          </button>
          <button onClick={() => { setCallType("ai"); setShowCall(true); }} className="p-2 rounded-xl hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
            <Phone size={16} />
          </button>
          <button onClick={() => { setCallType("ai"); setShowCall(true); }} className="p-2 rounded-xl hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
            <Video size={16} />
          </button>
          <button onClick={runVision} className="p-2 rounded-xl hover:bg-muted transition-colors text-muted-foreground hover:text-foreground" title="Vision Analysis">
            <Eye size={16} />
          </button>
        </div>
      </div>

      {/* Session Override Panel */}
      <AnimatePresence>
        {overrideOpen && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-b border-amber-500/30 bg-amber-50 dark:bg-amber-900/10">
            <div className="px-5 py-3 space-y-2">
              <div className="flex items-center gap-2 text-amber-700">
                <Shield size={14} /> <span className="text-xs font-semibold">Psychologist Session Override — Dr. Priya Iyer</span>
                {overrideSent && <span className="ml-auto text-xs text-green-600 font-medium flex items-center gap-1"><CheckCircle size={11} /> Sent</span>}
              </div>
              <div className="flex gap-2">
                <input value={overrideMsg} onChange={e => setOverrideMsg(e.target.value)}
                  placeholder="Send a message directly to the session..."
                  className="flex-1 text-xs px-3 py-2 rounded-lg border border-amber-300 bg-white focus:outline-none focus:ring-1 focus:ring-amber-400"
                  onKeyDown={e => e.key === "Enter" && sendOverride()}
                />
                <button onClick={sendOverride} className="px-3 py-2 bg-amber-500 text-white rounded-lg text-xs font-medium hover:bg-amber-600 transition-colors">Send</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {messages.map(msg => (
          <motion.div key={msg.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
            {msg.role === "ai" && <AnimeAvatar size={32} style={companion?.appearance as any || "soft-pastel"} gender={companion?.gender || "female"} />}
            {msg.role === "override" && (
              <div className="w-8 h-8 rounded-full bg-amber-100 border border-amber-300 flex items-center justify-center flex-shrink-0">
                <Shield size={14} className="text-amber-600" />
              </div>
            )}
            <div className={`max-w-[72%] ${msg.role === "user" ? "items-end" : "items-start"} flex flex-col gap-1`}>
              <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                msg.role === "user"
                  ? "bg-primary text-primary-foreground rounded-tr-sm"
                  : msg.role === "override"
                  ? "bg-amber-50 border border-amber-200 text-amber-800 rounded-tl-sm"
                  : "bg-card border border-border text-foreground rounded-tl-sm"
              }`}>
                {msg.text}
              </div>
              <span className="text-[10px] text-muted-foreground px-1">{msg.time}</span>
            </div>
          </motion.div>
        ))}
        {typing && (
          <div className="flex gap-3 items-end">
            <AnimeAvatar size={32} style={companion?.appearance as any || "soft-pastel"} gender={companion?.gender || "female"} speaking />
            <div className="bg-card border border-border rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-1">
              {[0, 1, 2].map(i => (
                <motion.div key={i} className="w-1.5 h-1.5 rounded-full bg-primary"
                  animate={{ y: [0, -4, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }} />
              ))}
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Input */}
      <div className="px-5 py-3 border-t border-border bg-card">
        <div className="flex items-center gap-2 bg-background border border-border rounded-2xl px-3 py-2">
          <input value={input} onChange={e => setInput(e.target.value)}
            placeholder={`Message ${cName}...`} data-testid="input-chat-message"
            className="flex-1 bg-transparent text-foreground placeholder-muted-foreground text-sm focus:outline-none"
            onKeyDown={e => e.key === "Enter" && !e.shiftKey && send()}
          />
          <button onClick={() => setRecording(r => !r)} data-testid="btn-mic"
            className={`p-2 rounded-xl transition-all ${recording ? "bg-destructive/10 text-destructive" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}>
            {recording ? <MicOff size={16} /> : <Mic size={16} />}
          </button>
          <button onClick={send} data-testid="btn-send"
            className={`p-2 rounded-xl transition-all ${input.trim() ? "bg-primary text-primary-foreground hover:opacity-90" : "text-muted-foreground"}`}>
            <Send size={16} />
          </button>
        </div>
        {recording && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
            className="flex items-center gap-2 mt-2 px-2">
            <motion.div animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1, repeat: Infinity }}
              className="w-2 h-2 rounded-full bg-destructive" />
            <div className="flex items-end gap-0.5 h-5">
              {Array.from({ length: 16 }).map((_, i) => (
                <motion.div key={i} className="w-0.5 rounded-full bg-primary"
                  animate={{ height: [2, Math.random() * 14 + 4, 2] }}
                  transition={{ duration: 0.3 + Math.random() * 0.2, repeat: Infinity, delay: i * 0.04 }} />
              ))}
            </div>
            <span className="text-xs text-muted-foreground">Recording... tap mic to stop</span>
          </motion.div>
        )}
      </div>

      {/* Vision Modal */}
      <AnimatePresence>
        {showVision && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/50 flex items-center justify-center p-4"
            onClick={() => { setShowVision(false); setVisionResult(null); }}>
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              onClick={e => e.stopPropagation()}
              className="bg-card border border-border rounded-2xl p-5 w-full max-w-sm shadow-2xl space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Eye size={18} className="text-primary" />
                  <h3 className="font-bold text-foreground font-serif">Vision Analysis</h3>
                </div>
                <button onClick={() => { setShowVision(false); setVisionResult(null); }}><X size={18} className="text-muted-foreground" /></button>
              </div>
              {/* Mock camera feed */}
              <div className="relative h-36 bg-muted rounded-xl overflow-hidden flex items-center justify-center">
                <div className="absolute inset-0 grid opacity-10" style={{ backgroundImage: "linear-gradient(hsl(145 33% 40%) 1px, transparent 1px), linear-gradient(90deg, hsl(145 33% 40%) 1px, transparent 1px)", backgroundSize: "20px 20px" }} />
                {!visionResult ? (
                  <motion.div className="flex flex-col items-center gap-2">
                    <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}>
                      <RefreshCw size={24} className="text-primary" />
                    </motion.div>
                    <span className="text-xs text-muted-foreground">Analyzing...</span>
                  </motion.div>
                ) : (
                  <div className="text-center space-y-1">
                    <div className="w-16 h-16 rounded-full border-2 border-primary/50 mx-auto flex items-center justify-center">
                      <span className="text-2xl">👤</span>
                    </div>
                    <p className="text-xs text-primary font-medium">Analysis Complete</p>
                  </div>
                )}
                <div className="absolute top-2 left-2 flex items-center gap-1 bg-destructive/20 rounded-full px-2 py-0.5">
                  <motion.div animate={{ opacity: [1, 0.2, 1] }} transition={{ duration: 1.2, repeat: Infinity }}
                    className="w-1.5 h-1.5 rounded-full bg-destructive" />
                  <span className="text-[10px] text-destructive font-medium">LIVE</span>
                </div>
              </div>
              {visionResult && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    {[{ label: "Emotion", value: visionResult.emotion, color: "text-amber-600" },
                      { label: "Fatigue", value: `${visionResult.fatigue}%`, color: "text-red-500" },
                      { label: "Focus", value: `${visionResult.focus}%`, color: "text-primary" },
                      { label: "Confidence", value: "87%", color: "text-blue-500" }].map(item => (
                      <div key={item.label} className="bg-muted/50 rounded-xl p-3">
                        <div className="text-muted-foreground text-xs">{item.label}</div>
                        <div className={`font-semibold text-sm mt-0.5 ${item.color}`}>{item.value}</div>
                      </div>
                    ))}
                  </div>
                  <div className="bg-primary/5 border border-primary/15 rounded-xl p-3">
                    <p className="text-xs text-muted-foreground mb-1">{companion?.name || "Asha"}'s take</p>
                    <p className="text-sm text-foreground">{visionResult.advice}</p>
                  </div>
                </motion.div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Companion Customizer */}
      <AnimatePresence>
        {showCustomizer && <CompanionCustomizerModal onClose={() => setShowCustomizer(false)} />}
      </AnimatePresence>

      {/* Call UI */}
      <AnimatePresence>
        {showCall && <CallUI type={callType} companion={companion} onEnd={() => setShowCall(false)} />}
      </AnimatePresence>
    </div>
  );
}

function CompanionCustomizerModal({ onClose }: { onClose: () => void }) {
  const { companion, setCompanion } = useStore();
  const [name, setName] = useState(companion?.name || "Asha");
  const [voiceStyle, setVoiceStyle] = useState(companion?.voiceStyle || "Calm");
  const [tone, setTone] = useState(companion?.tone ?? 50);
  const [creativity, setCreativity] = useState(companion?.creativity ?? 60);
  const [hinglish, setHinglish] = useState(companion?.language === "hinglish");

  const save = () => {
    if (companion) setCompanion({ ...companion, name, voiceStyle, tone, creativity, language: hinglish ? "hinglish" : "english" });
    onClose();
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
        className="bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-5">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-foreground font-serif flex items-center gap-2"><Sparkles size={16} className="text-primary" /> Customize {companion?.name || "Asha"}</h3>
          <button onClick={onClose}><X size={18} className="text-muted-foreground" /></button>
        </div>
        <div className="flex justify-center">
          <AnimeAvatar size={70} style={companion?.appearance as any || "soft-pastel"} gender={companion?.gender || "female"} name={name} />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">Name</label>
          <input value={name} onChange={e => setName(e.target.value)}
            className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40" />
        </div>
        {[{ key: "tone", label: "Tone", left: "Empathetic", right: "Goal-Oriented", val: tone, set: setTone },
          { key: "creativity", label: "Creativity", left: "Grounded", right: "Expressive", val: creativity, set: setCreativity }].map(item => (
          <div key={item.key} className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="font-medium text-foreground">{item.label}</span>
              <span className="text-muted-foreground">{item.left} ↔ {item.right}</span>
            </div>
            <input type="range" min={0} max={100} value={item.val} onChange={e => item.set(+e.target.value)} className="w-full accent-primary h-1.5" />
          </div>
        ))}
        <div className="flex items-center justify-between py-2 px-4 bg-muted/40 rounded-xl">
          <div>
            <p className="text-sm font-medium text-foreground">Hinglish Mode</p>
            <p className="text-xs text-muted-foreground">Hindi + English blend</p>
          </div>
          <button onClick={() => setHinglish(h => !h)}
            className={`w-12 h-6 rounded-full relative transition-all ${hinglish ? "bg-primary" : "bg-muted"}`}>
            <motion.div animate={{ x: hinglish ? 24 : 2 }} className="absolute top-1 w-4 h-4 bg-white rounded-full shadow" />
          </button>
        </div>
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-border text-sm text-muted-foreground hover:bg-muted/50 transition-colors">Cancel</button>
          <button onClick={save} className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity">Save Changes</button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── QUESTS TAB ──────────────────────────────────────────────────────────────
function QuestsTab() {
  const { user, completedQuests, completeQuest } = useStore();
  const [activeQuest, setActiveQuest] = useState<typeof QUESTS[0] | null>(null);
  const [questStep, setQuestStep] = useState(0);
  const [questDone, setQuestDone] = useState(false);
  const totalXP = completedQuests.reduce((acc, id) => acc + (QUESTS.find(q => q.id === id)?.xp || 0), 0);
  const levelXP = (user?.xp || 0) + totalXP;

  const startQuest = (q: typeof QUESTS[0]) => {
    setActiveQuest(q);
    setQuestStep(0);
    setQuestDone(false);
  };

  const nextStep = () => {
    if (!activeQuest) return;
    if (questStep < activeQuest.steps.length - 1) setQuestStep(s => s + 1);
    else { completeQuest(activeQuest.id, activeQuest.xp); setQuestDone(true); }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
            <span className="text-xl font-black text-primary">{user?.level || 1}</span>
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-black font-serif text-foreground">Wellness Journey</h2>
            <div className="flex items-center gap-4 mt-1">
              <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                <Star size={14} className="text-amber-500" /> {levelXP} Total XP
              </span>
              <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                <Flame size={14} className="text-orange-500" /> {user?.streak || 0} Day Streak
              </span>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Level Progress</p>
            <p className="text-sm font-bold text-primary">{Math.round((levelXP % 500) / 5)}%</p>
          </div>
        </div>
        <div className="mt-3 bg-muted rounded-full h-2.5 overflow-hidden">
          <motion.div className="h-full bg-gradient-to-r from-primary to-green-400 rounded-full"
            animate={{ width: `${Math.round((levelXP % 500) / 5)}%` }} transition={{ duration: 0.8, ease: "easeOut" }} />
        </div>
      </div>

      {/* Quest grid */}
      <div>
        <h3 className="text-lg font-bold font-serif text-foreground mb-4">Daily Quests</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {QUESTS.map(quest => {
            const done = completedQuests.includes(quest.id);
            const color = CATEGORY_COLORS[quest.category] || "#3A7A52";
            return (
              <motion.div key={quest.id} whileHover={{ y: -2, scale: 1.01 }} layout
                className={`bg-card border-2 rounded-2xl p-4 space-y-3 transition-all ${done ? "border-primary/30 opacity-80" : "border-border hover:border-primary/40 hover:shadow-md"}`}>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold px-2.5 py-1 rounded-full"
                    style={{ background: color + "20", color }}>
                    {quest.category}
                  </span>
                  <span className="text-sm font-bold flex items-center gap-1 text-amber-600">
                    <Star size={13} /> {quest.xp}
                  </span>
                </div>
                <div>
                  <h4 className="font-bold text-foreground font-serif">{quest.title}</h4>
                  <p className="text-muted-foreground text-xs mt-1 leading-relaxed line-clamp-2">{quest.desc}</p>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Clock size={11} /> {quest.duration}</span>
                    <span className="capitalize">{quest.difficulty}</span>
                  </div>
                  <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                    onClick={() => !done && startQuest(quest)}
                    data-testid={`btn-quest-start-${quest.id}`}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${done ? "bg-primary/10 text-primary cursor-default" : "bg-foreground text-background hover:opacity-90"}`}>
                    {done ? <><CheckCircle size={12} /> Done</> : <><Play size={12} className="ml-0.5" /> Start</>}
                  </motion.button>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Active Quest Modal */}
      <AnimatePresence>
        {activeQuest && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
              className="bg-card border border-border rounded-2xl p-6 w-full max-w-sm shadow-2xl space-y-5">
              {!questDone ? (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold px-2.5 py-1 rounded-full"
                      style={{ background: (CATEGORY_COLORS[activeQuest.category] || "#3A7A52") + "20", color: CATEGORY_COLORS[activeQuest.category] || "#3A7A52" }}>
                      {activeQuest.category}
                    </span>
                    <button onClick={() => setActiveQuest(null)}><X size={18} className="text-muted-foreground" /></button>
                  </div>
                  <div>
                    <h3 className="font-black font-serif text-foreground text-lg">{activeQuest.title}</h3>
                    <p className="text-muted-foreground text-xs mt-1">{activeQuest.desc}</p>
                  </div>
                  {/* Steps */}
                  <div className="space-y-2">
                    {activeQuest.steps.map((step, i) => (
                      <div key={i} className={`flex items-center gap-3 p-3 rounded-xl transition-all ${i === questStep ? "bg-primary/10 border border-primary/20" : i < questStep ? "opacity-50" : "opacity-40"}`}>
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${i < questStep ? "bg-primary text-primary-foreground" : i === questStep ? "bg-primary/20 text-primary border border-primary/40" : "bg-muted text-muted-foreground"}`}>
                          {i < questStep ? <CheckCircle size={12} /> : i + 1}
                        </div>
                        <p className={`text-sm ${i === questStep ? "text-foreground font-medium" : "text-muted-foreground"}`}>{step}</p>
                      </div>
                    ))}
                  </div>
                  {/* Progress */}
                  <div className="bg-muted rounded-full h-1.5 overflow-hidden">
                    <motion.div className="h-full bg-primary rounded-full"
                      animate={{ width: `${((questStep + 1) / activeQuest.steps.length) * 100}%` }}
                      transition={{ duration: 0.4 }} />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setActiveQuest(null)} className="px-4 py-2.5 rounded-xl border border-border text-sm text-muted-foreground hover:bg-muted/50 transition-colors">Quit</button>
                    <button onClick={nextStep} className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity">
                      {questStep < activeQuest.steps.length - 1 ? "Next Step" : "Complete Quest"}
                    </button>
                  </div>
                </>
              ) : (
                <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="text-center space-y-4 py-4">
                  <motion.div animate={{ rotate: [0, 10, -10, 0], scale: [1, 1.2, 1] }} transition={{ duration: 0.5 }}
                    className="text-5xl">🎉</motion.div>
                  <div>
                    <h3 className="font-black font-serif text-foreground text-xl">Quest Complete!</h3>
                    <p className="text-muted-foreground text-sm mt-1">{activeQuest.title}</p>
                  </div>
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-center gap-3">
                    <Star size={20} className="text-amber-500" />
                    <span className="font-black text-2xl text-amber-700">+{activeQuest.xp} XP</span>
                  </div>
                  <button onClick={() => setActiveQuest(null)} className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold hover:opacity-90 transition-opacity">
                    Back to Quests
                  </button>
                </motion.div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── LEARN TAB ───────────────────────────────────────────────────────────────
function LearnTab() {
  const [playing, setPlaying] = useState<typeof COURSES[0] | null>(null);
  const [progress, setProgress] = useState(18);
  const { companion } = useStore();
  const featured = COURSES.find(c => c.featured) || COURSES[0];
  const rows = [
    { label: "Recommended for You", courses: COURSES.slice(0, 5) },
    { label: "ADHD & Focus Series", courses: COURSES.filter(c => ["ADHD", "Focus"].includes(c.category)) },
    { label: "Anxiety Toolkit", courses: COURSES.filter(c => c.category === "Anxiety") },
    { label: "Wellness Essentials", courses: COURSES.filter(c => ["Wellness", "Grounding", "EQ"].includes(c.category)) },
  ];

  if (playing) {
    return (
      <div className="h-full flex flex-col bg-[#0a0a0c]">
        {/* Video area */}
        <div className="flex-1 relative bg-gradient-to-br from-gray-900 to-black flex items-center justify-center">
          <div className={`w-full max-w-2xl aspect-video rounded-xl bg-gradient-to-br ${playing.gradient} flex items-center justify-center`}>
            <div className="text-center text-white space-y-2">
              <p className="text-xs opacity-60 uppercase tracking-widest">Episode 1</p>
              <p className="text-2xl font-black font-serif">{playing.ep1}</p>
              <p className="text-sm opacity-70">{playing.title}</p>
            </div>
          </div>
          {/* AI companion corner */}
          <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
            className="absolute bottom-4 right-4 flex items-end gap-2">
            <div className="bg-black/60 rounded-xl px-3 py-2 max-w-[160px] text-right">
              <p className="text-white text-xs">"This episode is life-changing. Trust the process!"</p>
            </div>
            <AnimeAvatar size={44} style={companion?.appearance as any || "soft-pastel"} gender={companion?.gender || "female"} speaking />
          </motion.div>
        </div>
        {/* Controls */}
        <div className="bg-[#111] px-6 py-4 space-y-3">
          <div className="flex items-center justify-between text-white/80">
            <div>
              <p className="font-bold text-sm">{playing.ep1}</p>
              <p className="text-xs text-white/40">{playing.title} · Episode 1 of {playing.episodes}</p>
            </div>
            <button onClick={() => setPlaying(null)} className="text-white/60 hover:text-white text-xs flex items-center gap-1">
              <X size={14} /> Exit
            </button>
          </div>
          <div className="space-y-1">
            <div className="w-full h-1 bg-white/20 rounded-full overflow-hidden cursor-pointer"
              onClick={e => { const r = e.currentTarget.getBoundingClientRect(); setProgress(((e.clientX - r.left) / r.width) * 100); }}>
              <div className="h-full bg-white rounded-full transition-all" style={{ width: `${progress}%` }} />
            </div>
            <div className="flex justify-between text-[10px] text-white/40">
              <span>{Math.floor(progress * 0.24)}:{String(Math.floor((progress * 0.24 % 1) * 60)).padStart(2, "0")}</span>
              <span>24:00</span>
            </div>
          </div>
          <div className="flex items-center justify-center gap-6">
            <button className="text-white/60 hover:text-white transition-colors"><SkipBackIcon /></button>
            <button className="w-12 h-12 rounded-full bg-white flex items-center justify-center hover:opacity-90 transition-opacity">
              <Play size={18} className="text-black ml-0.5" />
            </button>
            <button className="text-white/60 hover:text-white transition-colors"><SkipFwdIcon /></button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#0a0a0c] min-h-full text-white">
      {/* Featured hero */}
      <div className={`relative bg-gradient-to-b ${featured.gradient} to-[#0a0a0c] p-8 pb-16`}>
        <div className="max-w-lg">
          <span className="text-xs font-bold px-3 py-1 bg-white/20 rounded-full backdrop-blur-sm">Featured Course</span>
          <h2 className="text-3xl font-black font-serif mt-3">{featured.title}</h2>
          <p className="text-white/70 mt-2 text-sm leading-relaxed max-w-md">{featured.desc}</p>
          <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
            onClick={() => setPlaying(featured)}
            className="mt-5 flex items-center gap-2 bg-white text-black font-bold px-5 py-3 rounded-xl text-sm hover:opacity-95 transition-opacity">
            <Play size={16} className="ml-0.5" /> Play Episode 1
          </motion.button>
        </div>
      </div>

      {/* Rows */}
      <div className="px-6 pb-10 -mt-8 space-y-8">
        {rows.map(row => (
          <div key={row.label}>
            <h3 className="text-white font-bold mb-3 text-sm">{row.label}</h3>
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide" style={{ scrollbarWidth: "none" }}>
              {row.courses.map(course => (
                <motion.button key={course.id} whileHover={{ scale: 1.04, y: -3 }} whileTap={{ scale: 0.97 }}
                  onClick={() => setPlaying(course)}
                  className={`flex-shrink-0 w-44 rounded-xl overflow-hidden bg-gradient-to-br ${course.gradient} cursor-pointer`}>
                  <div className="p-4 aspect-[4/3] flex flex-col justify-between">
                    <span className="text-[10px] font-bold px-2 py-0.5 bg-white/20 rounded-full self-start backdrop-blur-sm">{course.category}</span>
                    <div>
                      <p className="text-white font-bold text-sm leading-tight">{course.title}</p>
                      <p className="text-white/60 text-xs mt-0.5">{course.episodes} ep · {course.duration}</p>
                    </div>
                  </div>
                </motion.button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SkipBackIcon() { return <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24"><path d="M6 6h2v12H6zm3.5 6 8.5 6V6z" /></svg>; }
function SkipFwdIcon() { return <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" /></svg>; }

// ─── PSYCH MESSAGING MODAL ───────────────────────────────────────────────────
type PsychMessage = { id: number; role: "user" | "psych"; text: string; time: string };
type BookingRecord = { pid: number; slot: string; confirmed: boolean };

const PSYCH_REPLIES: Record<number, string[]> = {
  1: [
    "Hello! Thanks for reaching out. How have you been feeling since our last session?",
    "That sounds really difficult. Would you like to schedule some time to talk through this properly?",
    "I hear you. Let's explore that further — sometimes putting feelings into words is the first step.",
    "That's a great insight. Keep noticing those patterns — they tell us a lot.",
    "I'm here whenever you need. Don't hesitate to message anytime between sessions.",
  ],
  2: [
    "Hi there! Good to hear from you. What's been on your mind lately?",
    "Intrusive thoughts can feel overwhelming, but remember — a thought is just a thought, not a fact.",
    "Try the 'notice and release' technique we discussed. How did it go last time?",
    "Progress isn't always linear. You're doing better than you think.",
    "Let's book a session to work through this together in more depth.",
  ],
  3: [
    "Hi! Glad you messaged. What's been happening with your stress levels this week?",
    "Stress is normal, but when it builds up, it needs an outlet. Have you tried the breathing exercises?",
    "That's completely understandable given what you're dealing with. You're handling it well.",
    "Small steps every day — that's what builds resilience. You're on the right track.",
    "Let me know when you'd like to book a session and we'll dive deeper.",
  ],
  4: [
    "Good to hear from you. How are you holding up?",
    "Resilience isn't about never struggling — it's about how you respond when you do. And you're responding.",
    "That takes real courage to acknowledge. I'm proud of how far you've come.",
    "Trauma responses are the nervous system protecting itself. Understanding that changes everything.",
    "Message anytime. My door — and inbox — is always open.",
  ],
};

function PsychMessagingModal({
  psych,
  messages,
  onSend,
  onClose,
}: {
  psych: typeof PSYCHOLOGISTS[0];
  messages: PsychMessage[];
  onSend: (text: string) => void;
  onClose: () => void;
}) {
  const [text, setText] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const send = () => {
    if (!text.trim()) return;
    onSend(text.trim());
    setText("");
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}>
      <motion.div initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        exit={{ y: 60, opacity: 0 }} transition={{ type: "spring", stiffness: 280, damping: 28 }}
        onClick={e => e.stopPropagation()}
        className="bg-card border border-border rounded-t-3xl sm:rounded-2xl w-full sm:max-w-md shadow-2xl flex flex-col"
        style={{ height: "min(600px, 92vh)" }}>

        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border flex-shrink-0">
          <div className="w-11 h-11 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-base font-black text-primary flex-shrink-0">
            {psych.avatar}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-foreground font-serif text-sm">{psych.name}</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <motion.div animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 2, repeat: Infinity }}
                className="w-1.5 h-1.5 rounded-full bg-green-500" />
              <span className="text-green-600 text-xs">{psych.available ? "Online" : "Offline"}</span>
              <span className="text-muted-foreground text-xs">· {psych.specialization}</span>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-muted flex items-center justify-center transition-colors flex-shrink-0">
            <X size={16} className="text-muted-foreground" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center gap-3 py-8">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center text-xl font-black text-primary">{psych.avatar}</div>
              <div>
                <p className="font-semibold text-foreground font-serif">{psych.name}</p>
                <p className="text-muted-foreground text-xs mt-1 max-w-[200px]">Send a message to start the conversation. Replies within a few hours.</p>
              </div>
            </div>
          )}
          {messages.map(msg => (
            <motion.div key={msg.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
              className={`flex gap-2.5 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
              {msg.role === "psych" && (
                <div className="w-7 h-7 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-[10px] font-black text-primary flex-shrink-0 mt-auto">
                  {psych.avatar}
                </div>
              )}
              <div className={`flex flex-col gap-1 max-w-[75%] ${msg.role === "user" ? "items-end" : "items-start"}`}>
                <div className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground rounded-tr-sm"
                    : "bg-muted text-foreground rounded-tl-sm border border-border"
                }`}>
                  {msg.text}
                </div>
                <span className="text-[10px] text-muted-foreground px-1">{msg.time}</span>
              </div>
            </motion.div>
          ))}
          <div ref={endRef} />
        </div>

        {/* Input */}
        <div className="px-4 py-3 border-t border-border flex-shrink-0">
          <div className="flex items-center gap-2 bg-background border border-border rounded-2xl px-3 py-2">
            <input value={text} onChange={e => setText(e.target.value)}
              placeholder={`Message ${psych.name}...`}
              className="flex-1 bg-transparent text-foreground placeholder-muted-foreground text-sm focus:outline-none"
              onKeyDown={e => e.key === "Enter" && !e.shiftKey && send()}
            />
            <button onClick={send}
              className={`p-2 rounded-xl transition-all ${text.trim() ? "bg-primary text-primary-foreground hover:opacity-90" : "text-muted-foreground"}`}>
              <Send size={15} />
            </button>
          </div>
          <p className="text-center text-[10px] text-muted-foreground mt-1.5">Messages are end-to-end encrypted</p>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── BOOKING MODAL ────────────────────────────────────────────────────────────
function BookingModal({
  psych,
  onConfirm,
  onClose,
}: {
  psych: typeof PSYCHOLOGISTS[0];
  onConfirm: (slot: string, notes: string, sessionType: "video" | "audio" | "chat") => void;
  onClose: () => void;
}) {
  const [selectedSlot, setSelectedSlot] = useState("");
  const [sessionType, setSessionType] = useState<"video" | "audio" | "chat">("video");
  const [notes, setNotes] = useState("");
  const [confirmed, setConfirmed] = useState(false);

  const handleConfirm = () => {
    if (!selectedSlot) return;
    setConfirmed(true);
    setTimeout(() => { onConfirm(selectedSlot, notes, sessionType); }, 1800);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      onClick={!confirmed ? onClose : undefined}>
      <motion.div initial={{ scale: 0.95, y: 16 }} animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 16 }} transition={{ type: "spring", stiffness: 300, damping: 28 }}
        onClick={e => e.stopPropagation()}
        className="bg-card border border-border rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">

        <AnimatePresence mode="wait">
          {!confirmed ? (
            <motion.div key="form" initial={{ opacity: 1 }} exit={{ opacity: 0 }} className="p-5 space-y-5">
              {/* Psych info */}
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-lg font-black text-primary flex-shrink-0">
                  {psych.avatar}
                </div>
                <div>
                  <p className="font-bold text-foreground font-serif">{psych.name}</p>
                  <p className="text-muted-foreground text-xs">{psych.specialization}</p>
                </div>
                <button onClick={onClose} className="ml-auto w-7 h-7 rounded-full hover:bg-muted flex items-center justify-center">
                  <X size={14} className="text-muted-foreground" />
                </button>
              </div>

              {/* Session type */}
              <div className="space-y-2">
                <p className="text-sm font-semibold text-foreground">Session type</p>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { id: "video", label: "Video", icon: "📹" },
                    { id: "audio", label: "Voice", icon: "🎙️" },
                    { id: "chat", label: "Chat", icon: "💬" },
                  ] as const).map(t => (
                    <button key={t.id} onClick={() => setSessionType(t.id)}
                      className={`py-3 rounded-xl border-2 flex flex-col items-center gap-1 transition-all ${sessionType === t.id ? "border-primary bg-primary/8" : "border-border bg-background hover:border-primary/30"}`}>
                      <span className="text-lg">{t.icon}</span>
                      <span className={`text-xs font-semibold ${sessionType === t.id ? "text-primary" : "text-muted-foreground"}`}>{t.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Slot picker */}
              <div className="space-y-2">
                <p className="text-sm font-semibold text-foreground">Pick a slot</p>
                <div className="grid grid-cols-2 gap-2">
                  {SCHEDULE_SLOTS.map(slot => (
                    <button key={slot} onClick={() => setSelectedSlot(slot)}
                      className={`py-2.5 px-3 rounded-xl border-2 text-left transition-all ${selectedSlot === slot ? "border-primary bg-primary/8" : "border-border bg-background hover:border-primary/30"}`}>
                      <p className={`text-xs font-semibold ${selectedSlot === slot ? "text-primary" : "text-foreground"}`}>
                        {slot.split(" ").slice(0, 1).join(" ")}
                      </p>
                      <p className={`text-[11px] ${selectedSlot === slot ? "text-primary/70" : "text-muted-foreground"}`}>
                        {slot.split(" ").slice(1).join(" ")}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <p className="text-sm font-semibold text-foreground">Notes for the session <span className="text-muted-foreground font-normal">(optional)</span></p>
                <textarea value={notes} onChange={e => setNotes(e.target.value)}
                  rows={2} placeholder="What would you like to talk about? e.g. exam anxiety, sleep issues..."
                  className="w-full bg-background border border-border rounded-xl px-3 py-2.5 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none" />
              </div>

              <button onClick={handleConfirm} disabled={!selectedSlot}
                className={`w-full py-3.5 rounded-xl font-semibold text-sm transition-all ${selectedSlot ? "bg-primary text-primary-foreground hover:opacity-90 shadow-lg shadow-primary/20" : "bg-muted text-muted-foreground cursor-not-allowed"}`}>
                {selectedSlot ? `Confirm — ${selectedSlot}` : "Select a slot to continue"}
              </button>
            </motion.div>
          ) : (
            <motion.div key="confirmed" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
              className="p-8 flex flex-col items-center text-center gap-4">
              <motion.div animate={{ scale: [1, 1.2, 1], rotate: [0, 10, -10, 0] }}
                transition={{ duration: 0.6 }} className="text-5xl">🎉</motion.div>
              <div className="space-y-1">
                <h3 className="text-xl font-black font-serif text-foreground">Session Booked!</h3>
                <p className="text-muted-foreground text-sm">You're confirmed with <span className="font-semibold text-foreground">{psych.name}</span></p>
              </div>
              <div className="w-full bg-primary/8 border border-primary/20 rounded-xl p-4 space-y-2 text-left">
                <div className="flex items-center gap-2 text-sm">
                  <Calendar size={14} className="text-primary flex-shrink-0" />
                  <span className="font-semibold text-foreground">{selectedSlot}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-base">{sessionType === "video" ? "📹" : sessionType === "audio" ? "🎙️" : "💬"}</span>
                  <span className="text-muted-foreground capitalize">{sessionType} session</span>
                </div>
                {notes && (
                  <div className="text-xs text-muted-foreground border-t border-border/50 pt-2 mt-2">"{notes}"</div>
                )}
              </div>
              <p className="text-xs text-muted-foreground">A reminder will be sent 30 minutes before your session.</p>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}

// ─── PSYCH TAB ───────────────────────────────────────────────────────────────
function PsychTab() {
  const [showCall, setShowCall] = useState(false);
  const [callPsych, setCallPsych] = useState<typeof PSYCHOLOGISTS[0] | null>(null);
  const [msgPsych, setMsgPsych] = useState<typeof PSYCHOLOGISTS[0] | null>(null);
  const [bookPsych, setBookPsych] = useState<typeof PSYCHOLOGISTS[0] | null>(null);
  const { user, psychMessages, addPsychMessage, psychBookings, setPsychBooking, removePsychBooking } = useStore();

  const getTime = () => new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const sendMessage = (pid: number, text: string) => {
    addPsychMessage(pid, { id: Date.now(), role: "student", text, time: getTime() });
  };

  const handleBook = (slot: string, notes: string, sessionType: "video" | "audio" | "chat") => {
    if (!bookPsych) return;
    setPsychBooking(bookPsych.id, { slot, notes, sessionType });
    setTimeout(() => setBookPsych(null), 2200);
  };

  const getBooking = (pid: number) => psychBookings[pid] ?? null;
  const getMessages = (pid: number): PsychMessage[] =>
    (psychMessages[pid] || []).map(m => ({ ...m, role: m.role === "student" ? "user" : "psych" } as PsychMessage));

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-black font-serif text-foreground">Talk to a Psychologist</h2>
        <p className="text-muted-foreground text-sm mt-1">Connect directly with a licensed mental health professional</p>
      </div>

      {/* Emergency banner */}
      <div className="bg-destructive/8 border border-destructive/25 rounded-xl p-4 flex items-center gap-3">
        <AlertTriangle size={20} className="text-destructive flex-shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-destructive">In crisis? Get immediate help</p>
          <p className="text-xs text-muted-foreground">iCall: 9152987821 · Vandrevala Foundation: 1860-2662-345</p>
        </div>
        <button className="px-4 py-2 rounded-xl bg-destructive text-white text-xs font-semibold hover:opacity-90 transition-opacity">Call Now</button>
      </div>

      {/* Psychologist cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {PSYCHOLOGISTS.map(p => {
          const booking = getBooking(p.id);
          const msgs = getMessages(p.id);
          const unread = msgs.filter(m => m.role === "psych").length;
          return (
            <motion.div key={p.id} whileHover={{ y: -2 }}
              className="bg-card border border-border rounded-2xl p-5 space-y-4">
              <div className="flex items-start gap-4">
                <div className="relative">
                  <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-xl font-black text-primary flex-shrink-0">
                    {p.avatar}
                  </div>
                  {unread > 0 && (
                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-primary rounded-full flex items-center justify-center">
                      <span className="text-[9px] text-primary-foreground font-bold">{unread}</span>
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-foreground font-serif">{p.name}</h3>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${p.available ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"}`}>
                      {p.available ? "Available" : "Busy"}
                    </span>
                  </div>
                  <p className="text-muted-foreground text-sm">{p.specialization}</p>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Star size={11} className="text-amber-500" /> {p.rating}</span>
                    <span>{p.sessions} sessions</span>
                  </div>
                  <div className="flex gap-1 mt-1.5 flex-wrap">
                    {p.languages.map(l => <span key={l} className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{l}</span>)}
                  </div>
                </div>
              </div>

              {/* Booking confirmation badge */}
              {booking && (
                <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-3 bg-primary/5 border border-primary/20 rounded-xl px-3 py-2.5">
                  <CheckCircle size={15} className="text-primary flex-shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-foreground">Session booked</p>
                    <p className="text-[10px] text-muted-foreground">{booking.slot}</p>
                  </div>
                  <button onClick={() => removePsychBooking(p.id)}
                    className="ml-auto text-muted-foreground hover:text-foreground">
                    <X size={12} />
                  </button>
                </motion.div>
              )}

              <div className="flex gap-2">
                <button onClick={() => { setCallPsych(p); setShowCall(true); }}
                  disabled={!p.available}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold transition-all ${p.available ? "bg-primary text-primary-foreground hover:opacity-90" : "bg-muted text-muted-foreground cursor-not-allowed"}`}>
                  <Phone size={13} /> Call Now
                </button>
                <button onClick={() => setBookPsych(p)}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border text-xs font-semibold transition-all ${booking ? "border-primary/30 bg-primary/5 text-primary" : "border-border text-foreground hover:bg-muted/50"}`}>
                  <Calendar size={13} /> {booking ? "Rebook" : "Book Session"}
                </button>
                <button onClick={() => setMsgPsych(p)}
                  className="relative px-3 py-2.5 rounded-xl border border-border text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">
                  <MessageCircle size={14} />
                  {unread > 0 && (
                    <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-primary rounded-full" />
                  )}
                </button>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Messaging modal */}
      <AnimatePresence>
        {msgPsych && (
          <PsychMessagingModal
            psych={msgPsych}
            messages={getMessages(msgPsych.id)}
            onSend={(text) => sendMessage(msgPsych.id, text)}
            onClose={() => setMsgPsych(null)}
          />
        )}
      </AnimatePresence>

      {/* Booking modal */}
      <AnimatePresence>
        {bookPsych && (
          <BookingModal
            psych={bookPsych}
            onConfirm={handleBook}
            onClose={() => setBookPsych(null)}
          />
        )}
      </AnimatePresence>

      {/* Call UI */}
      <AnimatePresence>
        {showCall && callPsych && (
          <CallUI type="psychologist" psychName={callPsych.name.replace("Dr. ", "")} onEnd={() => { setShowCall(false); setCallPsych(null); }} />
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── ANALYTICS TAB ───────────────────────────────────────────────────────────
function AnalyticsTab() {
  const { completedQuests, user } = useStore();
  const pieData = [
    { name: "Completed", value: completedQuests.length, color: "#3A7A52" },
    { name: "Remaining", value: QUESTS.length - completedQuests.length, color: "#E8E4DC" },
  ];
  const sessionData = [
    { day: "Mon", sessions: 2 }, { day: "Tue", sessions: 3 }, { day: "Wed", sessions: 1 },
    { day: "Thu", sessions: 4 }, { day: "Fri", sessions: 2 }, { day: "Sat", sessions: 5 }, { day: "Sun", sessions: 3 },
  ];
  const emotionData = [
    { name: "Calm", value: 35 }, { name: "Anxious", value: 25 }, { name: "Focused", value: 20 },
    { name: "Tired", value: 12 }, { name: "Happy", value: 8 },
  ];

  return (
    <div className="p-6 space-y-6">
      <h2 className="text-2xl font-black font-serif text-foreground">Your Analytics</h2>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Wellness Score", value: "72", unit: "/100", icon: TrendingUp, color: "text-primary" },
          { label: "Total Sessions", value: `${user?.sessions || 12}`, unit: "", icon: MessageCircle, color: "text-blue-500" },
          { label: "Quests Done", value: `${completedQuests.length}`, unit: `/${QUESTS.length}`, icon: Target, color: "text-amber-500" },
          { label: "Current Streak", value: `${user?.streak || 7}`, unit: "d", icon: Flame, color: "text-orange-500" },
        ].map(stat => (
          <div key={stat.label} className="bg-card border border-border rounded-2xl p-4">
            <div className="flex items-center justify-between mb-2">
              <stat.icon size={18} className={stat.color} />
            </div>
            <div className="flex items-end gap-1">
              <span className={`text-3xl font-black ${stat.color}`}>{stat.value}</span>
              <span className="text-muted-foreground text-sm mb-0.5">{stat.unit}</span>
            </div>
            <p className="text-muted-foreground text-xs mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Charts grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Mood trend */}
        <div className="bg-card border border-border rounded-2xl p-5">
          <h3 className="font-bold text-foreground mb-4 font-serif">7-Day Mood Tracker</h3>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={MOOD_DATA}>
              <XAxis dataKey="day" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis hide />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 11 }} />
              <Line type="monotone" dataKey="score" stroke="#3A7A52" strokeWidth={2.5} dot={{ fill: "#3A7A52", r: 4 }} name="Mood" />
              <Line type="monotone" dataKey="anxiety" stroke="#EF4444" strokeWidth={2} dot={false} strokeDasharray="4 2" name="Anxiety" />
              <Line type="monotone" dataKey="focus" stroke="#F59E0B" strokeWidth={2} dot={false} strokeDasharray="4 2" name="Focus" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Session frequency */}
        <div className="bg-card border border-border rounded-2xl p-5">
          <h3 className="font-bold text-foreground mb-4 font-serif">Session Frequency</h3>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={sessionData}>
              <XAxis dataKey="day" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis hide />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 11 }} />
              <Bar dataKey="sessions" fill="#3A7A52" radius={[4, 4, 0, 0]} name="Sessions" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Quest completion donut */}
        <div className="bg-card border border-border rounded-2xl p-5">
          <h3 className="font-bold text-foreground mb-4 font-serif">Quest Completion</h3>
          <div className="flex items-center gap-6">
            <ResponsiveContainer width={120} height={120}>
              <PieChart>
                <Pie data={pieData} cx={55} cy={55} innerRadius={35} outerRadius={55} dataKey="value" startAngle={90} endAngle={-270}>
                  {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-3 flex-1">
              {pieData.map(item => (
                <div key={item.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: item.color }} />
                    <span className="text-xs text-muted-foreground">{item.name}</span>
                  </div>
                  <span className="text-xs font-bold text-foreground">{item.value}</span>
                </div>
              ))}
              <p className="text-xs text-muted-foreground">{Math.round((completedQuests.length / QUESTS.length) * 100)}% completion rate</p>
            </div>
          </div>
        </div>

        {/* Top emotions */}
        <div className="bg-card border border-border rounded-2xl p-5">
          <h3 className="font-bold text-foreground mb-4 font-serif">Top Emotions Detected</h3>
          <div className="space-y-3">
            {emotionData.map(e => (
              <div key={e.name}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-foreground font-medium">{e.name}</span>
                  <span className="text-muted-foreground">{e.value}%</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <motion.div className="h-full bg-primary rounded-full"
                    initial={{ width: 0 }} animate={{ width: `${e.value}%` }}
                    transition={{ duration: 0.8, delay: emotionData.indexOf(e) * 0.1 }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── SETTINGS TAB ────────────────────────────────────────────────────────────
function SettingsTab() {
  const { settings, updateSettings, companion, setCompanion } = useStore();
  const [saved, setSaved] = useState(false);

  const save = () => { setSaved(true); setTimeout(() => setSaved(false), 2000); };

  const Toggle = ({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) => (
    <button onClick={() => onChange(!value)}
      className={`w-11 h-6 rounded-full relative transition-all flex-shrink-0 ${value ? "bg-primary" : "bg-muted"}`}>
      <motion.div animate={{ x: value ? 23 : 2 }} className="absolute top-1 w-4 h-4 bg-white rounded-full shadow" />
    </button>
  );

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      <div className="px-5 py-3 border-b border-border bg-muted/30">
        <h3 className="font-bold text-foreground text-sm font-serif">{title}</h3>
      </div>
      <div className="divide-y divide-border">{children}</div>
    </div>
  );

  const Row = ({ label, sub, children }: { label: string; sub?: string; children: React.ReactNode }) => (
    <div className="flex items-center justify-between px-5 py-3.5">
      <div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </div>
      {children}
    </div>
  );

  return (
    <div className="p-6 space-y-5 max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-black font-serif text-foreground">Settings</h2>
        {saved && (
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
            className="flex items-center gap-1.5 text-sm text-green-700 bg-green-100 px-3 py-1.5 rounded-full">
            <CheckCircle size={14} /> Saved
          </motion.div>
        )}
      </div>

      {/* AI Companion */}
      <Section title="AI Companion">
        <Row label="Companion Name" sub="What your AI is called">
          <input value={companion?.name || "Asha"} onChange={e => companion && setCompanion({ ...companion, name: e.target.value })}
            className="w-32 text-right text-sm bg-transparent border-b border-border focus:outline-none focus:border-primary text-foreground" />
        </Row>
        <Row label="Language Mode">
          <select value={companion?.language || "hinglish"} onChange={e => companion && setCompanion({ ...companion, language: e.target.value as any })}
            className="text-sm bg-background border border-border rounded-lg px-2 py-1 text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40">
            <option value="hinglish">Hinglish</option>
            <option value="english">English</option>
            <option value="hindi">Hindi</option>
          </select>
        </Row>
        <Row label="Voice Style">
          <select value={companion?.voiceStyle || "Calm"} onChange={e => companion && setCompanion({ ...companion, voiceStyle: e.target.value })}
            className="text-sm bg-background border border-border rounded-lg px-2 py-1 text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40">
            {["Calm", "Energetic", "Warm", "Witty"].map(v => <option key={v}>{v}</option>)}
          </select>
        </Row>
      </Section>

      {/* Notifications */}
      <Section title="Notifications">
        <Row label="Push Notifications" sub="Daily reminders and alerts">
          <Toggle value={settings.notifications} onChange={v => updateSettings({ notifications: v })} />
        </Row>
        <Row label="Daily Reminder" sub="Morning check-in nudge">
          <input type="time" value={settings.dailyReminder} onChange={e => updateSettings({ dailyReminder: e.target.value })}
            className="text-sm bg-background border border-border rounded-lg px-2 py-1 text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40" />
        </Row>
        <Row label="Weekly Report" sub="Summary of your progress">
          <Toggle value={settings.weeklyReport} onChange={v => updateSettings({ weeklyReport: v })} />
        </Row>
      </Section>

      {/* Privacy */}
      <Section title="Privacy & Security">
        <Row label="Data Sharing" sub="Share anonymized data to improve AI">
          <Toggle value={settings.dataSharing} onChange={v => updateSettings({ dataSharing: v })} />
        </Row>
        <Row label="Analytics" sub="Collect usage analytics">
          <Toggle value={settings.analytics} onChange={v => updateSettings({ analytics: v })} />
        </Row>
        <Row label="Session Recording" sub="Record sessions for review">
          <Toggle value={settings.sessionRecording} onChange={v => updateSettings({ sessionRecording: v })} />
        </Row>
      </Section>

      {/* App Preferences */}
      <Section title="App Preferences">
        <Row label="Font Size">
          <select value={settings.fontSize} onChange={e => updateSettings({ fontSize: e.target.value as any })}
            className="text-sm bg-background border border-border rounded-lg px-2 py-1 text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40">
            <option value="small">Small</option>
            <option value="medium">Medium</option>
            <option value="large">Large</option>
          </select>
        </Row>
      </Section>

      {/* Support */}
      <Section title="Support">
        {[{ label: "FAQ", sub: "Common questions answered" },
          { label: "Contact Support", sub: "Get help from our team" },
          { label: "Emergency Resources", sub: "Crisis helplines and support" }].map(item => (
          <Row key={item.label} label={item.label} sub={item.sub}>
            <ChevronRight size={16} className="text-muted-foreground" />
          </Row>
        ))}
      </Section>

      <button onClick={save} className="w-full py-3.5 rounded-2xl bg-primary text-primary-foreground font-semibold hover:opacity-90 transition-opacity shadow-lg shadow-primary/20">
        Save All Settings
      </button>
    </div>
  );
}
