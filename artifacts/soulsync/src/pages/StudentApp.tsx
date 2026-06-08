import { useState, useRef, useEffect } from "react";
import { fetchGeminiDirect } from "@/lib/gemini";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageCircle, Target, BookOpen, UserCheck, BarChart2, Settings as SettingsIcon,
  Send, Mic, MicOff, Eye, Phone, Video, ChevronRight, Flame, Star, X,
  Play, Pause, CheckCircle, Clock, Trophy, TrendingUp, Bell, Lock, Volume2,
  LogOut, Sliders, RefreshCw, ChevronDown, ChevronUp, Shield, AlertTriangle,
  Calendar, ArrowRight, MoreVertical, Sparkles, Loader2, PhoneOff, Camera
} from "lucide-react";
import { AnimeAvatar } from "@/components/AnimeAvatar";
import { MusicPlayer } from "@/components/MusicPlayer";
import { CallUI } from "@/components/CallUI";
import { LiveCallModal } from "@/components/LiveCallModal";
import { AntigravityCanvas } from "@/components/AntigravityCanvas";
import { useStore } from "@/lib/store";
import { useRegisterSocket } from "@/hooks/useSocket";
import { useStudentCall } from "@/hooks/useStudentCall";
import type { Socket } from "socket.io-client";
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
  { id: "scan", label: "Vibe Check", icon: Camera },
  { id: "psych", label: "Talk to Psychologist", icon: UserCheck },
  { id: "analytics", label: "Analytics", icon: BarChart2 },
  { id: "settings", label: "Settings", icon: SettingsIcon },
];

export function StudentApp({ onLogout }: { onLogout: () => void }) {
  const [tab, setTab] = useState("chat");
  const { user, companion, completedQuests, settings } = useStore();
  const socket = useRegisterSocket("user", user?.name || "Anonymous");
  const [playingCourse, setPlayingCourse] = useState<typeof COURSES[0] | null>(null);

  return (
    <div className="flex h-screen overflow-hidden bg-background relative z-10">
      {(settings.theme === "antigravity" || settings.theme === "cyberpunk" || settings.theme === "dark-death" || settings.theme === "netflix" || settings.theme === "beige-forest" || settings.theme === "butterfly") && <AntigravityCanvas />}
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
            {tab === "learn" && <LearnTab playing={playingCourse} setPlaying={setPlayingCourse} />}
            {tab === "scan" && <ScanTab setTab={setTab} setPlayingCourse={setPlayingCourse} />}
            {tab === "psych" && <PsychTab socket={socket} />}
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
    { id: 1, role: "ai", text: "Heyy! Good morning ☀️ Aaj uthne ke baad kaisa feel hua pehle? Seedha bol, koi judgment nahi.", time: "9:41", speaking: false },
    { id: 2, role: "user", text: "Thoda heavy feel ho raha tha. Kal raat fir neend nahi aayi properly", time: "9:42" },
    { id: 3, role: "ai", text: "Yeh teen din ho gaye jab se tumne mujhe neend ki baat boli hai. Main genuinely concerned hoon 💙 Kya bathroom break ke bina puri raat jaag rahe ho?", time: "9:43", speaking: false },
    { id: 4, role: "user", text: "Haan yaar. Raat 2 baje tak phone dekhta rehta hoon aur fir anxiety ho jaati hai ki kal ki class miss ho jaayegi", time: "9:44" },
    { id: 5, role: "ai", text: "Okay ye ek classic loop hai — anxiety → phone → aur zyada anxiety. Ek chota experiment try karein aaj raat? Phone ko 9:30 PM ke baad dusre room mein rakh do. Seedha try karo, kal mujhe batana kaisa raha 🌙", time: "9:45", speaking: false },
    { id: 6, role: "user", text: "Sach mein koshish karunga. Lekin Asha, aaj Physics ka test hai aur maine sirf ek chapter padha hai", time: "9:47" },
    { id: 7, role: "ai", text: "Deep breath pehle — seriously, ek second ke liye bas apne haath dekho 🌬️ Ek chapter yaad hai matlab foundation hai. Abhi bata — kaunsa topic sab se zyada shaky lagta hai?", time: "9:48", speaking: false },
    { id: 8, role: "user", text: "Haan please! Aur mere haath kaamp rahe hain anxiety se", time: "9:49" },
    { id: 9, role: "ai", text: "Yaar, haath kaanpna matlab body ne adrenaline release kiya — yahi woh energy hai jo actually focus dilaati hai ✨ Abhi sirf ek kaam karo: paani piyo, ek deep breath lo, aur mujhe batao kaunsa topic confident lagta hai.", time: "9:49", speaking: false },
    { id: 10, role: "user", text: "Thermodynamics ke laws yaad hain mujhe. Numericals thode weak hain", time: "9:51" },
    { id: 11, role: "ai", text: "Perfect — laws solid hain matlab tumhara core strong hai 💪 Do key formulas ek khaali page pe likh lo abhi, bas recall ke liye. Test ke baad zaroor batana kaisa gaya — main yahan hoon.", time: "9:52", speaking: false },
    { id: 12, role: "user", text: "Thank you Asha. Pata nahi tumse baat kiye bina kya karta main", time: "9:53" },
    { id: 13, role: "ai", text: "Sach kahu toh — ye strength tumhare andar thi, main sirf mirror hoon 🌸 Ab jao, conquer karo. Aur seriously — test ke baad update dena, I mean it 🔥", time: "9:53", speaking: false },
    { id: 14, role: "ai", text: "Haan yaar, main bilkul sun rahi hoon. Aaj kaisa feel ho raha hai — honestly? 😊", time: "10:02", speaking: false },
    { id: 15, role: "user", text: "Bahut overwhelmed hoon. Exams ke wajah se neend nahi aa rahi", time: "10:03" },
    { id: 16, role: "ai", text: "Ye sunke dil thoda heavy ho gaya — lekin ye feelings bilkul valid hain, body ka response hai overload ka ✨ Ek kaam karte hain abhi: 4 counts breathe in, 6 counts breathe out. Kya tum try kar sakte ho mere saath?", time: "10:03", speaking: false },
  ]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [recording, setRecording] = useState(false);
  const [showCall, setShowCall] = useState(false);
  const [callType, setCallType] = useState<"ai-voice" | "ai-video" | "psychologist">("ai-voice");
  const [showVision, setShowVision] = useState(false);
  const [visionResult, setVisionResult] = useState<any>(null);
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [overrideMsg, setOverrideMsg] = useState("");
  const [overrideSent, setOverrideSent] = useState(false);
  const [showCustomizer, setShowCustomizer] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const cName = companion?.name || "Asha";

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, typing]);

  const getTime = () => new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const [isStreaming, setIsStreaming] = useState(false);

  const send = async () => {
    if (!input.trim() || isStreaming) return;
    const text = input.trim();
    setInput("");
    setTyping(true);
    setIsStreaming(true);

    const userMsg = { id: Date.now(), role: "user", text, time: getTime() };
    setMessages(p => [...p, userMsg]);

    const history = messages.slice(-14).map(m => ({
      role: (m.role === "user" ? "user" : "assistant") as "user" | "assistant",
      content: m.text,
    }));
    history.push({ role: "user", content: text });

    const aiMsgId = Date.now() + 1;

    try {
      // Add realistic typing delay so Asha feels natural
      const delay = 900 + Math.random() * 800;
      await new Promise(res => setTimeout(res, delay));

      const reply = await fetchGeminiDirect(history);

      setTyping(false);
      setMessages(p => [...p, { id: aiMsgId, role: "ai", text: "", time: getTime(), speaking: false }]);

      // Simulate typewriter effect for local responses
      let displayed = "";
      const words = reply.split(" ");
      for (const word of words) {
        displayed += (displayed ? " " : "") + word;
        setMessages(p => p.map(m => m.id === aiMsgId ? { ...m, text: displayed } : m));
        await new Promise(res => setTimeout(res, 28 + Math.random() * 22));
      }
    } catch {
      setTyping(false);
      setMessages(p => [...p, {
        id: aiMsgId, role: "ai", speaking: false, time: getTime(),
        text: "Yaar, ek second — dobara try karo! 🙏",
      }]);
    } finally {
      setIsStreaming(false);
    }
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
          <button onClick={() => { setCallType("ai-voice"); setShowCall(true); }} className="p-2 rounded-xl hover:bg-muted transition-colors text-muted-foreground hover:text-foreground" title="AI Voice Call">
            <Phone size={16} />
          </button>
          <button onClick={() => { setCallType("ai-video"); setShowCall(true); }} className="p-2 rounded-xl hover:bg-muted transition-colors text-muted-foreground hover:text-foreground" title="AI Video Call">
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
  const levelXP = user?.xp || 0;

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
function LearnTab({ playing, setPlaying }: { playing: typeof COURSES[0] | null; setPlaying: (c: typeof COURSES[0] | null) => void }) {
  const [elapsed, setElapsed] = useState(0);
  const [activeCategory, setActiveCategory] = useState("All");
  const [showIntro, setShowIntro] = useState(false);
  const { companion } = useStore();

  const featured = COURSES.find(c => c.featured) || COURSES[0];

  useEffect(() => {
    let introTimer: any;
    if (playing) {
      setShowIntro(true);
      introTimer = setTimeout(() => {
        setShowIntro(false);
      }, 2800);
    }
    return () => {
      if (introTimer) clearTimeout(introTimer);
    };
  }, [playing]);

  useEffect(() => {
    if (!playing || showIntro) {
      setElapsed(0);
      return;
    }
    const timer = setInterval(() => {
      setElapsed(e => e + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [playing, showIntro]);

  const categories = ["All", "ADHD", "OCD", "Anxiety", "Focus", "Grounding", "Wellness"];

  const filteredCourses = activeCategory === "All" 
    ? COURSES 
    : COURSES.filter(c => c.category === activeCategory);

  const rows = activeCategory === "All" ? [
    { label: "Recommended for You", courses: COURSES.slice(0, 5) },
    { label: "ADHD & Focus Series", courses: COURSES.filter(c => ["ADHD", "Focus"].includes(c.category)) },
    { label: "Anxiety Toolkit", courses: COURSES.filter(c => c.category === "Anxiety") },
    { label: "Wellness Essentials", courses: COURSES.filter(c => ["Wellness", "Grounding", "EQ"].includes(c.category)) },
  ] : [
    { label: `${activeCategory} Series`, courses: filteredCourses }
  ];

  const getCompanionCommentary = (courseId: number, seconds: number) => {
    const cName = companion?.name || "Asha";
    if (courseId === 1) { // Defeating Academic Burnout
      if (seconds < 2) return "";
      if (seconds >= 2 && seconds < 10) return `Heyy! Ye series kafi important hai, ${cName} is watching it with you. 👀`;
      if (seconds >= 10 && seconds < 22) return `Academic burnout is real, exams and placement expectations can block your mind.`;
      if (seconds >= 22 && seconds < 35) return `Ruko, pause lo aur points note karo — we will try one technique today, ok? 📝`;
      if (seconds >= 35 && seconds < 50) return `Remember, marks are just numbers, they don't define who you are.`;
      return `Aap kaisa feel kar rahe ho video dekhne ke baad? Share karo. 💬`;
    }
    if (courseId === 2) { // Anxiety & Grounding
      if (seconds < 2) return "";
      if (seconds >= 2 && seconds < 10) return `Lambi saans lo. Let's learn these grounding tools together. 🌬️`;
      if (seconds >= 10 && seconds < 22) return `5-4-3-2-1 technique is excellent when anxiety hits.`;
      if (seconds >= 22 && seconds < 35) return `Notice the things around you — chest heavy feel ho toh count down starts.`;
      return `Kya hum abhi ye breathing exercise try karein? Haan na? 🌬️`;
    }
    // Default fallback
    if (seconds < 2) return "";
    if (seconds >= 2 && seconds < 12) return `Interesting topic, right? Main poori tarah yahan hoon tumhare sath. 🍿`;
    if (seconds >= 12 && seconds < 25) return `Suno, is concept ko apply karke dekho hostel life mein.`;
    return `Let's discuss this once the video completes, theek hai? 💬`;
  };

  const currentCommentary = playing ? getCompanionCommentary(playing.id, elapsed) : "";

  if (playing) {
    const ytId = (playing as any).youtubeId;
    return (
      <div className="h-full flex flex-col bg-background">
        {/* Video area */}
        <div className="flex-1 relative bg-black flex items-center justify-center overflow-hidden">
          <AnimatePresence>
            {showIntro && (
              <motion.div
                initial={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4 }}
                className="absolute inset-0 bg-black flex flex-col items-center justify-center z-50 select-none"
              >
                {/* Netflix-style zoom-in SoulSync letter S logo */}
                <motion.div
                  initial={{ scale: 0.3, opacity: 0, textShadow: "0 0 0px rgba(220, 38, 38, 0)" }}
                  animate={{ scale: [0.3, 1, 1.05], opacity: 1, textShadow: "0 0 35px rgba(220, 38, 38, 0.95)" }}
                  transition={{ duration: 2.2, times: [0, 0.5, 1], ease: "easeOut" }}
                  className="text-8xl sm:text-9xl font-black text-red-600 font-serif relative tracking-tighter"
                >
                  S
                  {/* Neon laser sweep bar */}
                  <motion.div
                    initial={{ left: "-15%", opacity: 0 }}
                    animate={{ left: ["-15%", "115%"], opacity: [0, 1, 1, 0] }}
                    transition={{ duration: 1.8, delay: 0.3, ease: "easeInOut" }}
                    className="absolute top-0 bottom-0 w-1.5 bg-gradient-to-b from-transparent via-red-400 to-transparent shadow-[0_0_20px_rgba(239,68,68,0.9)]"
                  />
                </motion.div>
                
                {/* spaced out presents tag */}
                <motion.p
                  initial={{ opacity: 0, letterSpacing: "0.2em" }}
                  animate={{ opacity: [0, 0, 0.75], letterSpacing: "0.45em" }}
                  transition={{ duration: 2.2, times: [0, 0.4, 1] }}
                  className="text-[9px] sm:text-[10px] text-white/55 font-bold uppercase mt-6 tracking-widest font-sans"
                >
                  A SOULSYNC ORIGINAL
                </motion.p>

                {/* Tu-dum audio cue visual representation */}
                <motion.p
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: [0, 0.65, 0] }}
                  transition={{ duration: 1.6, delay: 0.1 }}
                  className="text-[10px] text-red-500/60 font-mono mt-3"
                >
                  * Tu-dum... 🎵 *
                </motion.p>
              </motion.div>
            )}
          </AnimatePresence>

          {ytId ? (
            <iframe
              key={ytId}
              src={`https://www.youtube-nocookie.com/embed/${ytId}?autoplay=1&modestbranding=1&rel=0&color=white`}
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              style={{ border: "none", minHeight: 360 }}
            />
          ) : (
            <div className={`w-full max-w-2xl aspect-video rounded-xl bg-gradient-to-br ${playing.gradient} flex items-center justify-center`}>
              <div className="text-center text-white space-y-2">
                <p className="text-xs opacity-60 uppercase tracking-widest">Episode 1</p>
                <p className="text-2xl font-black font-serif">{playing.ep1}</p>
              </div>
            </div>
          )}
          {/* AI companion corner overlay */}
          <AnimatePresence>
            {currentCommentary && (
              <motion.div initial={{ opacity: 0, scale: 0.8, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.8 }}
                className="absolute bottom-6 right-6 flex items-end gap-3 pointer-events-none z-10 max-w-xs">
                <div className="bg-card/90 border border-primary/20 backdrop-blur-md rounded-2xl px-4 py-3 shadow-2xl text-left text-foreground">
                  <p className="text-[10px] font-bold text-primary uppercase tracking-wider">{companion?.name || "Asha"}</p>
                  <p className="text-xs leading-normal mt-1">"{currentCommentary}"</p>
                </div>
                <div className="flex-shrink-0 bg-background/80 border border-border/40 p-1 rounded-2xl backdrop-blur-sm shadow-xl">
                  <AnimeAvatar size={44} style={companion?.appearance as any || "soft-pastel"} gender={companion?.gender || "female"} speaking />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        {/* Controls bar */}
        <div className="bg-card px-6 py-4 flex items-center justify-between border-t border-border flex-shrink-0">
          <div>
            <p className="font-bold text-sm text-foreground font-serif">{playing.ep1}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{playing.title} · Episode 1 of {playing.episodes} · {elapsed}s elapsed</p>
          </div>
          <button onClick={() => setPlaying(null)}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-opacity">
            <X size={13} /> Exit Player
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background min-h-full text-foreground pb-12">
      {/* Featured hero (Netflix SpotLight) */}
      <div className="relative overflow-hidden aspect-[21/9] sm:aspect-[2.39/1] min-h-[300px] flex items-center p-8 sm:p-12">
        {/* Cinematic Backdrop Gradient */}
        <div className={`absolute inset-0 bg-gradient-to-br ${featured.gradient} opacity-20 blur-2xl scale-110`} />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/30 to-transparent" />

        <div className="relative max-w-xl space-y-4 z-10">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 bg-primary text-primary-foreground rounded-full">POPULAR</span>
            <span className="text-xs text-primary font-bold">{featured.category}</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-black font-serif text-foreground leading-tight drop-shadow-md">{featured.title}</h2>
          <p className="text-foreground/70 text-xs sm:text-sm leading-relaxed line-clamp-3 max-w-md">{featured.desc}</p>
          <div className="flex items-center gap-3 pt-2">
            <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
              onClick={() => setPlaying(featured)}
              className="flex items-center gap-2 bg-foreground text-background font-black px-6 py-3.5 rounded-xl text-xs hover:opacity-90 transition-opacity cursor-pointer shadow-lg shadow-black/20">
              <Play size={14} className="fill-background text-background" /> PLAY NOW
            </motion.button>
            <span className="text-xs text-muted-foreground font-semibold">{featured.episodes} Episodes · {featured.duration}</span>
          </div>
        </div>
      </div>

      {/* Netflix Categories Slider */}
      <div className="px-6 sm:px-8 -mt-4 mb-6">
        <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-border" style={{ scrollbarWidth: "none" }}>
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all border ${
                activeCategory === cat
                  ? "bg-primary border-primary text-primary-foreground"
                  : "bg-muted/10 border-border text-muted-foreground hover:text-foreground hover:border-border/60"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Rows */}
      <div className="px-6 sm:px-8 space-y-8 relative z-10">
        {rows.map(row => (
          <div key={row.label} className="space-y-3">
            <h3 className="text-foreground font-black text-sm tracking-wider uppercase font-serif">{row.label}</h3>
            <div className="flex gap-4 overflow-x-auto pb-4 pt-1" style={{ scrollbarWidth: "none" }}>
              {row.courses.map(course => (
                <motion.button key={course.id} whileHover={{ scale: 1.05, y: -4 }} whileTap={{ scale: 0.98 }}
                  onClick={() => setPlaying(course)}
                  className="flex-shrink-0 w-48 rounded-2xl overflow-hidden cursor-pointer group shadow-xl bg-card border border-border text-left transition-all">

                  {/* Thumbnail */}
                  <div className={`relative bg-gradient-to-br ${course.gradient} aspect-[16/10] flex flex-col items-center justify-center overflow-hidden`}>
                    <div className="absolute inset-0 bg-black/10" />

                    {/* Emoji big */}
                    <motion.div
                      animate={{ y: [0, -3, 0] }}
                      transition={{ duration: 3, repeat: Infinity, delay: course.id * 0.2 }}
                      className="text-4xl drop-shadow-xl z-10 select-none">
                      {course.emoji}
                    </motion.div>

                    {/* Badges */}
                    <div className="absolute top-2 left-2 flex gap-1 z-10">
                      <span className="text-[8px] font-black px-1.5 py-0.5 bg-black/60 text-white rounded-md backdrop-blur-sm uppercase tracking-wider">{course.category}</span>
                    </div>

                    {/* Play icon overlay */}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity duration-200">
                      <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-lg transform scale-90 group-hover:scale-100 transition-transform">
                        <Play size={14} className="text-black ml-0.5 fill-black" />
                      </div>
                    </div>
                  </div>

                  {/* Info strip */}
                  <div className="p-3.5 space-y-1">
                    <p className="text-foreground text-xs font-black leading-tight line-clamp-1 group-hover:text-primary transition-colors">{course.title}</p>
                    <div className="flex items-center justify-between text-[9px] text-muted-foreground">
                      <span>{course.episodes} Episodes</span>
                      <span className="text-primary font-bold">{course.matchScore}% Match</span>
                    </div>
                    {/* Fake progress bar */}
                    <div className="w-full h-1 bg-muted rounded-full overflow-hidden mt-2">
                      <div className="h-full bg-primary" style={{ width: course.id === 1 ? "35%" : course.id === 2 ? "12%" : "0%" }} />
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

// ─── VIBE CHECK & HUMOR ANALYZER TAB ─────────────────────────────────────────
interface ScanTabProps {
  setTab: (t: string) => void;
  setPlayingCourse: (c: typeof COURSES[0] | null) => void;
}

function ScanTab({ setTab, setPlayingCourse }: ScanTabProps) {
  const { companion } = useStore();
  const [activeSubTab, setActiveSubTab] = useState<"vibe" | "humor">("vibe");
  
  // Camera & scan state
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanStepText, setScanStepText] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  // Vibe Result state
  const [detectedEmotion, setDetectedEmotion] = useState<"Stressed" | "Joyful" | "Focused" | "Exhausted" | null>(null);
  const [expressionDialogue, setExpressionDialogue] = useState("");
  const [vibeScanCount, setVibeScanCount] = useState(0);
  
  // Humor Quiz state
  const [quizQuestionIdx, setQuizQuestionIdx] = useState(0);
  const [quizAnswers, setQuizAnswers] = useState<string[]>([]);
  const [quizCompleted, setQuizCompleted] = useState(false);

  // Humor Result state
  const [humorArchetype, setHumorArchetype] = useState("");
  const [humorScores, setHumorScores] = useState<{ witty: number; dry: number; relatable: number } | null>(null);
  const [isGeneratingJoke, setIsGeneratingJoke] = useState(false);
  const [jokeStreamedText, setJokeStreamedText] = useState("");
  const [selectedMedia, setSelectedMedia] = useState<any>(null);

  const humorQuestions = [
    {
      text: "Professor is delivering a super boring lecture. What is your go-to move?",
      options: [
        { label: "Make aggressive eye contact with my best friend to suppress a laugh.", value: "witty" },
        { label: "Quietly accept my fate and sleep on the last bench.", value: "deadpan" },
        { label: "Whisper a terrible subject-related pun to anyone nearby.", value: "dry" }
      ]
    },
    {
      text: "The hostel mess serves paneer that is practically rubber. Your reaction?",
      options: [
        { label: "Post a review: '5-star rubber manufacturing unit, highly recommended!'", value: "witty" },
        { label: "Eat it in absolute silence, dead inside, counting days to semester end.", value: "deadpan" },
        { label: "Joke that the paneer is trying to 'stretch' our dental capacity.", value: "dry" }
      ]
    },
    {
      text: "You have a major semester test tomorrow and know absolutely nothing. How do you cope?",
      options: [
        { label: "Calculate my backup career plans as a professional tea vendor.", value: "witty" },
        { label: "Shrug, close the book, and start playing valorant/BGMI.", value: "deadpan" },
        { label: "Say 'Kal se pakka padhunga' out loud for the 100th time today.", value: "dry" }
      ]
    },
    {
      text: "Your crush replies with just a 'K'. What's your immediate brain response?",
      options: [
        { label: "Draft a text to potassium, thanking them for the scientific chemistry.", value: "witty" },
        { label: "Assume my entire lineage has been rejected, close the chat forever.", value: "deadpan" },
        { label: "Reply with 'L-M-N-O-P' to teach them the alphabet.", value: "dry" }
      ]
    },
    {
      text: "Your group project partner hasn't contributed a single slide. What do you do?",
      options: [
        { label: "Put their name under the 'Special thanks to moral support' section.", value: "witty" },
        { label: "Do the entire slide deck alone, crying in my pillow later.", value: "deadpan" },
        { label: "Joke that they are the 'hidden variable' of the project.", value: "dry" }
      ]
    },
    {
      text: "You are caught by the warden bringing an electric kettle inside your hostel room. What's your excuse?",
      options: [
        { label: "Sir, this is a scientific steam inhaler for my chronic congestion.", value: "witty" },
        { label: "Accept the fine, unplug it, and ask if they want some Maggi.", value: "deadpan" },
        { label: "It's just water, sir. Water isn't illegal yet.", value: "dry" }
      ]
    },
    {
      text: "Your phone battery is at 1% and you are in the middle of a gossipy call. What do you do?",
      options: [
        { label: "Give a fast dramatic summary: 'If I don't survive, tell mom I loved the tea!'", value: "witty" },
        { label: "Let it die. It was getting boring anyway.", value: "deadpan" },
        { label: "Say '1% left. We are down to the molecular level now.'", value: "dry" }
      ]
    },
    {
      text: "You accidentally wave back at someone who was actually waving at the person behind you. How do you recover?",
      options: [
        { label: "Pretend I was stretching my hand to check the wind direction.", value: "witty" },
        { label: "Keep my hand raised, walk past them, and wave at the sky.", value: "deadpan" },
        { label: "Wink at them to make it 10x more awkward.", value: "dry" }
      ]
    },
    {
      text: "The professor asks a question and looks directly at you. You have no clue. Your tactic?",
      options: [
        { label: "Nod sagely, stroke my chin, and say 'That depends on the perspective, sir.'", value: "witty" },
        { label: "Look behind me to check who they are actually pointing at.", value: "deadpan" },
        { label: "Cough violently to trigger a health-related exit.", value: "dry" }
      ]
    },
    {
      text: "You wake up at 7:58 AM for an 8:00 AM presentation. What's the plan?",
      options: [
        { label: "Run in pyjamas, call it 'A realistic presentation on student stress simulation.'", value: "witty" },
        { label: "Go back to sleep. There is always the next semester.", value: "deadpan" },
        { label: "Join online on my phone, put a static picture of me nodding.", value: "dry" }
      ]
    }
  ];

  const handleAnswer = (value: string) => {
    const nextAnswers = [...quizAnswers, value];
    setQuizAnswers(nextAnswers);
    if (quizQuestionIdx < humorQuestions.length - 1) {
      setQuizQuestionIdx(prev => prev + 1);
    } else {
      setQuizCompleted(true);
    }
  };

  const handleResetQuiz = () => {
    setQuizQuestionIdx(0);
    setQuizAnswers([]);
    setQuizCompleted(false);
    setHumorArchetype("");
    setHumorScores(null);
    setJokeStreamedText("");
    setSelectedMedia(null);
  };
  
  const startCamera = async () => {
    setCameraError(false);
    setCameraActive(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setCameraActive(true);
    } catch (err) {
      console.error("Camera access error:", err);
      setCameraError(true);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  };

  useEffect(() => {
    if (activeSubTab === "vibe") {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [activeSubTab]);

  // Handle Scanning for Vibe
  const handleVibeScan = () => {
    if (scanning) return;
    setScanning(true);
    setScanProgress(0);
    setDetectedEmotion(null);
    setExpressionDialogue("");
    
    const steps = [
      "Initializing camera feed...",
      "Detecting facial outlines...",
      "Mapping 68 facial landmark coordinates...",
      "Analyzing micro-expressions...",
      "Mapping mood metrics to Asha's empathy core..."
    ];
    
    let currentStep = 0;
    const interval = setInterval(() => {
      setScanProgress(prev => {
        const next = prev + 5;
        if (next >= 100) {
          clearInterval(interval);
          finishVibeScan();
          return 100;
        }
        // Update helper text at intervals
        const stepIdx = Math.floor((next / 100) * steps.length);
        if (stepIdx !== currentStep && stepIdx < steps.length) {
          currentStep = stepIdx;
          setScanStepText(steps[stepIdx]);
        }
        return next;
      });
    }, 150);
    setScanStepText(steps[0]);
  };

  const finishVibeScan = () => {
    setScanning(false);
    setVibeScanCount(prev => prev + 1);
    
    // Choose emotion based on index or randomness
    const emotions: Array<"Stressed" | "Joyful" | "Focused" | "Exhausted"> = ["Stressed", "Joyful", "Focused", "Exhausted"];
    const chosen = emotions[Math.floor(Math.random() * emotions.length)];
    setDetectedEmotion(chosen);
    
    const cName = companion?.name || "Asha";
    let text = "";
    if (chosen === "Stressed") {
      text = `Aap thode stressed lag rahe ho, your brow is slightly tense. 😟 Par chinta mat karo! Take a deep breath with me right now. Let's practice some grounding tools together to calm down. Breathe in, breathe out... 🌬️`;
    } else if (chosen === "Joyful") {
      text = `Waah! Kya kamaal ki smile hai teri! Mujhko toh dekhte hi positive vibes aa gayi! 😄 Nazar na lage! Keep smiling like this, okay? Let's fuel this positive energy! ✨`;
    } else if (chosen === "Focused") {
      text = `Oho! Full concentration mode! Eyes steady aur dimaag bilkul razor sharp lag raha hai! 🎯 You are doing great. Keep up this flow, focus tootne mat dena! 🚀`;
    } else {
      text = `Aankhein thodi heavy aur tired lag rahi hain. Lagta hai raat bhar scroll kiya ya assignment likha? 😴 Break banta hai boss. Ek coffee break lo aur thodi der screen se door raho. ☕`;
    }
    setExpressionDialogue(text);
  };

  // Recommendations mapping based on vibe
  const getVibeRecommendations = (emotion: string) => {
    if (emotion === "Stressed") {
      return COURSES.filter(c => ["Anxiety", "Grounding"].includes(c.category)).slice(0, 2);
    } else if (emotion === "Joyful") {
      return COURSES.filter(c => ["Wellness", "Focus"].includes(c.category)).slice(0, 2);
    } else if (emotion === "Focused") {
      return COURSES.filter(c => ["Focus", "ADHD"].includes(c.category)).slice(0, 2);
    } else {
      return COURSES.filter(c => ["Wellness", "Grounding", "Breathing"].includes(c.category)).slice(0, 2);
    }
  };

  // Handle Scanning for Humor
  const handleHumorScan = () => {
    if (scanning || !quizCompleted) return;
    setScanning(true);
    setScanProgress(0);
    setHumorArchetype("");
    setHumorScores(null);
    
    const steps = [
      "Compiling quiz responses...",
      "Calibrating sarcasm coefficient...",
      "Measuring deadpan index...",
      "Correlating hostel mess paneer ratings...",
      "Finalizing humor quotient..."
    ];
    
    let currentStep = 0;
    const interval = setInterval(() => {
      setScanProgress(prev => {
        const next = prev + 5;
        if (next >= 100) {
          clearInterval(interval);
          finishHumorScan();
          return 100;
        }
        const stepIdx = Math.floor((next / 100) * steps.length);
        if (stepIdx !== currentStep && stepIdx < steps.length) {
          currentStep = stepIdx;
          setScanStepText(steps[stepIdx]);
        }
        return next;
      });
    }, 150);
    setScanStepText(steps[0]);
  };

  const finishHumorScan = () => {
    setScanning(false);
    
    // Count user's preferences from quiz
    const counts = quizAnswers.reduce((acc, val) => {
      acc[val] = (acc[val] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const wittyCount = counts["witty"] || 0;
    const deadpanCount = counts["deadpan"] || 0;
    const dryCount = counts["dry"] || 0;

    let arch = "Deadpan Relatable Cynic";
    if (wittyCount >= deadpanCount && wittyCount >= dryCount) {
      arch = "Sarcastic Hostel Philosopher";
    } else if (dryCount >= wittyCount && dryCount >= deadpanCount) {
      arch = "Dad Jokes Specialist";
    }

    setHumorArchetype(arch);

    // Compute scores based on selection counts
    const wittyBase = 45 + wittyCount * 12 + Math.floor(Math.random() * 8);
    const dryBase = 40 + dryCount * 14 + Math.floor(Math.random() * 8);
    const relatableBase = 50 + deadpanCount * 10 + Math.floor(Math.random() * 8);

    setHumorScores({
      witty: Math.min(wittyBase, 100),
      dry: Math.min(dryBase, 100),
      relatable: Math.min(relatableBase, 100)
    });
  };

  // Real-time joke generator with streaming letters matching the archetype
  const generateJoke = () => {
    if (isGeneratingJoke) return;
    setIsGeneratingJoke(true);
    setJokeStreamedText("");
    
    let jokes = [
      "Engineering student ka dimaag aur hostel ka geyser... dono tabhi kaam karte hain jab deadline sar par ho! 😂",
      "GPA is temporary, but 'Kal se pakka padhunga' is permanent! 📈",
      "Life of a college student: 8:00 AM class, 7:59 AM alarm, 8:45 AM breakfast in hostel room, 10:00 AM sleep again."
    ];

    if (humorArchetype === "Sarcastic Hostel Philosopher") {
      jokes = [
        "Engineering student ka dimaag aur hostel ka geyser... dono tabhi kaam karte hain jab deadline sar par ho! 😂",
        "Wi-Fi chalta hai toh assignment nahi hota, aur jab assignment likhna ho toh Wi-Fi 'No Internet Access' dikhata hai! 💻",
        "Prof: 'Please don't discuss in class.' Me and my friend: *Using high-level telepathy and aggressive eye contact to mock the lecture* 👀"
      ];
    } else if (humorArchetype === "Dad Jokes Specialist") {
      jokes = [
        "Hostel mess mein paneer ki sabji dhoondna... is like code mein semi-colon dhoondna. Milta hi nahi! 🍛",
        "GPA is temporary, but 'Kal se pakka padhunga' is permanent! 📈",
        "Mess cook: 'Paneer kaisa laga?' Student: 'Bahut paneer-dar tha, isme paneer dhoondne mein darta raha.' 😅"
      ];
    } else if (humorArchetype === "Deadpan Relatable Cynic") {
      jokes = [
        "Beta, agar semester exams ke pehle neend aa rahi hai, toh samajh lo tumhara syllabus se koi lena-dena nahi hai! 😴",
        "VIVA Examiner: 'Tell me something about yourself.' Me: 'Sir, please ask syllabus questions, personal life is even more blank.' 😭",
        "Life of a college student: 8:00 AM class, 7:59 AM alarm, 8:45 AM breakfast in hostel room, 10:00 AM sleep again."
      ];
    }
    
    const randomJoke = jokes[Math.floor(Math.random() * jokes.length)];
    const cName = companion?.name || "Asha";
    const prefix = `${cName} says: "`;
    const fullJoke = `${prefix}${randomJoke}"`;
    
    let currentIdx = 0;
    const typingTimer = setInterval(() => {
      setJokeStreamedText(prev => prev + fullJoke[currentIdx]);
      currentIdx++;
      if (currentIdx >= fullJoke.length) {
        clearInterval(typingTimer);
        setIsGeneratingJoke(false);
      }
    }, 30);
  };

  const handlePlayCourse = (course: typeof COURSES[0]) => {
    setPlayingCourse(course);
    setTab("learn");
  };

  // Recommended courses based on Humor Archetype
  const getHumorRecommendations = (arch: string) => {
    if (arch === "Sarcastic Hostel Philosopher") {
      return COURSES.filter(c => ["ADHD", "Focus", "Wellness"].includes(c.category)).slice(0, 2);
    } else if (arch === "Dad Jokes Specialist") {
      return COURSES.filter(c => ["Focus", "Wellness", "Breathing"].includes(c.category)).slice(0, 2);
    } else { // Deadpan Relatable Cynic
      return COURSES.filter(c => ["Anxiety", "Grounding", "Wellness"].includes(c.category)).slice(0, 2);
    }
  };

  // College memes filtered by archetype
  const getCollegeMemes = (arch: string) => {
    if (arch === "Sarcastic Hostel Philosopher") {
      return [
        { title: "Attendance Issues", text: "Me calculate kar raha hoon ki kitne aur lectures bunk karne par attendance exact 75.01% bachegi. 🧮" },
        { title: "Sleepless Nights", text: "When you study for 5 minutes and reward yourself with a 2-hour scroll session." }
      ];
    } else if (arch === "Dad Jokes Specialist") {
      return [
        { title: "Hostel Life", text: "Kal raat 2 baje 10 logon ne mil kar 2 Maggi packets banayi. Life's peak chef moment. 🍜" },
        { title: "Mess Food", text: "Hostel mess food has two states: 1. Garam & Bekaar. 2. Thanda & Bekaar." }
      ];
    } else { // Deadpan Relatable Cynic
      return [
        { title: "Exam Prep", text: "Group study matlab 5% padhai, 45% backchodi aur 50% calculating minimum pass marks. 📚" },
        { title: "Lecture Logic", text: "Prof: 'Please don't discuss in class.' Me and my friend: *Using high-level telepathy and aggressive eye contact to mock the lecture* 👀" }
      ];
    }
  };

  const getHumorMedia = (arch: string) => {
    if (arch === "Sarcastic Hostel Philosopher") {
      return [
        { type: "reddit", title: "r/engineeringmemes - compilations", sub: "14.2k upvotes", desc: "Compilation of professor lecturing vs students playing high-stakes Chrome Dino. Click to play edit.", icon: "🎥" },
        { type: "picture", title: "Placement Cell vs Reality", sub: "Meme Picture", desc: "Expectation: 25 LPA package. Reality: 2.5 LPA package but free biscuits in canteen.", icon: "🖼️" },
        { type: "video", title: "Hostel Warden Anger Compilation", sub: "Vibe Edit", desc: "A cinematic TikTok edit of warden shouting about electric kettles with heavy bass music in background.", icon: "⚡" }
      ];
    } else if (arch === "Dad Jokes Specialist") {
      return [
        { type: "reddit", title: "r/dadjokes - college edition", sub: "8.5k upvotes", desc: "Why did the textbook go to the doctor? Because it lost its table of contents! (Self-Destruct in 3s)", icon: "🎥" },
        { type: "picture", title: "Semi-Colon Hunt", sub: "Meme Picture", desc: "A pictures of a programmer crying in front of 1000 lines of code, caption says: 'I found 99 problems but a semi-colon resolved them all.'", icon: "🖼️" },
        { type: "video", title: "Lofi Puns To Fail Exams To", sub: "Reddit Edit", desc: "A compilation of terrible puns read in a relaxing lofi background voice.", icon: "🎵" }
      ];
    } else { // Deadpan Relatable Cynic
      return [
        { type: "reddit", title: "r/me_irl - semester end", sub: "22k upvotes", desc: "Reddit compilation: My GPA is declining faster than my interest in this degree. Relatable cynicism edits.", icon: "🎥" },
        { type: "picture", title: "Sleep Schedule Graph", sub: "Meme Picture", desc: "X-axis: exam week. Y-axis: hours of sleep. Graph line goes straight through the basement.", icon: "🖼️" },
        { type: "video", title: "5 Minutes of Silence for My GPA", sub: "Video Edit", desc: "A mock video compilation showing students looking into space blankly during exams.", icon: "🎬" }
      ];
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6 text-foreground">
      {/* Tab Switcher */}
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div>
          <h2 className="text-2xl font-black font-serif flex items-center gap-2">
            <Camera className="text-primary" /> Vibe Check
          </h2>
          <p className="text-xs text-muted-foreground font-sans">Scan your face to check your mood or humor quotient.</p>
        </div>
        <div className="flex bg-muted rounded-xl p-1 border border-border">
          <button
            onClick={() => setActiveSubTab("vibe")}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${activeSubTab === "vibe" ? "bg-background shadow text-primary" : "text-muted-foreground"}`}
          >
            Mood Scan
          </button>
          <button
            onClick={() => setActiveSubTab("humor")}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${activeSubTab === "humor" ? "bg-background shadow text-primary" : "text-muted-foreground"}`}
          >
            Humor Analyzer
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left Column: Camera Viewport */}
        <div className="flex flex-col space-y-4">
          <div className="relative aspect-video bg-black rounded-3xl border border-primary/20 overflow-hidden shadow-2xl group flex items-center justify-center">
            {activeSubTab === "vibe" ? (
              cameraActive && !cameraError ? (
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover scale-x-[-1]"
                />
              ) : (
                <div className="text-center p-6 space-y-3">
                  <div className="w-16 h-16 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto text-primary animate-pulse">
                    <Camera size={28} />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {cameraError ? "Camera access denied or unavailable. Using simulated avatar feed." : "Accessing camera..."}
                  </p>
                  {cameraError && (
                    <button onClick={startCamera} className="text-xs px-3 py-1.5 bg-primary text-primary-foreground rounded-lg font-semibold hover:opacity-90 cursor-pointer">
                      Retry Permission
                    </button>
                  )}
                </div>
              )
            ) : (
              <div className="text-center p-6 space-y-4 w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-primary/10 via-background to-primary/5">
                <div className="absolute inset-0 grid opacity-10" style={{ backgroundImage: "linear-gradient(hsl(145 33% 40%) 1px, transparent 1px), linear-gradient(90deg, hsl(145 33% 40%) 1px, transparent 1px)", backgroundSize: "20px 20px" }} />
                <motion.div 
                  animate={{ 
                    scale: scanning ? [1, 1.05, 1] : 1,
                    rotate: scanning ? [0, 5, -5, 0] : 0 
                  }} 
                  transition={{ duration: 2, repeat: Infinity }}
                  className="relative z-10"
                >
                  <AnimeAvatar 
                    size={80} 
                    style={companion?.appearance as any || "soft-pastel"} 
                    gender={companion?.gender || "female"} 
                    speaking={scanning}
                  />
                </motion.div>
                <div className="space-y-1.5 z-10 max-w-[80%]">
                  <p className="text-xs font-black text-primary font-serif">{companion?.name || "Asha"}'s Brainwave Scanner</p>
                  <p className="text-[10px] text-muted-foreground leading-normal font-sans">
                    {scanning 
                      ? "Calibrating humor metrics against your answers..." 
                      : !quizCompleted 
                      ? "Awaiting quiz responses. I'll read your style directly from your choices! 🧠" 
                      : "Quiz responses logged! Press the button below to generate your scorecard."}
                  </p>
                </div>
              </div>
            )}

            {/* Target Brackets Bounding Box */}
            {activeSubTab === "vibe" && (
              <div className="absolute inset-8 border-2 border-dashed border-white/20 rounded-2xl pointer-events-none flex items-center justify-center">
                <span className="text-[10px] text-white/40 uppercase tracking-widest absolute top-2 font-mono">Face Target</span>
                {/* Corner brackets */}
                <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-primary" />
                <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-primary" />
                <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-primary" />
                <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-primary" />
              </div>
            )}

            {/* Green Laser Sweep Line */}
            {scanning && (
              <motion.div
                initial={{ top: "0%" }}
                animate={{ top: ["0%", "100%", "0%"] }}
                transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                className="absolute left-0 right-0 h-0.5 bg-green-400 shadow-[0_0_15px_#4ade80] z-20 pointer-events-none"
              />
            )}

            {/* Scanning Overlay State */}
            {scanning && (
              <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px] flex flex-col items-center justify-center space-y-2 text-white">
                <Loader2 className="animate-spin text-green-400" size={32} />
                <p className="text-sm font-semibold tracking-wide drop-shadow font-sans">{scanStepText}</p>
                <div className="w-48 h-1.5 bg-white/20 rounded-full overflow-hidden">
                  <div className="h-full bg-green-400 animate-pulse" style={{ width: `${scanProgress}%` }} />
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-2">
            {activeSubTab === "vibe" ? (
              <button
                onClick={handleVibeScan}
                disabled={scanning}
                className="flex-1 py-3 bg-primary text-primary-foreground rounded-2xl font-bold hover:opacity-95 transition-opacity shadow-lg shadow-primary/20 disabled:opacity-50 cursor-pointer text-xs uppercase tracking-wider font-sans"
              >
                {scanning ? "Scanning Vibe..." : "Scan My Vibe"}
              </button>
            ) : (
              <button
                onClick={handleHumorScan}
                disabled={scanning || !quizCompleted}
                className="flex-1 py-3 bg-primary text-primary-foreground rounded-2xl font-bold hover:opacity-95 transition-opacity shadow-lg shadow-primary/20 disabled:opacity-50 cursor-pointer text-xs uppercase tracking-wider font-sans"
              >
                {scanning ? "Analyzing Humor..." : !quizCompleted ? "Answer Quiz First" : "Analyze My Humor"}
              </button>
            )}
          </div>
        </div>

        {/* Right Column: Dynamic Results & Quiz Questionnaire */}
        <div className="flex flex-col">
          {activeSubTab === "vibe" ? (
            <div className="flex-1 bg-card border border-border rounded-3xl p-5 flex flex-col justify-between min-h-[300px]">
              {detectedEmotion ? (
                <div className="space-y-4 flex-1">
                  {/* Emotion badge */}
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold tracking-widest bg-primary/10 text-primary px-3 py-1 rounded-full uppercase font-mono">
                      Detected Vibe: {detectedEmotion}
                    </span>
                    <span className="text-xs text-muted-foreground font-sans">Scan #{vibeScanCount}</span>
                  </div>

                  {/* Empathy dialogue container */}
                  <div className="flex gap-3 bg-muted/40 border border-border/60 rounded-2xl p-4">
                    <div className="flex-shrink-0 mt-0.5">
                      <AnimeAvatar size={40} style={companion?.appearance as any || "soft-pastel"} gender={companion?.gender || "female"} />
                    </div>
                    <div className="space-y-1 min-w-0">
                      <p className="text-xs font-bold text-primary font-serif">{companion?.name || "Asha"}</p>
                      <p className="text-xs leading-normal text-foreground/90 font-sans">{expressionDialogue}</p>
                    </div>
                  </div>

                  {/* Recommendations */}
                  <div className="space-y-3">
                    <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground font-serif">Recommended for your mood:</h4>
                    <div className="grid grid-cols-1 gap-2">
                      {getVibeRecommendations(detectedEmotion).map(course => (
                        <button
                          key={course.id}
                          onClick={() => handlePlayCourse(course)}
                          className="flex items-center gap-3 p-2.5 rounded-xl border border-border hover:border-primary/30 bg-muted/20 hover:bg-primary/5 transition-all text-left group cursor-pointer"
                        >
                          <span className="text-2xl">{course.emoji}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-foreground truncate group-hover:text-primary transition-colors font-serif">{course.title}</p>
                            <p className="text-[10px] text-muted-foreground truncate font-sans">{course.desc}</p>
                          </div>
                          <ChevronRight size={14} className="text-muted-foreground group-hover:text-primary transition-colors" />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-6 space-y-2">
                  <div className="text-4xl">🧘</div>
                  <h3 className="font-bold text-foreground font-serif">Aap Kaisa Feel Kar Rahe Ho?</h3>
                  <p className="text-xs text-muted-foreground max-w-xs leading-normal font-sans">
                    Click the scan button to let Asha capture your micro-expressions and recommend tailored wellness exercises.
                  </p>
                </div>
              )}
            </div>
          ) : (
            /* Humor subtab */
            <div className="flex-1 flex flex-col min-h-[300px]">
              {!quizCompleted ? (
                /* Interactive Questionnaire */
                <div className="flex-1 bg-card border border-border rounded-3xl p-5 flex flex-col justify-between">
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-bold tracking-widest bg-primary/10 text-primary px-3 py-1 rounded-full uppercase font-mono">
                        Humor Quiz: Question {quizQuestionIdx + 1}/{humorQuestions.length}
                      </span>
                      <span className="text-xs text-muted-foreground">{quizQuestionIdx + 1} of {humorQuestions.length}</span>
                    </div>
                    <h3 className="text-sm font-bold text-foreground font-serif leading-snug">
                      {humorQuestions[quizQuestionIdx].text}
                    </h3>
                    <div className="flex flex-col gap-2 pt-2">
                      {humorQuestions[quizQuestionIdx].options.map((opt, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleAnswer(opt.value)}
                          className="w-full text-left p-3 rounded-xl border border-border hover:border-primary/40 bg-muted/10 hover:bg-primary/5 transition-all text-xs font-sans text-foreground/80 hover:text-foreground cursor-pointer"
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="text-[10px] text-muted-foreground text-center pt-2">
                    Answer these questions to calibrate Asha's humor analysis parameters!
                  </div>
                </div>
              ) : (
                /* Quiz Completed: Show scan prompt or result */
                <div className="flex-1 bg-card border border-border rounded-3xl p-5 flex flex-col justify-between">
                  {humorArchetype ? (
                    <div className="space-y-4 flex-1">
                      {/* Archetype display */}
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <span className="text-[9px] font-bold tracking-widest bg-primary/10 text-primary px-2.5 py-0.5 rounded-full uppercase font-mono">
                            Humor Archetype
                          </span>
                          <h3 className="text-base font-black text-foreground font-serif">{humorArchetype}</h3>
                        </div>
                        <button
                          onClick={handleResetQuiz}
                          className="text-[9px] text-primary hover:underline font-bold cursor-pointer"
                        >
                          Reset Quiz
                        </button>
                      </div>

                      {/* Scorecard */}
                      {humorScores && (
                        <div className="grid grid-cols-3 gap-2 bg-muted/30 border border-border/50 p-2.5 rounded-2xl text-center">
                          <div>
                            <p className="text-[8px] text-muted-foreground uppercase font-black font-sans">Witty & Sharp</p>
                            <p className="text-sm font-black text-primary mt-0.5 font-mono">{humorScores.witty}%</p>
                          </div>
                          <div>
                            <p className="text-[8px] text-muted-foreground uppercase font-black font-sans">Dry Puns</p>
                            <p className="text-sm font-black text-primary mt-0.5 font-mono">{humorScores.dry}%</p>
                          </div>
                          <div>
                            <p className="text-[8px] text-muted-foreground uppercase font-black font-sans">Relatability</p>
                            <p className="text-sm font-black text-primary mt-0.5 font-mono">{humorScores.relatable}%</p>
                          </div>
                        </div>
                      )}

                      {/* Real-time Joke Generator */}
                      <div className="bg-card border border-border rounded-2xl p-4 space-y-3 text-foreground">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-black uppercase tracking-wider text-primary font-serif">Real-Time Jokes</h4>
                          <button
                            onClick={generateJoke}
                            disabled={isGeneratingJoke}
                            className="text-[10px] px-2.5 py-1 bg-primary text-primary-foreground rounded-lg font-bold hover:opacity-90 disabled:opacity-50 transition-opacity cursor-pointer font-sans"
                          >
                            {isGeneratingJoke ? "Generating..." : "Generate Joke"}
                          </button>
                        </div>
                        <div className="min-h-[60px] bg-muted/40 border border-border rounded-xl p-3 flex items-center justify-center">
                          {jokeStreamedText ? (
                            <p className="text-xs leading-normal font-medium text-foreground/90 italic font-sans">{jokeStreamedText}</p>
                          ) : (
                            <p className="text-xs text-muted-foreground text-center font-sans">Click "Generate Joke" to generate a Hinglish joke streaming in real-time!</p>
                          )}
                        </div>
                      </div>

                      {/* Recommendations based on Humor */}
                      <div className="space-y-3">
                        <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground font-serif">Recommended for your style:</h4>
                        <div className="grid grid-cols-1 gap-1.5">
                          {getHumorRecommendations(humorArchetype).map(course => (
                            <button
                              key={course.id}
                              onClick={() => handlePlayCourse(course)}
                              className="flex items-center gap-3 p-2 rounded-xl border border-border hover:border-primary/30 bg-muted/20 hover:bg-primary/5 transition-all text-left group cursor-pointer"
                            >
                              <span className="text-xl">{course.emoji}</span>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold text-foreground truncate group-hover:text-primary transition-colors font-serif">{course.title}</p>
                              </div>
                              <ChevronRight size={13} className="text-muted-foreground group-hover:text-primary transition-colors" />
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Humor Edits, Meme Videos & Reddit Gallery */}
                      <div className="space-y-3">
                        <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground font-serif">Meme Edits & Reddit compilations:</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                          {getHumorMedia(humorArchetype).map((item, idx) => (
                            <button
                              key={idx}
                              onClick={() => setSelectedMedia(item)}
                              className="p-3 rounded-xl border border-border hover:border-primary/45 bg-muted/15 hover:bg-primary/5 transition-all text-left flex flex-col justify-between h-[96px] group cursor-pointer"
                            >
                              <div className="flex justify-between items-start w-full">
                                <span className="text-base">{item.icon}</span>
                                <span className="text-[8px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-mono uppercase">{item.type}</span>
                              </div>
                              <div className="min-w-0 mt-2">
                                <p className="text-[10px] font-bold text-foreground truncate group-hover:text-primary transition-colors font-serif">{item.title}</p>
                                <p className="text-[8px] text-muted-foreground truncate">{item.sub}</p>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Collage college jokes/memes */}
                      <div className="space-y-2">
                        <h4 className="text-[9px] font-black uppercase tracking-wider text-muted-foreground font-serif">Relatable College Musings</h4>
                        <div className="grid grid-cols-1 gap-2 max-h-[120px] overflow-y-auto pr-1" style={{ scrollbarWidth: "none" }}>
                          {getCollegeMemes(humorArchetype).map((meme, idx) => (
                            <div key={idx} className="p-2.5 rounded-xl border border-border/60 bg-muted/10">
                              <p className="text-[10px] font-bold text-primary font-serif">{meme.title}</p>
                              <p className="text-[10px] text-foreground/80 mt-0.5 leading-normal font-sans">{meme.text}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* Scan prompt */
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-6 space-y-3">
                      <div className="text-4xl animate-bounce">🧠</div>
                      <h3 className="font-bold text-foreground font-serif">Quiz Completed!</h3>
                      <p className="text-xs text-muted-foreground max-w-xs leading-normal font-sans">
                        Your answers are logged! Now, trigger the humor analysis to calculate your score and reveal your humor archetype!
                      </p>
                      <button
                        onClick={handleResetQuiz}
                        className="text-xs text-primary hover:underline font-bold cursor-pointer"
                      >
                        Reset & Start Over
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Selected Media Modal */}
      <AnimatePresence>
        {selectedMedia && (
          <MediaModal
            item={selectedMedia}
            onClose={() => setSelectedMedia(null)}
            companionName={companion?.name || "Asha"}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── MEDIA MODAL FOR MEMES & VIDEOS ──────────────────────────────────────────
function MediaModal({ item, onClose, companionName }: { item: any; onClose: () => void; companionName: string }) {
  const [isPlaying, setIsPlaying] = useState(true);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setProgress(p => (p >= 100 ? 0 : p + 2));
    }, 100);
    return () => clearInterval(interval);
  }, [isPlaying]);

  const getCommentary = () => {
    if (item.type === "reddit") {
      return `${companionName}: "Bhai, reddit edits are next level! 😭 Itna accurate kaise ho sakta hai? Pure relatable stress content. Padhai ke alawa sab kuch top-tier hai humara!"`;
    }
    if (item.type === "picture") {
      return `${companionName}: "Yeh meme dekh kar meri database crash hone wali thi! 😂 Placement biscuit se hi toh hostel chalta hai. Canteen wale bhaiya should be the chief placement officer!"`;
    }
    return `${companionName}: "Yeh video edit toh direct dil par laga! 💀 Warden sir/madam ke room se jo sound waves aate hain, they exceed all safety limits. Perfect bass drop!"`;
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 font-sans"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        onClick={e => e.stopPropagation()}
        className="bg-card border border-border rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xl">{item.icon}</span>
            <div>
              <h3 className="font-bold text-foreground font-serif text-sm">{item.title}</h3>
              <p className="text-[10px] text-muted-foreground uppercase font-mono">{item.type} Edit · {item.sub}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-muted flex items-center justify-center transition-colors">
            <X size={16} className="text-muted-foreground" />
          </button>
        </div>

        {/* Content Area */}
        <div className="p-6 bg-black/40 flex-1 flex flex-col items-center justify-center min-h-[260px] relative">
          {item.type === "picture" ? (
            <div className="w-full max-w-sm bg-black border border-white/10 rounded-2xl overflow-hidden shadow-xl flex flex-col items-center p-4 space-y-4">
              <div className="text-center font-bold text-sm text-white uppercase tracking-wider px-2 font-serif">
                {item.title}
              </div>
              <div className="w-full aspect-[4/3] bg-gradient-to-tr from-purple-900/30 to-pink-900/30 rounded-xl border border-white/5 flex items-center justify-center relative overflow-hidden">
                <div className="absolute inset-0 opacity-10 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-amber-500 via-red-500 to-black animate-pulse" />
                <span className="text-5xl animate-bounce">🎓🍪💼</span>
              </div>
              <div className="text-center text-xs text-white bg-red-600/25 border border-red-500/35 rounded-lg py-2 px-3 font-semibold w-full">
                "{item.desc}"
              </div>
            </div>
          ) : (
            <div className="w-full max-w-sm bg-black border border-white/10 rounded-2xl overflow-hidden shadow-xl flex flex-col">
              <div className="w-full aspect-video bg-gradient-to-br from-indigo-950/40 to-slate-950 rounded-t-xl flex flex-col items-center justify-center relative group overflow-hidden">
                <div className="absolute inset-0 flex items-center justify-center z-10">
                  {isPlaying ? (
                    <div className="flex flex-col items-center space-y-2">
                      <span className="text-4xl animate-spin text-primary">💿</span>
                      <span className="text-[10px] text-white/70 font-mono tracking-widest uppercase">Playing Edit...</span>
                    </div>
                  ) : (
                    <button onClick={() => setIsPlaying(true)} className="w-12 h-12 rounded-full bg-white/10 border border-white/20 hover:bg-white/20 flex items-center justify-center transition-colors">
                      <Play size={20} className="text-white fill-white ml-0.5" />
                    </button>
                  )}
                </div>
                <div className="absolute bottom-2 left-3 right-3 text-[10px] text-white/60 bg-black/60 backdrop-blur-sm rounded px-2 py-1 truncate z-10">
                  {item.desc}
                </div>
                {isPlaying && (
                  <div className="absolute inset-0 bg-gradient-to-t from-transparent via-purple-500/5 to-transparent pointer-events-none animate-pulse" />
                )}
              </div>
              <div className="p-3 bg-neutral-900 border-t border-white/5 space-y-2">
                <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden cursor-pointer" onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const clickX = e.clientX - rect.left;
                  setProgress(Math.floor((clickX / rect.width) * 100));
                }}>
                  <div className="h-full bg-primary" style={{ width: `${progress}%` }} />
                </div>
                <div className="flex items-center justify-between text-white">
                  <div className="flex items-center gap-3">
                    <button onClick={() => setIsPlaying(!isPlaying)} className="hover:text-primary transition-colors cursor-pointer">
                      {isPlaying ? <Pause size={14} /> : <Play size={14} />}
                    </button>
                    <span className="text-[9px] font-mono text-white/50">0:{(Math.floor(progress / 10)).toString().padStart(2, '0')} / 0:10</span>
                  </div>
                  <div className="flex items-center gap-2 text-white/50">
                    <span className="text-[9px] uppercase tracking-widest font-mono">1080p HD</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Asha's Reaction Footer */}
        <div className="p-5 border-t border-border bg-muted/20 space-y-4 flex-shrink-0">
          <div className="flex gap-3 bg-muted/60 border border-border/40 p-3.5 rounded-2xl">
            <div className="w-9 h-9 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-xs font-black text-primary flex-shrink-0 mt-0.5">
              🤖
            </div>
            <div className="space-y-0.5">
              <p className="text-[10px] font-bold text-primary font-serif">{companionName}</p>
              <p className="text-xs leading-relaxed text-foreground/90 font-sans italic">{getCommentary()}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-full py-2.5 bg-primary text-primary-foreground rounded-xl font-bold hover:opacity-90 transition-opacity text-xs cursor-pointer text-center"
          >
            Achaa, close karo!
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

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
function PsychTab({ socket }: { socket: Socket | null }) {
  const [msgPsych, setMsgPsych] = useState<typeof PSYCHOLOGISTS[0] | null>(null);
  const [bookPsych, setBookPsych] = useState<typeof PSYCHOLOGISTS[0] | null>(null);
  const { user, psychMessages, addPsychMessage, psychBookings, setPsychBooking, removePsychBooking } = useStore();

  const call = useStudentCall(socket, user?.name || "Anonymous");

  const getTime = () => new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const sendMessage = (pid: number, text: string, psychName: string) => {
    const msg = { id: Date.now(), role: "student" as const, text, time: getTime() };
    addPsychMessage(pid, msg);
    socket?.emit("dm-send", {
      toName: psychName,
      text,
      fromName: user?.name || "Anonymous",
      fromRole: "user",
    });
  };

  useEffect(() => {
    if (!socket) return;
    const handler = (dm: { id: number; fromName: string; fromRole: string; text: string; time: string }) => {
      if (dm.fromRole !== "psych") return;
      const psych = PSYCHOLOGISTS.find(p => p.name === dm.fromName);
      if (psych) {
        addPsychMessage(psych.id, { id: dm.id, role: "psych", text: dm.text, time: dm.time });
      }
    };
    socket.on("dm-receive", handler);
    return () => { socket.off("dm-receive", handler); };
  }, [socket, addPsychMessage]);

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
                <button
                  onClick={() => p.available && call.status === "idle" && call.dial(p.name)}
                  disabled={!p.available || call.status !== "idle"}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                    p.available && call.status === "idle"
                      ? "bg-primary text-primary-foreground hover:opacity-90"
                      : "bg-muted text-muted-foreground cursor-not-allowed"
                  }`}>
                  {call.status === "ringing" ? (
                    <><Loader2 size={13} className="animate-spin" /> Ringing...</>
                  ) : call.status === "connecting" || call.status === "active" ? (
                    <><Phone size={13} /> In Call</>
                  ) : (
                    <><Phone size={13} /> Call Now</>
                  )}
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
            onSend={(text) => sendMessage(msgPsych.id, text, msgPsych.name)}
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

      {/* Status toasts */}
      <AnimatePresence>
        {call.status === "ringing" && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3 rounded-2xl shadow-xl border border-primary/30 bg-card">
            <motion.div animate={{ scale: [1, 1.3, 1] }} transition={{ duration: 1, repeat: Infinity }}
              className="w-2.5 h-2.5 rounded-full bg-primary" />
            <span className="text-sm font-semibold text-foreground">Calling {call.peerName || "psychologist"}...</span>
            <button onClick={call.endCall} className="ml-2 p-1.5 rounded-xl bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors">
              <PhoneOff size={14} />
            </button>
          </motion.div>
        )}
        {call.status === "declined" && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl shadow-xl bg-destructive/10 border border-destructive/25 text-destructive text-sm font-semibold">
            Call declined — psychologist is unavailable right now
          </motion.div>
        )}
        {call.status === "no-psych" && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl shadow-xl bg-amber-50 border border-amber-200 text-amber-700 text-sm font-semibold">
            No psychologist is available right now — try again shortly
          </motion.div>
        )}
      </AnimatePresence>

      {/* Live call modal (real WebRTC) */}
      <AnimatePresence>
        {(call.status === "connecting" || call.status === "active") && (
          <LiveCallModal
            localStream={call.localStream}
            remoteStream={call.remoteStream}
            peerName={call.peerName}
            role="user"
            messages={call.messages}
            onSendMessage={call.sendMessage}
            onEnd={call.endCall}
            status={call.status}
          />
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
        <div className="px-5 py-4 space-y-3">
          <div>
            <p className="text-sm font-medium text-foreground">Color Theme</p>
            <p className="text-xs text-muted-foreground mt-0.5 font-sans">Select your visual aura. The active theme implements globally across the app.</p>
          </div>
          <div className="w-full overflow-x-auto border border-border rounded-xl bg-card">
            <table className="w-full text-left border-collapse text-[11px] font-sans">
              <thead>
                <tr className="bg-muted/40 border-b border-border font-serif">
                  <th className="p-2.5 font-black text-foreground">Theme Name</th>
                  <th className="p-2.5 font-black text-foreground">Visual Aura</th>
                  <th className="p-2.5 font-black text-foreground text-center">Swatches</th>
                  <th className="p-2.5 font-black text-foreground text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {[
                  { id: 'butterfly', name: 'Butterfly Garden', desc: 'Dreamy lilac sky with graceful fluttering butterflies & petals', colorBg: '#F0EBF9', colorAccent: '#9B4ECC' },
                  { id: 'beige-forest', name: 'Beige Forest', desc: 'Living parchment with swaying plants, fireflies & falling leaves', colorBg: '#F5EFE0', colorAccent: '#2D5A3D' },
                  { id: 'beige', name: 'Beige Classic', desc: 'Warm beige tones with comforting forest green accents', colorBg: '#FAF7F2', colorAccent: '#2D5A3D' },
                  { id: 'dark', name: 'Midnight Dark', desc: 'Sleek low-light slate theme for late-night wellness', colorBg: '#141414', colorAccent: '#ffffff' },
                  { id: 'cyberpunk', name: 'Cyberpunk Neon', desc: 'Deep purple background with neon pink & cyan digital grid', colorBg: '#0a0014', colorAccent: '#ff0099' },
                  { id: 'antigravity', name: 'Antigravity Space', desc: 'Cosmic drifting stars & gravity-defying purple nebulae', colorBg: '#080310', colorAccent: '#b366ff' },
                  { id: 'sakura', name: 'Sakura Blossom', desc: 'Soft pastel pink blossoms for a serene, calm mood', colorBg: '#fdf7f9', colorAccent: '#ff80bf' },
                  { id: 'retro', name: 'Retro Vaporwave', desc: '80s arcade feel with magenta grids & vaporwave colors', colorBg: '#050510', colorAccent: '#ff007f' },
                  { id: 'dark-death', name: 'Dark Death Gothic', desc: 'Obsidian black backdrop with rising crimson ash embers', colorBg: '#050202', colorAccent: '#ff2222' },
                  { id: 'netflix', name: 'Netflix Cinematic', desc: 'Cinematic obsidian black backdrop with signature crimson red accents', colorBg: '#0b0b0b', colorAccent: '#E50914' },
                ].map(t => {
                  const isActive = settings.theme === t.id;
                  return (
                    <tr 
                      key={t.id} 
                      onClick={() => updateSettings({ theme: t.id as any })}
                      className={`hover:bg-muted/30 transition-colors cursor-pointer ${isActive ? 'bg-primary/5 font-semibold' : ''}`}
                    >
                      <td className="p-2.5 text-foreground font-serif font-bold">{t.name}</td>
                      <td className="p-2.5 text-muted-foreground leading-normal">{t.desc}</td>
                      <td className="p-2.5 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <span className="w-3.5 h-3.5 rounded-full border border-border inline-block" style={{ backgroundColor: t.colorBg }} />
                          <span className="w-3.5 h-3.5 rounded-full border border-border inline-block" style={{ backgroundColor: t.colorAccent }} />
                        </div>
                      </td>
                      <td className="p-2.5 text-right">
                        {isActive ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-black bg-primary/20 text-primary">
                            Active
                          </span>
                        ) : (
                          <span className="text-muted-foreground hover:text-primary transition-colors text-[9px] font-bold uppercase tracking-wider">
                            Apply
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
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
