import { AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import { Landing } from "@/pages/Landing";
import { Onboarding } from "@/pages/Onboarding";
import { StudentApp } from "@/pages/StudentApp";
import { PsychLogin } from "@/pages/PsychLogin";
import { PsychDashboard } from "@/pages/PsychDashboard";
import { useStore } from "@/lib/store";
import type { UserProfile, Companion } from "@/lib/store";
import { useDbLoad, useDbSync } from "@/hooks/useDbSync";

type Screen =
  | "landing"
  | "onboarding"
  | "student"
  | "psych-login"
  | "psych-dashboard";

function AppInner() {
  const { user, companion, setUser, setCompanion } = useStore();
  const [screen, setScreen] = useState<Screen>(() => {
    if (user && companion) return "student";
    return "landing";
  });
  const [psychLicenseId, setPsychLicenseId] = useState("");

  const theme = useStore((s) => s.settings.theme);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("dark", "theme-cyberpunk", "theme-antigravity", "theme-sakura", "theme-retro", "theme-dark-death", "theme-netflix", "theme-beige-forest", "theme-butterfly", "light");
    if (theme === "dark") {
      root.classList.add("dark");
    } else if (theme === "cyberpunk") {
      root.classList.add("theme-cyberpunk");
    } else if (theme === "antigravity") {
      root.classList.add("theme-antigravity");
    } else if (theme === "sakura") {
      root.classList.add("theme-sakura");
    } else if (theme === "retro") {
      root.classList.add("theme-retro");
    } else if (theme === "dark-death") {
      root.classList.add("theme-dark-death");
    } else if (theme === "netflix") {
      root.classList.add("theme-netflix");
    } else if (theme === "beige-forest") {
      root.classList.add("theme-beige-forest");
    } else if (theme === "butterfly") {
      root.classList.add("theme-butterfly");
    }
  }, [theme]);

  // Load from DB on mount, sync changes back to DB
  useDbLoad();
  useDbSync();

  const handleSelectRole = (role: "student" | "psych") => {
    if (role === "student") {
      if (user && companion) setScreen("student");
      else setScreen("onboarding");
    } else {
      setScreen("psych-login");
    }
  };

  const handleOnboardingComplete = (u: UserProfile, c: Companion) => {
    setUser(u);
    setCompanion(c);
    setScreen("student");
  };

  const handlePsychLogin = (id: string) => {
    setPsychLicenseId(id);
    setScreen("psych-dashboard");
  };

  const handleStudentLogout = () => {
    setUser(null as any);
    setCompanion(null as any);
    setScreen("landing");
  };

  return (
    <AnimatePresence mode="wait">
      {screen === "landing" && (
        <Landing key="landing" onSelectRole={handleSelectRole} />
      )}
      {screen === "onboarding" && (
        <Onboarding key="onboarding" onComplete={handleOnboardingComplete} />
      )}
      {screen === "student" && user && companion && (
        <StudentApp key="student" onLogout={handleStudentLogout} />
      )}
      {screen === "psych-login" && (
        <PsychLogin
          key="psych-login"
          onLogin={handlePsychLogin}
          onBack={() => setScreen("landing")}
        />
      )}
      {screen === "psych-dashboard" && (
        <PsychDashboard
          key="psych-dashboard"
          licenseId={psychLicenseId}
          onLogout={() => setScreen("landing")}
        />
      )}
    </AnimatePresence>
  );
}

export default function App() {
  return <AppInner />;
}
