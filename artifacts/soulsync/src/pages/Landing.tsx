import { motion } from "framer-motion";
import { Heart, Shield, CheckCircle, ArrowRight, Sparkles } from "lucide-react";
import { AnimeAvatar } from "@/components/AnimeAvatar";

interface LandingProps {
  onSelectRole: (role: "student" | "psych") => void;
}

export function Landing({ onSelectRole }: LandingProps) {
  return (
    <motion.div className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden bg-background"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      {/* Ambient blobs */}
      <div className="absolute top-1/4 left-1/6 w-72 h-72 rounded-full opacity-20 blur-3xl pointer-events-none"
        style={{ background: "radial-gradient(circle, hsl(var(--primary)), transparent)" }} />
      <div className="absolute bottom-1/4 right-1/6 w-64 h-64 rounded-full opacity-15 blur-3xl pointer-events-none"
        style={{ background: "radial-gradient(circle, hsl(var(--accent)), transparent)" }} />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full opacity-10 blur-3xl pointer-events-none"
        style={{ background: "radial-gradient(circle, hsl(var(--secondary)), transparent)" }} />

      {/* Floating particles */}
      {Array.from({ length: 12 }).map((_, i) => (
        <motion.div key={i} className="absolute w-1.5 h-1.5 rounded-full opacity-30 pointer-events-none"
          style={{ background: i % 3 === 0 ? "hsl(var(--primary))" : i % 3 === 1 ? "hsl(var(--accent))" : "hsl(var(--secondary))",
            left: `${10 + (i * 7.5) % 80}%`, top: `${15 + (i * 13) % 70}%` }}
          animate={{ y: [-8, 8, -8], opacity: [0.2, 0.5, 0.2] }}
          transition={{ duration: 3 + (i % 3), repeat: Infinity, delay: i * 0.4 }}
        />
      ))}

      <div className="relative z-10 text-center space-y-10 max-w-xl w-full">
        {/* Logo + Avatar */}
        <motion.div initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", duration: 0.8 }} className="flex flex-col items-center gap-4">
          <AnimeAvatar speaking={false} size={110} style="soft-pastel" gender="female" />
          <div>
            <h1 className="text-5xl font-black tracking-tight font-serif text-foreground">
              Soul<span className="text-primary">Sync</span>
            </h1>
            <p className="text-muted-foreground mt-2 text-base">
              AI-powered mental wellness · Clinically supervised · Culturally aware
            </p>
          </div>
        </motion.div>

        {/* Role cards */}
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Student */}
          <motion.button whileHover={{ scale: 1.02, y: -3 }} whileTap={{ scale: 0.98 }}
            onClick={() => onSelectRole("student")}
            data-testid="btn-student-role"
            className="p-6 rounded-2xl border-2 border-primary/20 bg-primary/5 hover:bg-primary/10 transition-all text-left space-y-4 group cursor-pointer">
            <div className="w-12 h-12 rounded-xl bg-primary/15 border border-primary/25 flex items-center justify-center">
              <Heart size={22} className="text-primary" />
            </div>
            <div>
              <div className="text-foreground font-bold text-lg font-serif">Student / User</div>
              <div className="text-muted-foreground text-sm mt-1 leading-relaxed">
                Talk to your AI companion, track your wellness, complete daily quests
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-primary text-sm font-medium">
              Start Journey
              <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
            </div>
          </motion.button>

          {/* Psychologist */}
          <motion.button whileHover={{ scale: 1.02, y: -3 }} whileTap={{ scale: 0.98 }}
            onClick={() => onSelectRole("psych")}
            data-testid="btn-psych-role"
            className="p-6 rounded-2xl border-2 border-amber-500/20 bg-amber-500/5 hover:bg-amber-500/10 transition-all text-left space-y-4 group cursor-pointer">
            <div className="w-12 h-12 rounded-xl bg-amber-500/15 border border-amber-500/25 flex items-center justify-center">
              <Shield size={22} className="text-amber-600" />
            </div>
            <div>
              <div className="text-foreground font-bold text-lg font-serif">Psychologist</div>
              <div className="text-muted-foreground text-sm mt-1 leading-relaxed">
                Clinical dashboard, patient triage, oversight and direct intervention
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-amber-600 text-sm font-medium">
              Enter Portal
              <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
            </div>
          </motion.button>
        </motion.div>

        {/* Trust badges */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}
          className="flex items-center justify-center gap-6 text-muted-foreground text-xs flex-wrap">
          {["HIPAA Compliant", "End-to-End Encrypted", "AI + Clinical Oversight"].map(badge => (
            <span key={badge} className="flex items-center gap-1.5">
              <CheckCircle size={12} className="text-primary" />
              {badge}
            </span>
          ))}
        </motion.div>

        {/* Feature highlights */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}
          className="grid grid-cols-3 gap-3 text-center">
          {[
            { icon: "🧠", label: "AI Companion", sub: "Culturally aware" },
            { icon: "🎯", label: "Daily Quests", sub: "Gamified wellness" },
            { icon: "📚", label: "EQ Learning", sub: "Netflix-style" },
          ].map(f => (
            <div key={f.label} className="p-3 rounded-xl bg-card border border-border">
              <div className="text-2xl mb-1">{f.icon}</div>
              <div className="text-foreground text-xs font-semibold">{f.label}</div>
              <div className="text-muted-foreground text-[10px]">{f.sub}</div>
            </div>
          ))}
        </motion.div>
      </div>
    </motion.div>
  );
}
