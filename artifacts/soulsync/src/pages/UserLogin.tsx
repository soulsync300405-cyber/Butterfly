import { useState } from "react";
import { motion } from "framer-motion";
import { useStore } from "@/lib/store";
import { useToast } from "@/hooks/use-toast";

const getBackendUrl = () => import.meta.env.VITE_BACKEND_URL || "";

export function UserLogin({ onLogin, onBack }: { onLogin: (clientId: string) => void; onBack: () => void }) {
  const [isRegistering, setIsRegistering] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) return;

    setIsLoading(true);
    try {
      const endpoint = isRegistering ? "/api/auth/register" : "/api/auth/login";
      const body = isRegistering ? { username, password, name } : { username, password };

      const res = await fetch(`${getBackendUrl()}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        toast({
          title: "Error",
          description: data.error || "Failed to authenticate",
          variant: "destructive"
        });
        setIsLoading(false);
        return;
      }

      localStorage.setItem("soulsync_client_id", data.clientId);
      toast({
        title: isRegistering ? "Account created!" : "Welcome back!",
        description: `Logged in as ${data.name}`,
      });
      onLogin(data.clientId);
    } catch (err) {
      toast({
        title: "Network Error",
        description: "Could not reach the server.",
        variant: "destructive"
      });
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md p-8 bg-card rounded-3xl shadow-xl border border-border"
      >
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold font-serif mb-2 text-foreground">
            {isRegistering ? "Create Account" : "Welcome Back"}
          </h1>
          <p className="text-muted-foreground">
            {isRegistering ? "Join SoulSync to begin your journey." : "Log in to continue your session."}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {isRegistering && (
            <div>
              <label className="block text-sm font-medium mb-1 text-foreground/80">Display Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full p-3 rounded-xl bg-background border border-input focus:ring-2 focus:ring-ring outline-none transition-all text-foreground"
                placeholder="How should we call you?"
                required
              />
            </div>
          )}
          
          <div>
            <label className="block text-sm font-medium mb-1 text-foreground/80">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full p-3 rounded-xl bg-background border border-input focus:ring-2 focus:ring-ring outline-none transition-all text-foreground"
              placeholder="Enter a unique username"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1 text-foreground/80">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-3 rounded-xl bg-background border border-input focus:ring-2 focus:ring-ring outline-none transition-all text-foreground"
              placeholder="Enter your password"
              required
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-4 mt-6 rounded-xl bg-primary text-primary-foreground font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {isLoading ? "Please wait..." : (isRegistering ? "Sign Up" : "Log In")}
          </button>
        </form>

        <div className="mt-6 flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={() => setIsRegistering(!isRegistering)}
            className="text-sm text-primary hover:underline"
          >
            {isRegistering ? "Already have an account? Log In" : "Don't have an account? Sign Up"}
          </button>
          
          <button
            onClick={onBack}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Return to Home
          </button>
        </div>
      </motion.div>
    </div>
  );
}
