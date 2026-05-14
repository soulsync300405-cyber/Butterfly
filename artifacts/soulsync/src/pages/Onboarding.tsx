import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle, ChevronRight, ChevronLeft, Sparkles } from "lucide-react";
import { AnimeAvatar } from "@/components/AnimeAvatar";
import type { Companion, UserProfile } from "@/lib/store";

interface OnboardingProps {
  onComplete: (user: UserProfile, companion: Companion) => void;
}

const WELLNESS_TAGS = [
  { id: "ADHD", emoji: "⚡", desc: "Attention & Focus" },
  { id: "OCD", emoji: "🔄", desc: "Repetitive Thoughts" },
  { id: "Anxiety", emoji: "💭", desc: "Worry & Stress" },
  { id: "Focus", emoji: "🎯", desc: "Concentration" },
  { id: "Sleep", emoji: "🌙", desc: "Sleep Issues" },
  { id: "Confidence", emoji: "✨", desc: "Self-Esteem" },
  { id: "Relationships", emoji: "🤝", desc: "Social Stress" },
  { id: "Stress", emoji: "🌊", desc: "General Stress" },
];

const APPEARANCE_STYLES = [
  { id: "soft-pastel", label: "Soft Pastel", desc: "Gentle & warm" },
  { id: "bold-bright", label: "Bold & Bright", desc: "Confident energy" },
  { id: "calm-forest", label: "Calm Forest", desc: "Earthy, grounded" },
  { id: "urban-cool", label: "Urban Cool", desc: "Modern & sleek" },
  { id: "classic-elegant", label: "Classic Elegant", desc: "Refined & poised" },
  { id: "cosmic-dreamer", label: "Cosmic Dreamer", desc: "Mystical & vivid" },
];

const VOICE_STYLES = ["Calm", "Energetic", "Warm", "Witty"];
const LANGUAGES = [
  { id: "hinglish", label: "Hinglish", sub: "Hindi + English blend" },
  { id: "english", label: "English Only", sub: "Pure English" },
  { id: "hindi", label: "Hindi Only", sub: "Pure Hindi" },
];

export function Onboarding({ onComplete }: OnboardingProps) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [companionName, setCompanionName] = useState("Asha");
  const [gender, setGender] = useState<"male" | "female" | "nonbinary">("female");
  const [description, setDescription] = useState("");
  const [appearance, setAppearance] = useState("soft-pastel");
  const [voiceStyle, setVoiceStyle] = useState("Calm");
  const [language, setLanguage] = useState<"hinglish" | "english" | "hindi">("hinglish");

  const toggleTag = (id: string) =>
    setTags(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);

  const handleFinish = () => {
    onComplete(
      { name, tags, level: 1, xp: 0, streak: 0, sessions: 0 },
      { name: companionName, gender, description, appearance, voiceStyle, language, tone: 50, creativity: 60 }
    );
  };

  const steps = [
    { label: "Your Name" },
    { label: "Wellness Focus" },
    { label: "Your AI Companion" },
  ];

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      {/* Progress dots */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 flex items-center gap-2">
        {steps.map((s, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${i < step ? "bg-primary text-primary-foreground" : i === step ? "bg-primary text-primary-foreground ring-2 ring-primary/30 ring-offset-2" : "bg-muted text-muted-foreground"}`}>
              {i < step ? <CheckCircle size={14} /> : i + 1}
            </div>
            {i < steps.length - 1 && <div className={`h-0.5 w-8 rounded transition-all ${i < step ? "bg-primary" : "bg-muted"}`} />}
          </div>
        ))}
      </div>

      <div className="w-full max-w-lg">
        <AnimatePresence mode="wait">
          {/* STEP 0 — Name */}
          {step === 0 && (
            <motion.div key="s0" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}
              className="space-y-8 text-center">
              <div className="flex justify-center">
                <AnimeAvatar speaking={false} size={100} style="soft-pastel" gender="female" />
              </div>
              <div>
                <h1 className="text-3xl font-black font-serif text-foreground">Namaste!</h1>
                <p className="text-muted-foreground mt-2">I am your AI wellness companion. What should I call you?</p>
              </div>
              <div className="bg-card border border-border rounded-2xl p-6 space-y-3 text-left">
                <label className="text-sm font-medium text-foreground">Your name</label>
                <input value={name} onChange={e => setName(e.target.value)}
                  placeholder="Enter your name..."
                  data-testid="input-name"
                  className="w-full bg-background border border-border rounded-xl px-4 py-3 text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all"
                  onKeyDown={e => e.key === "Enter" && name.trim() && setStep(1)}
                />
              </div>
              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                onClick={() => name.trim() && setStep(1)}
                data-testid="btn-next-step1"
                className={`w-full py-4 rounded-2xl font-semibold text-sm transition-all flex items-center justify-center gap-2 ${name.trim() ? "bg-primary text-primary-foreground hover:opacity-90 shadow-lg shadow-primary/20" : "bg-muted text-muted-foreground cursor-not-allowed"}`}>
                Continue <ChevronRight size={16} />
              </motion.button>
            </motion.div>
          )}

          {/* STEP 1 — Tags */}
          {step === 1 && (
            <motion.div key="s1" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}
              className="space-y-6">
              <div className="text-center">
                <h2 className="text-2xl font-black font-serif text-foreground">What resonates with you?</h2>
                <p className="text-muted-foreground mt-1 text-sm">Select everything that applies. This helps personalize your experience.</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {WELLNESS_TAGS.map(tag => (
                  <motion.button key={tag.id} onClick={() => toggleTag(tag.id)}
                    whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                    data-testid={`btn-tag-${tag.id}`}
                    className={`p-4 rounded-2xl border-2 text-left transition-all relative ${tags.includes(tag.id) ? "border-primary bg-primary/8 shadow-sm" : "border-border bg-card hover:border-primary/40"}`}>
                    <div className="text-xl mb-1">{tag.emoji}</div>
                    <div className="text-foreground font-semibold text-sm">{tag.id}</div>
                    <div className="text-muted-foreground text-xs">{tag.desc}</div>
                    {tags.includes(tag.id) && (
                      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
                        className="absolute top-2 right-2 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                        <CheckCircle size={12} className="text-primary-foreground" />
                      </motion.div>
                    )}
                  </motion.button>
                ))}
              </div>
              <div className="flex gap-3">
                <button onClick={() => setStep(0)} className="px-5 py-3 rounded-xl border border-border text-sm font-medium text-muted-foreground hover:bg-muted/50 transition-colors flex items-center gap-1">
                  <ChevronLeft size={14} /> Back
                </button>
                <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}
                  onClick={() => setStep(2)} data-testid="btn-next-step2"
                  className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition-opacity shadow-lg shadow-primary/20 flex items-center justify-center gap-2">
                  {tags.length > 0 ? `Continue with ${tags.length} selected` : "Skip & Continue"} <ChevronRight size={14} />
                </motion.button>
              </div>
            </motion.div>
          )}

          {/* STEP 2 — Companion customization */}
          {step === 2 && (
            <motion.div key="s2" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}
              className="space-y-5">
              <div className="text-center">
                <h2 className="text-2xl font-black font-serif text-foreground">Design your AI companion</h2>
                <p className="text-muted-foreground mt-1 text-sm">Make them truly yours</p>
              </div>

              {/* Live preview */}
              <div className="flex justify-center py-2">
                <AnimeAvatar speaking={false} size={80} style={appearance as any} gender={gender} name={companionName} />
              </div>

              {/* Name */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">Companion Name</label>
                <input value={companionName} onChange={e => setCompanionName(e.target.value)}
                  placeholder="e.g. Asha, Arjun, Sky..."
                  data-testid="input-companion-name"
                  className="w-full bg-background border border-border rounded-xl px-4 py-3 text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 text-sm transition-all"
                />
              </div>

              {/* Gender */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">Gender</label>
                <div className="flex gap-2">
                  {(["female", "male", "nonbinary"] as const).map(g => (
                    <button key={g} onClick={() => setGender(g)}
                      data-testid={`btn-gender-${g}`}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-medium capitalize transition-all ${gender === g ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>
                      {g === "nonbinary" ? "Non-binary" : g.charAt(0).toUpperCase() + g.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">Personality Description</label>
                <textarea value={description} onChange={e => setDescription(e.target.value)}
                  rows={3} placeholder="Describe your ideal AI friend... (e.g. 'A calm, witty older sibling who keeps it real with me and uses Hinglish. Never sugarcoats things but always believes in me.')"
                  data-testid="input-companion-description"
                  className="w-full bg-background border border-border rounded-xl px-4 py-3 text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 text-sm resize-none transition-all"
                />
              </div>

              {/* Appearance */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Appearance Style</label>
                <div className="grid grid-cols-3 gap-2">
                  {APPEARANCE_STYLES.map(s => (
                    <button key={s.id} onClick={() => setAppearance(s.id)}
                      data-testid={`btn-appearance-${s.id}`}
                      className={`p-2.5 rounded-xl border-2 text-left transition-all ${appearance === s.id ? "border-primary bg-primary/8" : "border-border bg-card hover:border-primary/30"}`}>
                      <div className="flex justify-center mb-1">
                        <AnimeAvatar size={36} style={s.id as any} gender={gender} />
                      </div>
                      <div className="text-foreground text-xs font-semibold text-center leading-tight">{s.label}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Voice */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">Voice Style</label>
                <div className="flex gap-2 flex-wrap">
                  {VOICE_STYLES.map(v => (
                    <button key={v} onClick={() => setVoiceStyle(v)}
                      className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${voiceStyle === v ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>
                      {v}
                    </button>
                  ))}
                </div>
              </div>

              {/* Language */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">Language Mode</label>
                <div className="flex gap-2">
                  {LANGUAGES.map(l => (
                    <button key={l.id} onClick={() => setLanguage(l.id as any)}
                      className={`flex-1 py-2.5 px-3 rounded-xl text-left transition-all border-2 ${language === l.id ? "border-primary bg-primary/8" : "border-border bg-card hover:border-primary/30"}`}>
                      <div className="text-foreground text-xs font-semibold">{l.label}</div>
                      <div className="text-muted-foreground text-[10px]">{l.sub}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-1">
                <button onClick={() => setStep(1)} className="px-5 py-3 rounded-xl border border-border text-sm font-medium text-muted-foreground hover:bg-muted/50 transition-colors flex items-center gap-1">
                  <ChevronLeft size={14} /> Back
                </button>
                <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}
                  onClick={handleFinish} data-testid="btn-start-soulsync"
                  className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition-opacity shadow-lg shadow-primary/20 flex items-center justify-center gap-2">
                  <Sparkles size={16} /> Start SoulSync
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
