import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users, AlertTriangle, Activity, TrendingUp, BarChart2, FileText,
  Bell, Settings, LogOut, Phone, MessageCircle, Zap, ChevronRight,
  X, CheckCircle, RefreshCw, Shield, Clock, Download, Filter,
  Eye, Star, BellOff, Send, ArrowLeft, Inbox, PhoneOff, PhoneIncoming
} from "lucide-react";
import { PATIENTS, NOTIFICATIONS, REPORTS } from "@/lib/data";
import { CallUI } from "@/components/CallUI";
import { LiveCallModal } from "@/components/LiveCallModal";
import { useStore } from "@/lib/store";
import type { SharedMessage } from "@/lib/store";
import { useRegisterSocket } from "@/hooks/useSocket";
import { usePsychCall } from "@/hooks/usePsychCall";
import { ref, push, onChildAdded, off } from "firebase/database";
import { db } from "@/lib/firebase";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend
} from "recharts";

type PsychTab = "triage" | "messages" | "analytics" | "reports" | "notifications" | "settings";

export function PsychDashboard({ licenseId, onLogout }: { licenseId: string; onLogout: () => void }) {
  const [tab, setTab] = useState<PsychTab>("triage");
  const [selectedPatient, setSelectedPatient] = useState<typeof PATIENTS[0] | null>(null);
  const [notifications, setNotifications] = useState(NOTIFICATIONS);
  const { psychMessages, psychLastRead } = useStore();

  const psychCall = usePsychCall();

  const unreadCount = notifications.filter(n => !n.read).length;

  // Count unread student messages across all conversations
  const unreadMessages = Object.entries(psychMessages).reduce((total, [psychIdStr, msgs]) => {
    const psychId = Number(psychIdStr);
    const lastReadId = psychLastRead[psychId] ?? 0;
    return total + msgs.filter(m => m.role === "student" && m.id > lastReadId).length;
  }, 0);

  const NAV = [
    { id: "triage",        label: "Patient Triage",   icon: Users },
    { id: "messages",      label: "Messages",          icon: MessageCircle, badge: unreadMessages },
    { id: "analytics",     label: "Analytics",         icon: BarChart2 },
    { id: "reports",       label: "Reports",           icon: FileText },
    { id: "notifications", label: "Notifications",     icon: Bell, badge: unreadCount },
    { id: "settings",      label: "Settings",          icon: Settings },
  ] as const;

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <aside className="w-60 flex-shrink-0 bg-card border-r border-border flex flex-col">
        <div className="px-4 py-5 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
              <Shield size={18} className="text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-foreground font-bold text-sm font-serif">Clinical Portal</p>
              <p className="text-muted-foreground text-[10px] truncate">{licenseId}</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 px-3 py-3 space-y-0.5">
          {NAV.map(item => (
            <button key={item.id} onClick={() => setTab(item.id as PsychTab)}
              data-testid={`nav-psych-${item.id}`}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-sm border border-transparent ${
                tab === item.id
                  ? "bg-primary/10 text-primary border-primary/15 font-bold shadow-sm shadow-primary/5"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              }`}>
              <item.icon size={15} />
              {item.label}
              {"badge" in item && (item.badge as number) > 0 && (
                <span className="ml-auto text-[10px] bg-destructive text-white rounded-full min-w-[18px] h-[18px] flex items-center justify-center font-bold px-1">
                  {item.badge as number}
                </span>
              )}
            </button>
          ))}
        </nav>
        <button onClick={onLogout} data-testid="btn-psych-logout"
          className="flex items-center gap-3 px-4 py-3 text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-colors text-sm border-t border-border">
          <LogOut size={14} /> Logout
        </button>
      </aside>

      {/* Content */}
      <main className={`flex-1 ${tab === "messages" ? "overflow-hidden" : "overflow-y-auto"}`}>
        <AnimatePresence mode="wait">
          <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.15 }}
            className={tab === "messages" ? "h-full" : "min-h-full"}>
            {tab === "triage"        && <TriageTab selectedPatient={selectedPatient} setSelectedPatient={setSelectedPatient} />}
            {tab === "messages"      && <MessagesTab />}
            {tab === "analytics"     && <AnalyticsTab />}
            {tab === "reports"       && <ReportsTab />}
            {tab === "notifications" && <NotificationsTab notifications={notifications} setNotifications={setNotifications} />}
            {tab === "settings"      && <PsychSettingsTab licenseId={licenseId} />}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* ── Incoming call overlay (floats above everything) ── */}
      <AnimatePresence>
        {psychCall.status === "incoming" && psychCall.incoming && (
          <motion.div
            initial={{ opacity: 0, scale: 0.88, y: 30 }} animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 20 }}
            className="fixed bottom-8 right-8 z-50 w-80 rounded-3xl shadow-2xl overflow-hidden border border-white/10"
            style={{ background: "rgba(8,14,10,0.95)", backdropFilter: "blur(24px)" }}>

            {/* Top gradient strip */}
            <div className="h-1 bg-gradient-to-r from-primary via-emerald-400 to-teal-400" />

            <div className="p-5 space-y-4">
              <div className="flex items-center gap-3">
                <motion.div animate={{ scale: [1, 1.15, 1] }} transition={{ duration: 1.2, repeat: Infinity }}
                  className="w-12 h-12 rounded-2xl bg-primary/15 border border-primary/30 flex items-center justify-center flex-shrink-0">
                  <PhoneIncoming size={20} className="text-primary" />
                </motion.div>
                <div>
                  <p className="text-white font-bold text-sm">Incoming Patient Call</p>
                  <p className="text-white/50 text-xs mt-0.5">{psychCall.incoming.userName} is calling</p>
                </div>
                <motion.div className="ml-auto flex gap-1">
                  {[0, 1, 2].map(i => (
                    <motion.div key={i} className="w-1.5 h-1.5 rounded-full bg-primary"
                      animate={{ opacity: [1, 0.2, 1] }}
                      transition={{ duration: 1, repeat: Infinity, delay: i * 0.25 }} />
                  ))}
                </motion.div>
              </div>

              <div className="flex gap-2.5">
                <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.95 }}
                  onClick={() => psychCall.decline()}
                  className="flex-1 py-3 rounded-2xl border border-white/10 text-white/60 text-sm font-semibold hover:border-destructive/40 hover:text-destructive transition-all">
                  <PhoneOff size={14} className="inline mr-1.5" /> Decline
                </motion.button>
                <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.95 }}
                  onClick={() => psychCall.accept()}
                  className="flex-1 py-3 rounded-2xl text-primary-foreground text-sm font-bold bg-gradient-to-r from-primary to-primary/80 hover:opacity-95 transition-all shadow-md shadow-primary/10">
                  <Phone size={14} className="inline mr-1.5" /> Accept
                </motion.button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Live call modal ── */}
      <AnimatePresence>
        {(psychCall.status === "connecting" || psychCall.status === "active") && (
          <LiveCallModal
            localStream={psychCall.localStream}
            remoteStream={psychCall.remoteStream}
            peerName={psychCall.peerName}
            role="psych"
            messages={psychCall.messages}
            onSendMessage={(text) => psychCall.sendMessage(text, "Dr. Priya Iyer")}
            onEnd={psychCall.endCall}
            status={psychCall.status}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

type LiveDM = { id: number; fromName: string; fromRole: "user" | "psych"; text: string; time: string };

// ─── MESSAGES TAB ─────────────────────────────────────────────────────────────
function MessagesTab() {
  const { psychMessages, addPsychMessage, markPsychRead, psychLastRead } = useStore();
  const [activePsychId, setActivePsychId] = useState<number | null>(null);
  const [activeStudentName, setActiveStudentName] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [liveDMs, setLiveDMs] = useState<Record<string, LiveDM[]>>({});
  const endRef = useRef<HTMLDivElement>(null);

  const allConversations = PATIENTS.map((patient, idx) => ({
    patient,
    psychId: idx + 1,
    msgs: psychMessages[idx + 1] || [],
  }));

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [psychMessages, liveDMs, activePsychId, activeStudentName]);

  useEffect(() => {
    const dmsRef = ref(db, `dms`);
    const unsubscribe = onChildAdded(dmsRef, (snapshot) => {
      const dm = snapshot.val();
      if (dm && dm.fromRole === "user") {
        const studentName = dm.fromName;
        setLiveDMs(prev => ({
          ...prev,
          [studentName]: [...(prev[studentName] || []), dm],
        }));
      }
    });
    return () => off(ref(db, 'dms'), 'child_added', unsubscribe);
  }, []);

  const openConversation = (psychId: number, studentName?: string) => {
    setActivePsychId(psychId);
    setActiveStudentName(studentName ?? null);
    markPsychRead(psychId);
  };

  const getTime = () => new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const sendReply = () => {
    if (!input.trim()) return;
    const text = input.trim();
    setInput("");

    if (activeStudentName) {
      const myMsg: LiveDM = { id: Date.now(), fromName: "Dr. Priya Iyer", fromRole: "psych", text, time: getTime() };
      setLiveDMs(prev => ({
        ...prev,
        [activeStudentName]: [...(prev[activeStudentName] || []), myMsg],
      }));
      push(ref(db, 'dms'), {
        toName: activeStudentName,
        text,
        fromName: "Dr. Priya Iyer",
        fromRole: "psych",
        time: getTime()
      });
      return;
    }

    if (activePsychId === null) return;
    const patientForPsych = allConversations.find(c => c.psychId === activePsychId);
    addPsychMessage(activePsychId, { id: Date.now(), role: "psych", text, time: getTime() });
    if (patientForPsych) {
      push(ref(db, 'dms'), {
        toName: patientForPsych.patient.name,
        text,
        fromName: "Dr. Priya Iyer",
        fromRole: "psych",
        time: getTime()
      });
    }
  };

  const activeConvo = activePsychId !== null && !activeStudentName
    ? allConversations.find(c => c.psychId === activePsychId) ?? null
    : null;
  const activeLiveDMs = activeStudentName ? (liveDMs[activeStudentName] || []) : null;

  const getUnread = (psychId: number) => {
    const msgs = psychMessages[psychId] || [];
    const lastId = psychLastRead[psychId] ?? 0;
    return msgs.filter(m => m.role === "student" && m.id > lastId).length;
  };

  const getLastMsg = (psychId: number) => {
    const msgs = psychMessages[psychId] || [];
    return msgs[msgs.length - 1] ?? null;
  };

  const liveStudentNames = Object.keys(liveDMs);

  return (
    <div className="flex h-full">
      {/* ── Inbox list ── */}
      <div className={`flex-shrink-0 border-r border-border bg-card flex flex-col ${activePsychId !== null ? "hidden sm:flex w-72" : "flex w-full sm:w-72"}`}>
        {/* Header */}
        <div className="px-4 py-4 border-b border-border">
          <h2 className="text-lg font-black font-serif text-foreground">Patient Messages</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Direct messages from your patients</p>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-border">
          {/* Live online students (real-time DMs) */}
          {liveStudentNames.length > 0 && (
            <>
              <div className="px-4 py-2 bg-primary/5">
                <p className="text-[10px] font-bold text-primary uppercase tracking-wider flex items-center gap-1.5">
                  <motion.div className="w-1.5 h-1.5 rounded-full bg-primary" animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.5, repeat: Infinity }} />
                  Online Now
                </p>
              </div>
              {liveStudentNames.map(name => {
                const msgs = liveDMs[name] || [];
                const last = msgs[msgs.length - 1];
                const isActive = activeStudentName === name;
                return (
                  <motion.button key={`live-${name}`}
                    onClick={() => { setActiveStudentName(name); setActivePsychId(-1); markPsychRead(-1); }}
                    whileHover={{ backgroundColor: "hsl(var(--muted)/0.5)" }}
                    className={`w-full flex items-center gap-3 px-4 py-3.5 text-left transition-all ${isActive ? "bg-primary/8 border-r-2 border-primary" : ""}`}>
                    <div className="relative flex-shrink-0">
                      <div className="w-11 h-11 rounded-2xl bg-primary/10 border border-primary/30 flex items-center justify-center text-sm font-black text-primary">
                        {name.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-500 border-2 border-card" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-foreground truncate">{name}</span>
                        {last && <span className="text-[10px] text-muted-foreground">{last.time}</span>}
                      </div>
                      <p className="text-xs truncate text-foreground font-medium mt-0.5">
                        {last ? last.text : "Just connected"}
                      </p>
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-semibold">Live</span>
                    </div>
                  </motion.button>
                );
              })}
            </>
          )}

          {/* Mock patient conversations */}
          <div className="px-4 py-2 bg-muted/50">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Patient Records</p>
          </div>
          {allConversations.map(({ patient, psychId, msgs }) => {
            const last = getLastMsg(psychId);
            const unread = getUnread(psychId);
            const isActive = activePsychId === psychId && !activeStudentName;

            return (
              <motion.button key={psychId} onClick={() => { openConversation(psychId); setActiveStudentName(null); }}
                whileHover={{ backgroundColor: "hsl(var(--muted)/0.5)" }}
                className={`w-full flex items-center gap-3 px-4 py-3.5 text-left transition-all ${isActive ? "bg-primary/5 border-r-2 border-primary" : ""}`}>
                <div className="relative flex-shrink-0">
                  <div className={`w-11 h-11 rounded-2xl flex items-center justify-center text-sm font-black border ${
                    patient.status === "CRITICAL" ? "bg-destructive/10 text-destructive border-destructive/30"
                    : patient.status === "MODERATE" ? "bg-accent/10 text-accent border-accent/20"
                    : "bg-green-100 text-green-700 border-green-300"
                  }`}>
                    {patient.avatar}
                  </div>
                  {unread > 0 && (
                    <motion.span animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 1.5, repeat: Infinity }}
                      className="absolute -top-1 -right-1 w-4 h-4 bg-primary rounded-full flex items-center justify-center">
                      <span className="text-[9px] text-primary-foreground font-bold">{unread}</span>
                    </motion.span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <span className={`text-sm truncate ${unread > 0 ? "font-bold text-foreground" : "font-medium text-foreground"}`}>{patient.name}</span>
                    {last && <span className="text-[10px] text-muted-foreground flex-shrink-0">{last.time}</span>}
                  </div>
                  <p className={`text-xs truncate mt-0.5 ${unread > 0 ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                    {last ? `${last.role === "psych" ? "You: " : ""}${last.text}` : <span className="italic text-muted-foreground">No messages yet</span>}
                  </p>
                  <div className="flex items-center gap-1.5 mt-1">
                    {patient.tags.map(t => (
                      <span key={t} className="text-[9px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">{t}</span>
                    ))}
                  </div>
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* ── Live DM chat window ── */}
      {activeStudentName && activeLiveDMs !== null ? (
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex items-center gap-3 px-5 py-3 border-b border-border bg-card flex-shrink-0">
            <button onClick={() => { setActiveStudentName(null); setActivePsychId(null); }}
              className="sm:hidden p-1.5 rounded-lg hover:bg-muted transition-colors">
              <ArrowLeft size={16} className="text-muted-foreground" />
            </button>
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center text-sm font-black text-primary flex-shrink-0">
              {activeStudentName.slice(0, 2).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-bold text-foreground font-serif text-sm">{activeStudentName}</p>
                <span className="flex items-center gap-1 text-[10px] text-green-600 font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /> Online
                </span>
              </div>
              <p className="text-xs text-muted-foreground">Live session · messages are real-time</p>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            {activeLiveDMs.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center gap-3 py-12">
                <MessageCircle size={28} className="text-muted-foreground" />
                <p className="text-muted-foreground text-sm">No messages yet. Say hello!</p>
              </div>
            ) : activeLiveDMs.map(msg => (
              <motion.div key={msg.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                className={`flex gap-3 ${msg.fromRole === "psych" ? "flex-row-reverse" : ""}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0 mt-auto border ${
                  msg.fromRole === "user" ? "bg-primary/10 text-primary border-primary/20" : "bg-primary/10 text-primary border-primary/20"
                }`}>
                  {msg.fromRole === "user" ? activeStudentName.slice(0, 2).toUpperCase() : "DR"}
                </div>
                <div className={`flex flex-col gap-1 max-w-[72%] ${msg.fromRole === "psych" ? "items-end" : "items-start"}`}>
                  <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                    msg.fromRole === "psych"
                      ? "bg-primary text-primary-foreground rounded-tr-sm shadow-sm"
                      : "bg-card border border-border text-foreground rounded-tl-sm"
                  }`}>{msg.text}</div>
                  <span className="text-[10px] text-muted-foreground px-1">{msg.time}</span>
                </div>
              </motion.div>
            ))}
            <div ref={endRef} />
          </div>

          <div className="px-5 py-3 border-t border-border bg-card flex-shrink-0">
            <div className="flex items-center gap-2 bg-background border border-border rounded-2xl px-3 py-2">
              <input value={input} onChange={e => setInput(e.target.value)}
                placeholder={`Reply to ${activeStudentName}...`}
                className="flex-1 bg-transparent text-foreground placeholder-muted-foreground text-sm focus:outline-none"
                onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendReply()} />
              <motion.button onClick={sendReply} whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.93 }}
                className={`p-2 rounded-xl transition-all ${input.trim() ? "bg-primary text-primary-foreground hover:opacity-95" : "text-muted-foreground"}`}>
                <Send size={15} />
              </motion.button>
            </div>
            <p className="text-center text-[10px] text-muted-foreground mt-1.5">Messages are end-to-end encrypted · HIPAA compliant</p>
          </div>
        </div>
      ) : null}

      {/* ── Chat window ── */}
      {activePsychId !== null && !activeStudentName && activeConvo ? (
        <div className="flex-1 flex flex-col min-w-0">
          {/* Chat header */}
          <div className="flex items-center gap-3 px-5 py-3 border-b border-border bg-card flex-shrink-0">
            <button onClick={() => setActivePsychId(null)}
              className="sm:hidden p-1.5 rounded-lg hover:bg-muted transition-colors">
              <ArrowLeft size={16} className="text-muted-foreground" />
            </button>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black border flex-shrink-0 ${
              activeConvo.patient.status === "CRITICAL" ? "bg-destructive/10 text-destructive border-destructive/30"
              : activeConvo.patient.status === "MODERATE" ? "bg-accent/10 text-accent border-accent/20"
              : "bg-green-100 text-green-700 border-green-300"
            }`}>
              {activeConvo.patient.avatar}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-foreground font-serif text-sm">{activeConvo.patient.name}</p>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span>{activeConvo.patient.emotion}</span>
                <span>·</span>
                <span>{activeConvo.patient.tags.join(", ")}</span>
                <span className={`font-semibold ${
                  activeConvo.patient.riskScore > 70 ? "text-destructive"
                  : activeConvo.patient.riskScore > 50 ? "text-accent"
                  : "text-green-600"
                }`}>Risk {activeConvo.patient.riskScore}%</span>
              </div>
            </div>
            {activeConvo.patient.status === "CRITICAL" && (
              <motion.div animate={{ opacity: [1, 0.4, 1] }} transition={{ duration: 1.2, repeat: Infinity }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-destructive/10 rounded-full border border-destructive/30">
                <AlertTriangle size={12} className="text-destructive" />
                <span className="text-xs text-destructive font-bold">CRITICAL</span>
              </motion.div>
            )}
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            {activeConvo.msgs.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center gap-3 py-12">
                <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center">
                  <MessageCircle size={28} className="text-muted-foreground" />
                </div>
                <div>
                  <p className="font-semibold text-foreground font-serif">No messages yet</p>
                  <p className="text-muted-foreground text-sm mt-1">
                    {activeConvo.patient.name} hasn't sent a message yet. You can send them a check-in.
                  </p>
                </div>
              </div>
            ) : (
              activeConvo.msgs.map((msg: SharedMessage) => (
                <motion.div key={msg.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                  className={`flex gap-3 ${msg.role === "psych" ? "flex-row-reverse" : ""}`}>
                  {/* Avatar */}
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0 mt-auto border ${
                    msg.role === "student"
                      ? activeConvo.patient.status === "CRITICAL" ? "bg-destructive/10 text-destructive border-destructive/30"
                        : "bg-accent/10 text-accent border-accent/20"
                      : "bg-primary/10 text-primary border-primary/20"
                  }`}>
                    {msg.role === "student" ? activeConvo.patient.avatar : "DR"}
                  </div>
                  <div className={`flex flex-col gap-1 max-w-[72%] ${msg.role === "psych" ? "items-end" : "items-start"}`}>
                    <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                      msg.role === "psych"
                        ? "bg-primary text-primary-foreground rounded-tr-sm shadow-sm shadow-primary/10"
                        : "bg-card border border-border text-foreground rounded-tl-sm"
                    }`}>
                      {msg.text}
                    </div>
                    <span className="text-[10px] text-muted-foreground px-1">{msg.time}</span>
                  </div>
                </motion.div>
              ))
            )}
            <div ref={endRef} />
          </div>

          {/* Reply input */}
          <div className="px-5 py-3 border-t border-border bg-card flex-shrink-0 space-y-2">
            {/* Quick reply chips */}
            <div className="flex gap-1.5 flex-wrap">
              {[
                "How are you feeling today?",
                "Let's book a session soon.",
                "You're doing great. Keep it up.",
                "I'm reviewing your notes now.",
              ].map(chip => (
                <button key={chip} onClick={() => setInput(chip)}
                  className="text-[11px] px-2.5 py-1 rounded-full bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary hover:border-primary/20 border border-transparent transition-all">
                  {chip}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 bg-background border border-border rounded-2xl px-3 py-2">
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder={`Reply to ${activeConvo.patient.name}...`}
                className="flex-1 bg-transparent text-foreground placeholder-muted-foreground text-sm focus:outline-none"
                onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendReply()}
              />
              <motion.button onClick={sendReply} whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.93 }}
                className={`p-2 rounded-xl transition-all ${input.trim() ? "bg-primary text-primary-foreground hover:opacity-95" : "text-muted-foreground"}`}>
                <Send size={15} />
              </motion.button>
            </div>
            <p className="text-center text-[10px] text-muted-foreground">Messages are end-to-end encrypted · HIPAA compliant</p>
          </div>
        </div>
      ) : (
        /* Empty state when no conversation selected on wide screen */
        <div className="hidden sm:flex flex-1 items-center justify-center flex-col gap-4 text-center p-8">
          <div className="w-20 h-20 rounded-3xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Inbox size={36} className="text-primary" />
          </div>
          <div>
            <p className="text-xl font-black font-serif text-foreground">Select a conversation</p>
            <p className="text-muted-foreground text-sm mt-1 max-w-xs">
              Choose a patient from the left to read their messages and send a reply.
            </p>
          </div>
          {Object.keys(psychMessages).length === 0 && (
            <div className="bg-muted/40 border border-border rounded-xl px-5 py-3 text-xs text-muted-foreground max-w-xs">
              No messages yet. When students message you from the app, they will appear here.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── TRIAGE TAB ──────────────────────────────────────────────────────────────
function TriageTab({ selectedPatient, setSelectedPatient }: {
  selectedPatient: typeof PATIENTS[0] | null;
  setSelectedPatient: (p: typeof PATIENTS[0] | null) => void;
}) {
  const [filter, setFilter] = useState("ALL");
  const [showCall, setShowCall] = useState(false);
  const [callPatient, setCallPatient] = useState<typeof PATIENTS[0] | null>(null);
  const { psychNotes, setPsychNote } = useStore();

  const critical = PATIENTS.filter(p => p.status === "CRITICAL").length;
  const filtered = filter === "ALL" ? PATIENTS : PATIENTS.filter(p => p.status === filter);

  const statusColor = (s: string) =>
    s === "CRITICAL" ? "text-destructive bg-destructive/10 border-destructive/30" :
    s === "MODERATE" ? "text-accent bg-accent/10 border-accent/20" :
    "text-green-700 bg-green-100 border-green-300";

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-black font-serif text-foreground">Patient Triage Dashboard</h1>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Patients", value: PATIENTS.length, icon: Users, color: "text-primary", bg: "bg-primary/10" },
          { label: "Critical Alerts", value: critical, icon: AlertTriangle, color: "text-destructive", bg: "bg-destructive/10", pulse: critical > 0 },
          { label: "Active Sessions", value: 2, icon: Activity, color: "text-green-600", bg: "bg-green-100" },
          { label: "Avg Risk Score", value: `${Math.round(PATIENTS.reduce((a, b) => a + b.riskScore, 0) / PATIENTS.length)}%`, icon: TrendingUp, color: "text-accent", bg: "bg-accent/10" },
        ].map(stat => (
          <div key={stat.label} className="bg-card border border-border rounded-2xl p-4">
            <div className="flex items-center justify-between mb-2">
              <div className={`w-9 h-9 rounded-xl ${stat.bg} flex items-center justify-center`}>
                <stat.icon size={16} className={stat.color} />
              </div>
              {"pulse" in stat && stat.pulse && (
                <motion.div animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.5, repeat: Infinity }}
                  className="w-2 h-2 rounded-full bg-destructive" />
              )}
            </div>
            <p className={`text-3xl font-black ${stat.color}`}>{stat.value}</p>
            <p className="text-muted-foreground text-xs mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Filter + patient list */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h2 className="font-bold text-foreground font-serif">Patient Triage List</h2>
          <div className="flex gap-1.5">
            {["ALL", "CRITICAL", "MODERATE", "STABLE"].map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${filter === f
                  ? f === "CRITICAL" ? "bg-destructive/15 text-destructive border border-destructive/40"
                  : f === "MODERATE" ? "bg-accent/10 text-accent border border-accent/20"
                  : f === "STABLE" ? "bg-green-100 text-green-700 border border-green-300"
                  : "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"}`}>
                {f}
              </button>
            ))}
          </div>
        </div>
        <div className="divide-y divide-border">
          {filtered.map(patient => (
            <motion.div key={patient.id} layout
              className="p-4 hover:bg-muted/30 transition-all cursor-pointer group"
              onClick={() => setSelectedPatient(patient)}>
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-sm font-black flex-shrink-0 border ${statusColor(patient.status)}`}>
                  {patient.avatar}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-foreground font-semibold">{patient.name}</span>
                    <span className="text-muted-foreground text-sm">({patient.age})</span>
                    {patient.status === "CRITICAL" && (
                      <motion.span animate={{ opacity: [1, 0.5, 1] }} transition={{ duration: 1, repeat: Infinity }}
                        className="text-[10px] px-2 py-0.5 rounded-full bg-destructive/15 text-destructive font-bold border border-destructive/30">
                        CRITICAL
                      </motion.span>
                    )}
                  </div>
                  <p className="text-muted-foreground text-sm mt-0.5">{patient.emotion} · {patient.lastSession}</p>
                  <div className="flex gap-1 mt-1 flex-wrap">
                    {patient.tags.map(t => <span key={t} className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary">{t}</span>)}
                  </div>
                </div>
                <div className="text-right flex-shrink-0 space-y-1.5">
                  <div className="text-xl font-black" style={{ color: patient.riskScore > 70 ? "hsl(var(--destructive))" : patient.riskScore > 50 ? "#F59E0B" : "#3A7A52" }}>
                    {patient.riskScore}%
                  </div>
                  <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${patient.riskScore}%`, background: patient.riskScore > 70 ? "hsl(var(--destructive))" : patient.riskScore > 50 ? "#F59E0B" : "#3A7A52" }} />
                  </div>
                  <p className="text-[10px] text-muted-foreground">Risk Score</p>
                </div>
                <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={e => { e.stopPropagation(); setCallPatient(patient); setShowCall(true); }}
                    className="p-2 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 transition-colors">
                    <Phone size={14} />
                  </button>
                  <button onClick={e => e.stopPropagation()}
                    className="p-2 rounded-xl bg-muted text-muted-foreground hover:bg-muted/80 transition-colors">
                    <MessageCircle size={14} />
                  </button>
                </div>
                <ChevronRight size={14} className="text-muted-foreground group-hover:text-foreground transition-colors flex-shrink-0" />
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Patient modal */}
      <AnimatePresence>
        {selectedPatient && (
          <PatientModal
            patient={selectedPatient}
            note={psychNotes[selectedPatient.id] || ""}
            onSaveNote={(note) => setPsychNote(selectedPatient.id, note)}
            onClose={() => setSelectedPatient(null)}
            onCall={() => { setCallPatient(selectedPatient); setShowCall(true); setSelectedPatient(null); }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showCall && callPatient && (
          <CallUI type="psychologist" psychName={callPatient.name} onEnd={() => { setShowCall(false); setCallPatient(null); }} />
        )}
      </AnimatePresence>
    </div>
  );
}

function PatientModal({ patient, note, onSaveNote, onClose, onCall }: {
  patient: typeof PATIENTS[0];
  note: string;
  onSaveNote: (n: string) => void;
  onClose: () => void;
  onCall: () => void;
}) {
  const [ptab, setPtab] = useState("overview");
  const [editNote, setEditNote] = useState(note);
  const [overrideMsg, setOverrideMsg] = useState("");
  const [overrideSent, setOverrideSent] = useState(false);

  const sendOverride = () => {
    if (!overrideMsg.trim()) return;
    setOverrideSent(true);
    setTimeout(() => setOverrideSent(false), 3000);
    setOverrideMsg("");
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
      onClick={onClose}>
      <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95 }}
        onClick={e => e.stopPropagation()}
        className="bg-card border border-border rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-border flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-sm font-black border ${patient.status === "CRITICAL" ? "bg-destructive/10 text-destructive border-destructive/30" : patient.status === "MODERATE" ? "bg-amber-100 text-amber-700 border-amber-300" : "bg-green-100 text-green-700 border-green-300"}`}>
              {patient.avatar}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-foreground font-serif">{patient.name}</h3>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${patient.status === "CRITICAL" ? "bg-destructive/10 text-destructive border-destructive/30" : patient.status === "MODERATE" ? "bg-amber-100 text-amber-700 border-amber-300" : "bg-green-100 text-green-700 border-green-300"}`}>
                  {patient.status}
                </span>
              </div>
              <div className="flex gap-1 mt-1">
                {patient.tags.map(t => <span key={t} className="text-[10px] text-muted-foreground">{t}</span>)}
              </div>
            </div>
          </div>
          <button onClick={onClose}><X size={18} className="text-muted-foreground hover:text-foreground" /></button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-5 py-3 border-b border-border flex-shrink-0">
          {["overview", "chat", "visual", "notes"].map(t => (
            <button key={t} onClick={() => setPtab(t)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold capitalize transition-all ${ptab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"}`}>
              {t === "chat" ? "Chat History" : t === "visual" ? "Visual Logs" : t === "notes" ? "My Notes" : "Overview"}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          <AnimatePresence mode="wait">
            {ptab === "overview" && (
              <motion.div key="ov" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  {[{ l: "Risk Score", v: `${patient.riskScore}%`, color: patient.riskScore > 70 ? "text-destructive" : patient.riskScore > 50 ? "text-amber-600" : "text-green-600" },
                    { l: "Sessions", v: `${patient.sessions}`, color: "text-primary" },
                    { l: "Age", v: `${patient.age}`, color: "text-foreground" }].map(item => (
                    <div key={item.l} className="bg-muted/40 rounded-xl p-4 text-center border border-border">
                      <div className={`text-2xl font-black ${item.color}`}>{item.v}</div>
                      <div className="text-muted-foreground text-xs mt-1">{item.l}</div>
                    </div>
                  ))}
                </div>
                <div className="bg-muted/40 rounded-xl p-4 border border-border space-y-2">
                  <div className="text-xs font-semibold text-foreground">Current Emotion</div>
                  <div className="text-sm text-foreground">{patient.emotion}</div>
                </div>
                <div className="bg-muted/40 rounded-xl p-4 border border-border space-y-2">
                  <div className="text-xs font-semibold text-foreground">7-Day Mood Trend</div>
                  <ResponsiveContainer width="100%" height={80}>
                    <LineChart data={patient.moodHistory.map((v, i) => ({ day: i + 1, mood: v }))}>
                      <Line type="monotone" dataKey="mood" stroke="#3A7A52" strokeWidth={2} dot={false} />
                      <YAxis hide domain={[0, 100]} />
                      <Tooltip contentStyle={{ fontSize: 10, background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 6 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div className="text-xs text-muted-foreground">Last session: {patient.lastSession}</div>
              </motion.div>
            )}
            {ptab === "chat" && (
              <motion.div key="ch" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
                {[
                  { role: "ai", text: "Haan yaar, main sun rahi hoon. Aaj kaisa feel ho raha hai?" },
                  { role: "user", text: "Bahut overwhelmed hoon. Exams ke wajah se neend nahi aa rahi" },
                  { role: "ai", text: "Samajh sakti hoon. Ye feelings bilkul valid hain. Ek deep breath lo." },
                  { role: "user", text: "Okay... tried it. Thoda better laga" },
                  { role: "ai", text: "Perfect! Dekho, tumhara body already respond kar raha hai." },
                ].map((msg, i) => (
                  <div key={i} className={`flex gap-2 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                    <div className={`px-4 py-2.5 rounded-2xl text-sm max-w-xs ${msg.role === "user" ? "bg-primary/20 text-foreground" : "bg-muted text-foreground"}`}>
                      {msg.text}
                    </div>
                  </div>
                ))}
              </motion.div>
            )}
            {ptab === "visual" && (
              <motion.div key="vl" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
                {[
                  { time: "10:00", emotion: "Neutral", fatigue: 45, focus: 62, env: "Normal workspace" },
                  { time: "10:05", emotion: "Anxiety", fatigue: 67, focus: 38, env: "Cluttered desk detected" },
                  { time: "10:10", emotion: "Suppressed Fear", fatigue: 81, focus: 22, env: "Dark room, poor lighting" },
                  { time: "10:15", emotion: "Improving", fatigue: 71, focus: 41, env: "Dark room" },
                ].map((log, i) => (
                  <div key={i} className="bg-muted/40 rounded-xl p-4 border border-border space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground text-xs font-mono">{log.time}</span>
                      <span className={`text-sm font-semibold ${log.emotion.includes("Anxiety") || log.emotion.includes("Fear") ? "text-destructive" : log.emotion === "Neutral" ? "text-blue-500" : "text-green-600"}`}>{log.emotion}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {[{ l: "Fatigue", v: log.fatigue, c: "hsl(var(--destructive))" }, { l: "Focus", v: log.focus, c: "#3A7A52" }].map(m => (
                        <div key={m.l}>
                          <div className="flex justify-between text-xs text-muted-foreground mb-1"><span>{m.l}</span><span>{m.v}%</span></div>
                          <div className="h-1.5 bg-muted rounded-full overflow-hidden"><div className="h-full rounded-full" style={{ width: `${m.v}%`, background: m.c }} /></div>
                        </div>
                      ))}
                    </div>
                    <p className="text-muted-foreground text-xs">{log.env}</p>
                  </div>
                ))}
              </motion.div>
            )}
            {ptab === "notes" && (
              <motion.div key="nt" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
                <textarea value={editNote} onChange={e => setEditNote(e.target.value)}
                  rows={8} placeholder="Add clinical notes about this patient..."
                  className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none" />
                <button onClick={() => onSaveNote(editNote)}
                  className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity">
                  Save Notes
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Actions */}
        <div className="p-4 border-t border-border flex-shrink-0 space-y-2">
          {/* Session override */}
          <div className="flex gap-2">
            <input value={overrideMsg} onChange={e => setOverrideMsg(e.target.value)}
              placeholder="Override session message..."
              className="flex-1 text-xs px-3 py-2 rounded-xl border border-accent/30 bg-accent/5 text-accent placeholder-accent/50 focus:outline-none focus:ring-1 focus:ring-accent/40"
              onKeyDown={e => e.key === "Enter" && sendOverride()}
            />
            <button onClick={sendOverride} className="px-4 py-2 bg-accent text-accent-foreground rounded-xl text-xs font-semibold hover:opacity-95 transition-all flex items-center gap-1">
              <Zap size={12} /> Override
            </button>
            {overrideSent && <span className="flex items-center gap-1 text-xs text-green-600"><CheckCircle size={12} /> Sent</span>}
          </div>
          <div className="flex gap-2">
            <button onClick={onCall} className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity flex items-center justify-center gap-2">
              <Phone size={14} /> Call Patient
            </button>
            <button className="flex-1 py-2.5 rounded-xl border border-border text-sm font-semibold text-foreground hover:bg-muted/50 transition-colors flex items-center justify-center gap-2">
              <MessageCircle size={14} /> Message
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── ANALYTICS TAB (PSYCH) ───────────────────────────────────────────────────
function AnalyticsTab() {
  const riskDist = [
    { name: "Critical", value: 1, color: "hsl(var(--destructive))" },
    { name: "Moderate", value: 2, color: "#F59E0B" },
    { name: "Stable", value: 1, color: "#3A7A52" },
  ];
  const sessionFreq = [
    { day: "Mon", sessions: 4 }, { day: "Tue", sessions: 6 }, { day: "Wed", sessions: 3 },
    { day: "Thu", sessions: 8 }, { day: "Fri", sessions: 5 }, { day: "Sat", sessions: 2 }, { day: "Sun", sessions: 1 },
  ];
  const outcomeData = [
    { month: "Jan", improved: 12, stable: 5, declined: 2 },
    { month: "Feb", improved: 15, stable: 4, declined: 1 },
    { month: "Mar", improved: 18, stable: 6, declined: 3 },
    { month: "Apr", improved: 20, stable: 3, declined: 1 },
    { month: "May", improved: 16, stable: 7, declined: 2 },
  ];

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-black font-serif text-foreground">Practice Analytics</h1>

      {/* Overview cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Sessions This Week", value: "29", icon: Activity, color: "text-primary" },
          { label: "Avg Session Length", value: "43m", icon: Clock, color: "text-blue-500" },
          { label: "Improvement Rate", value: "78%", icon: TrendingUp, color: "text-green-600" },
          { label: "Active Patients", value: "4", icon: Users, color: "text-primary" },
        ].map(stat => (
          <div key={stat.label} className="bg-card border border-border rounded-2xl p-4">
            <stat.icon size={18} className={`${stat.color} mb-2`} />
            <p className={`text-3xl font-black ${stat.color}`}>{stat.value}</p>
            <p className="text-muted-foreground text-xs mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Risk distribution pie */}
        <div className="bg-card border border-border rounded-2xl p-5">
          <h3 className="font-bold text-foreground mb-4 font-serif">Risk Distribution</h3>
          <div className="flex items-center gap-6">
            <ResponsiveContainer width={120} height={120}>
              <PieChart>
                <Pie data={riskDist} cx={55} cy={55} innerRadius={35} outerRadius={55} dataKey="value">
                  {riskDist.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-3">
              {riskDist.map(item => (
                <div key={item.name} className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: item.color }} />
                  <span className="text-sm text-foreground">{item.name}</span>
                  <span className="ml-auto text-sm font-bold text-foreground">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Session frequency */}
        <div className="bg-card border border-border rounded-2xl p-5">
          <h3 className="font-bold text-foreground mb-4 font-serif">Session Frequency</h3>
          <ResponsiveContainer width="100%" height={150}>
            <BarChart data={sessionFreq}>
              <XAxis dataKey="day" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis hide />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 11 }} />
              <Bar dataKey="sessions" fill="#3A7A52" radius={[4, 4, 0, 0]} name="Sessions" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Patient outcomes */}
        <div className="bg-card border border-border rounded-2xl p-5 lg:col-span-2">
          <h3 className="font-bold text-foreground mb-4 font-serif">Patient Outcomes Trend</h3>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={outcomeData}>
              <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis hide />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 11 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="improved" fill="#3A7A52" radius={[3, 3, 0, 0]} name="Improved" stackId="a" />
              <Bar dataKey="stable" fill="#F59E0B" radius={[0, 0, 0, 0]} name="Stable" stackId="a" />
              <Bar dataKey="declined" fill="hsl(var(--destructive))" radius={[0, 0, 3, 3]} name="Declined" stackId="a" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

// ─── REPORTS TAB ─────────────────────────────────────────────────────────────
function ReportsTab() {
  const [downloading, setDownloading] = useState<number | null>(null);
  const [filter, setFilter] = useState("All");

  const handleDownload = (id: number) => {
    setDownloading(id);
    setTimeout(() => setDownloading(null), 2000);
  };

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black font-serif text-foreground">Session Reports</h1>
        <div className="flex items-center gap-2">
          <Filter size={14} className="text-muted-foreground" />
          <select value={filter} onChange={e => setFilter(e.target.value)}
            className="text-sm bg-background border border-border rounded-xl px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40">
            <option>All</option>
            {PATIENTS.map(p => <option key={p.id}>{p.name}</option>)}
          </select>
        </div>
      </div>

      <div className="space-y-4">
        {REPORTS.filter(r => filter === "All" || r.patient === filter).map(report => (
          <motion.div key={report.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="bg-card border border-border rounded-2xl p-5 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 flex-wrap">
                  <h3 className="font-bold text-foreground font-serif">{report.patient}</h3>
                  <span className="text-xs text-muted-foreground">{report.date}</span>
                  <span className="text-xs text-muted-foreground">{report.duration}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${report.riskChange > 0 ? "bg-destructive/10 text-destructive" : "bg-green-100 text-green-700"}`}>
                    Risk {report.riskChange > 0 ? "+" : ""}{report.riskChange}%
                  </span>
                </div>
                <p className="text-muted-foreground text-sm mt-2 leading-relaxed">{report.summary}</p>
                <div className="flex gap-1.5 mt-2 flex-wrap">
                  {report.themes.map(t => <span key={t} className="text-[10px] px-2.5 py-1 rounded-full bg-muted text-muted-foreground">{t}</span>)}
                </div>
              </div>
              <motion.button
                onClick={() => handleDownload(report.id)}
                whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary/10 text-primary text-sm font-semibold hover:bg-primary/20 transition-colors flex-shrink-0">
                {downloading === report.id
                  ? <><motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}><RefreshCw size={14} /></motion.div> Downloading...</>
                  : <><Download size={14} /> Download PDF</>}
              </motion.button>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// ─── NOTIFICATIONS TAB ───────────────────────────────────────────────────────
function NotificationsTab({ notifications, setNotifications }: {
  notifications: typeof NOTIFICATIONS;
  setNotifications: (n: typeof NOTIFICATIONS) => void;
}) {
  const [filter, setFilter] = useState("All");

  const markRead = (id: number) =>
    setNotifications(notifications.map(n => n.id === id ? { ...n, read: true } : n));

  const markAllRead = () =>
    setNotifications(notifications.map(n => ({ ...n, read: true })));

  const filtered = filter === "All" ? notifications
    : filter === "Unread" ? notifications.filter(n => !n.read)
    : notifications.filter(n => n.type === "critical");

  const typeIcon = (type: string) =>
    type === "critical" ? <AlertTriangle size={16} className="text-destructive" />
    : type === "session" ? <Activity size={16} className="text-primary" />
    : <Bell size={16} className="text-muted-foreground" />;

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black font-serif text-foreground">Notifications</h1>
        <button onClick={markAllRead} className="flex items-center gap-1.5 text-sm text-primary hover:opacity-80 transition-opacity">
          <BellOff size={14} /> Mark all read
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {["All", "Unread", "Critical"].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${filter === f ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>
            {f} {f === "Unread" && notifications.filter(n => !n.read).length > 0 && `(${notifications.filter(n => !n.read).length})`}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {filtered.map(notif => (
          <motion.div key={notif.id} layout
            className={`flex items-start gap-4 p-4 rounded-2xl border transition-all cursor-pointer hover:shadow-sm ${notif.read ? "bg-card border-border opacity-70" : "bg-card border-border shadow-sm"}`}
            onClick={() => markRead(notif.id)}>
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${notif.type === "critical" ? "bg-destructive/10" : notif.type === "session" ? "bg-primary/10" : "bg-muted"}`}>
              {typeIcon(notif.type)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className={`text-sm font-semibold ${notif.read ? "text-muted-foreground" : "text-foreground"}`}>{notif.title}</p>
                {!notif.read && (
                  <motion.div animate={notif.type === "critical" ? { opacity: [1, 0.3, 1] } : {}} transition={{ duration: 1.5, repeat: Infinity }}
                    className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{notif.message}</p>
              <p className="text-[10px] text-muted-foreground mt-1">{notif.time}</p>
            </div>
            {notif.read && <CheckCircle size={14} className="text-muted-foreground flex-shrink-0 mt-1" />}
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// ─── SETTINGS TAB (PSYCH) ────────────────────────────────────────────────────
function PsychSettingsTab({ licenseId }: { licenseId: string }) {
  const [available, setAvailable] = useState(true);
  const [emergencyProtocol, setEmergencyProtocol] = useState(true);
  const [emailNotifs, setEmailNotifs] = useState(true);
  const [smsAlerts, setSmsAlerts] = useState(false);
  const [saved, setSaved] = useState(false);

  const save = () => { setSaved(true); setTimeout(() => setSaved(false), 2000); };

  const Toggle = ({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) => (
    <button onClick={() => onChange(!value)}
      className={`w-11 h-6 rounded-full relative transition-all ${value ? "bg-primary" : "bg-muted"}`}>
      <motion.div animate={{ x: value ? 23 : 2 }} className="absolute top-1 w-4 h-4 bg-white rounded-full shadow" />
    </button>
  );

  return (
    <div className="p-6 space-y-5 max-w-2xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black font-serif text-foreground">Portal Settings</h1>
        {saved && (
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
            className="flex items-center gap-1.5 text-sm text-green-700 bg-green-100 px-3 py-1.5 rounded-full">
            <CheckCircle size={14} /> Saved
          </motion.div>
        )}
      </div>

      {/* Profile */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="px-5 py-3 border-b border-border bg-muted/30">
          <h3 className="font-bold text-foreground text-sm font-serif">Profile</h3>
        </div>
        <div className="p-5 space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary text-xl font-black">
              {licenseId.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <p className="font-bold text-foreground font-serif">Dr. Clinical Professional</p>
              <p className="text-muted-foreground text-sm">License: {licenseId}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Availability */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="px-5 py-3 border-b border-border bg-muted/30">
          <h3 className="font-bold text-foreground text-sm font-serif">Availability</h3>
        </div>
        <div className="divide-y divide-border">
          {[
            { label: "Available for Calls", sub: "Allow students to call you directly", value: available, set: setAvailable },
            { label: "Emergency Protocol", sub: "Receive critical patient alerts immediately", value: emergencyProtocol, set: setEmergencyProtocol },
          ].map(item => (
            <div key={item.label} className="flex items-center justify-between px-5 py-3.5">
              <div>
                <p className="text-sm font-medium text-foreground">{item.label}</p>
                <p className="text-xs text-muted-foreground">{item.sub}</p>
              </div>
              <Toggle value={item.value} onChange={item.set} />
            </div>
          ))}
        </div>
      </div>

      {/* Notifications */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="px-5 py-3 border-b border-border bg-muted/30">
          <h3 className="font-bold text-foreground text-sm font-serif">Notification Preferences</h3>
        </div>
        <div className="divide-y divide-border">
          {[
            { label: "Email Notifications", sub: "Session summaries and alerts via email", value: emailNotifs, set: setEmailNotifs },
            { label: "SMS Alerts", sub: "Critical alerts via text message", value: smsAlerts, set: setSmsAlerts },
          ].map(item => (
            <div key={item.label} className="flex items-center justify-between px-5 py-3.5">
              <div>
                <p className="text-sm font-medium text-foreground">{item.label}</p>
                <p className="text-xs text-muted-foreground">{item.sub}</p>
              </div>
              <Toggle value={item.value} onChange={item.set} />
            </div>
          ))}
        </div>
      </div>

      <button onClick={save}
        className="w-full py-3.5 rounded-2xl bg-primary text-primary-foreground font-semibold hover:opacity-95 transition-colors shadow-lg shadow-primary/20">
        Save Settings
      </button>
    </div>
  );
}
