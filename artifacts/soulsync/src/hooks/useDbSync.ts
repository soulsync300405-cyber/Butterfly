import { useEffect, useRef, useCallback } from "react";
import { useStore } from "@/lib/store";

const CLIENT_ID_KEY = "soulsync_client_id";

const getBackendUrl = () => import.meta.env.VITE_BACKEND_URL || "";

function getClientId(): string {
  let id = localStorage.getItem(CLIENT_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(CLIENT_ID_KEY, id);
  }
  return id;
}

export function useClientId() {
  return getClientId();
}

// ── Load data from DB on mount ────────────────────────────────────────────────
export function useDbLoad() {
  const { setUser, setCompanion, updateSettings } = useStore();
  const loaded = useRef(false);

  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;

    const clientId = getClientId();

    fetch(`${getBackendUrl()}/api/sync/${encodeURIComponent(clientId)}`)
      .then(r => r.ok ? r.json() : null)
      .then((data) => {
        if (!data) return;

        // Only hydrate if DB has richer data than localStorage
        if (data.user?.name) {
          setUser({
            name: data.user.name,
            tags: data.user.tags ?? [],
            level: data.user.level ?? 1,
            xp: data.user.xp ?? 0,
            streak: data.user.streak ?? 0,
            sessions: data.user.sessions ?? 0,
          });
        }

        if (data.companion?.name) {
          setCompanion({
            name: data.companion.name,
            gender: data.companion.gender ?? "female",
            description: data.companion.description ?? "",
            appearance: data.companion.appearance ?? "soft-pastel",
            voiceStyle: data.companion.voiceStyle ?? "calm",
            language: (data.companion.language ?? "hinglish") as "hinglish" | "english" | "hindi",
            tone: data.companion.tone ?? 50,
            creativity: data.companion.creativity ?? 70,
          });
        }

        if (data.settings) {
          updateSettings({
            theme: (data.settings.theme === "light" ? "beige" : (data.settings.theme ?? "beige")) as any,
            notifications: data.settings.notifications ?? true,
            dailyReminder: data.settings.dailyReminder ?? "09:00",
            weeklyReport: data.settings.weeklyReport ?? true,
            dataSharing: data.settings.dataSharing ?? false,
            analytics: data.settings.analytics ?? true,
            sessionRecording: data.settings.sessionRecording ?? false,
            fontSize: data.settings.fontSize ?? "medium",
            language: data.settings.language ?? "hinglish",
          });
        }
      })
      .catch(() => { /* offline — use localStorage fallback silently */ });
  }, [setUser, setCompanion, updateSettings]);
}

// ── Periodic & event-driven sync to DB ───────────────────────────────────────
export function useDbSync() {
  const state = useStore();
  const syncRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sync = useCallback(() => {
    const clientId = getClientId();
    const { user, companion, completedQuests, psychMessages, psychBookings, settings } = useStore.getState();

    if (!user) return; // don't sync until onboarding is done

    fetch(`${getBackendUrl()}/api/sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId,
        user,
        companion,
        completedQuests,
        psychMessages,
        psychBookings,
        settings,
      }),
    }).catch(() => { /* silent — localStorage still has data */ });
  }, []);

  // Debounced sync: wait 3s after last state change, then push
  useEffect(() => {
    if (!state.user) return;
    if (syncRef.current) clearTimeout(syncRef.current);
    syncRef.current = setTimeout(sync, 3000);
    return () => {
      if (syncRef.current) clearTimeout(syncRef.current);
    };
  }, [
    state.user,
    state.companion,
    state.completedQuests,
    state.psychMessages,
    state.psychBookings,
    state.settings,
    sync,
  ]);

  // Also sync on tab close / visibility change
  useEffect(() => {
    const handler = () => { if (document.visibilityState === "hidden") sync(); };
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, [sync]);
}

// ── Save a single chat message to DB ─────────────────────────────────────────
export function saveChatMessage(role: string, content: string, msgTime: string) {
  const clientId = getClientId();
  fetch(`${getBackendUrl()}/api/sync/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ clientId, role, content, msgTime }),
  }).catch(() => {});
}

// ── Log a mood entry ──────────────────────────────────────────────────────────
export function logMood(mood: string, emotion?: string, intensity?: number, note?: string) {
  const clientId = getClientId();
  fetch(`${getBackendUrl()}/api/sync/mood`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ clientId, mood, emotion, intensity, note }),
  }).catch(() => {});
}
