import { AnimatePresence } from "framer-motion";
import { useState } from "react";
import { Landing } from "@/pages/Landing";
import { Onboarding } from "@/pages/Onboarding";
import { StudentApp } from "@/pages/StudentApp";
import { PsychLogin } from "@/pages/PsychLogin";
import { PsychDashboard } from "@/pages/PsychDashboard";
import { useStore } from "@/lib/store";
import type { UserProfile, Companion } from "@/lib/store";

type Screen =
  | "landing"
  | "onboarding"
  | "student"
  | "psych-login"
  | "psych-dashboard";

export default function App() {
  const { user, companion, setUser, setCompanion } = useStore();
  const [screen, setScreen] = useState<Screen>(() => {
    if (user && companion) return "student";
    return "landing";
  });
  const [psychLicenseId, setPsychLicenseId] = useState("");

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
