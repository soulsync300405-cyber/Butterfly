import { useState } from "react";
import { motion } from "framer-motion";
import { Shield, Lock, RefreshCw, ChevronLeft, Zap } from "lucide-react";

interface PsychLoginProps {
  onLogin: (id: string) => void;
  onBack: () => void;
}

export function PsychLogin({ onLogin, onBack }: PsychLoginProps) {
  const [licenseId, setLicenseId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = () => {
    if (!licenseId.trim()) { setError("License ID required"); return; }
    setLoading(true);
    setError("");
    setTimeout(() => {
      if (licenseId.trim().length >= 6) { onLogin(licenseId.trim()); }
      else { setError("Invalid Medical License ID — must be at least 6 characters"); setLoading(false); }
    }, 1200);
  };

  const useDemoCredentials = () => {
    setLicenseId("MCI-2024-DEMO");
    setError("");
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 left-1/4 w-80 h-80 rounded-full opacity-10 blur-3xl"
          style={{ background: "radial-gradient(circle, hsl(38 92% 50%), transparent)" }} />
        <div className="absolute bottom-1/3 right-1/4 w-64 h-64 rounded-full opacity-10 blur-3xl"
          style={{ background: "radial-gradient(circle, hsl(145 33% 40%), transparent)" }} />
      </div>

      <div className="w-full max-w-md relative">
        <button onClick={onBack} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6">
          <ChevronLeft size={16} /> Back to home
        </button>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="bg-card border border-border rounded-3xl p-8 shadow-xl space-y-6">
          <div className="text-center space-y-3">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center mx-auto">
              <Shield size={28} className="text-amber-600" />
            </div>
            <div>
              <h2 className="text-2xl font-black font-serif text-foreground">Clinical Portal</h2>
              <p className="text-muted-foreground text-sm mt-1">Verified Professionals Only</p>
            </div>
          </div>

          {/* Demo credentials banner */}
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
            className="bg-amber-50 border border-amber-200 rounded-2xl p-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold text-amber-700">🧪 Demo Access</p>
              <p className="text-[11px] text-amber-600 mt-0.5">Use <code className="bg-amber-100 px-1 rounded font-mono font-bold">MCI-2024-DEMO</code> to enter the dashboard</p>
            </div>
            <button
              onClick={useDemoCredentials}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-amber-500 text-white text-xs font-bold hover:bg-amber-600 transition-colors flex-shrink-0">
              <Zap size={11} /> Fill
            </button>
          </motion.div>

          <div className="space-y-3">
            <label className="text-sm font-medium text-foreground">Medical License ID</label>
            <div className="relative">
              <input
                value={licenseId}
                onChange={e => { setLicenseId(e.target.value); setError(""); }}
                placeholder="e.g. MCI-2024-DEMO"
                data-testid="input-license-id"
                className="w-full bg-background border border-border rounded-xl px-4 py-3 pl-10 text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-amber-500/40 transition-all"
                onKeyDown={e => e.key === "Enter" && handleLogin()}
                autoFocus
              />
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            </div>
            {error && <p className="text-destructive text-sm">{error}</p>}
          </div>

          <button onClick={handleLogin} disabled={loading} data-testid="btn-psych-login"
            className="w-full py-4 rounded-2xl font-semibold text-sm bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20">
            {loading
              ? <><motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}><RefreshCw size={16} /></motion.div> Verifying...</>
              : <><Lock size={16} /> Verify &amp; Enter Clinical Portal</>}
          </button>

          <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">🔒 HIPAA Compliant</span>
            <span className="flex items-center gap-1">🛡 256-bit Encrypted</span>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
