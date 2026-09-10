import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Companion = {
  name: string;
  gender: 'male' | 'female' | 'nonbinary';
  description: string;
  appearance: string;
  voiceStyle: string;
  language: 'hinglish' | 'english' | 'hindi';
  tone: number;
  creativity: number;
};

export type UserProfile = {
  name: string;
  tags: string[];
  level: number;
  xp: number;
  streak: number;
  sessions: number;
};

export type Settings = {
  theme: 'beige' | 'dark' | 'cyberpunk' | 'antigravity' | 'sakura' | 'retro' | 'dark-death' | 'netflix' | 'beige-forest' | 'butterfly';
  notifications: boolean;
  dailyReminder: string;
  weeklyReport: boolean;
  dataSharing: boolean;
  analytics: boolean;
  sessionRecording: boolean;
  fontSize: 'small' | 'medium' | 'large';
  language: string;
};

export type SharedMessage = {
  id: number;
  role: 'student' | 'psych';
  text: string;
  time: string;
};

export type ChatMessage = {
  id: number;
  role: 'user' | 'ai' | 'override';
  content: string;
  msgTime: string;
};

export type PsychBooking = {
  slot: string;
  sessionType: 'video' | 'audio' | 'chat';
  notes: string;
};

export type VibeScan = {
  id: number;
  emotion: string;
  score: number;
  fatigue: number;
  focus: number;
  timestamp: number;
  timeStr: string;
};

type StoreState = {
  user: UserProfile | null;
  companion: Companion | null;
  completedQuests: number[];
  questCompletions: Record<number, { completedAt: number; xpEarned: number }>;
  vibeHistory: VibeScan[];
  settings: Settings;
  psychNotes: Record<number, string>;
  // Shared psych <-> student messaging (keyed by psychologist id)
  psychMessages: Record<number, SharedMessage[]>;
  // Last-read message id per psychId, used for psych unread badge
  psychLastRead: Record<number, number>;
  // Bookings keyed by psychologist id
  psychBookings: Record<number, PsychBooking>;
  chatMessages: ChatMessage[];

  setUser: (u: UserProfile | null) => void;
  setCompanion: (c: Companion) => void;
  completeQuest: (id: number, xp: number) => void;
  addVibeScan: (scan: Omit<VibeScan, 'id' | 'timestamp' | 'timeStr'>) => void;
  incrementSessions: () => void;
  updateSettings: (s: Partial<Settings>) => void;
  setPsychNote: (patientId: number, note: string) => void;
  addPsychMessage: (psychId: number, msg: SharedMessage) => void;
  markPsychRead: (psychId: number) => void;
  setPsychBooking: (psychId: number, booking: PsychBooking) => void;
  removePsychBooking: (psychId: number) => void;
  setChatMessages: (msgs: ChatMessage[]) => void;
  clearChatMessages: () => void;
  logout: () => void;
};

export const useStore = create<StoreState>()(
  persist(
    (set, get) => ({
      user: null,
      companion: null,
      completedQuests: [],
      questCompletions: {},
      vibeHistory: [],
      settings: {
        theme: 'beige',
        notifications: true,
        dailyReminder: '09:00',
        weeklyReport: true,
        dataSharing: false,
        analytics: true,
        sessionRecording: false,
        fontSize: 'medium',
        language: 'hinglish',
      },
      psychNotes: {},
      psychMessages: {},
      psychLastRead: {},
      psychBookings: {},
      chatMessages: [],

      setUser: (u) => set({ user: u }),
      setCompanion: (c) => set({ companion: c }),
      completeQuest: (id, xp) =>
        set((state) => {
          const isNew = !state.completedQuests.includes(id);
          const newCompleted = isNew ? [...state.completedQuests, id] : state.completedQuests;
          const newXp = (state.user?.xp || 0) + xp;
          const newLevel = Math.floor(newXp / 250) + 1;
          const newCompletions = {
            ...(state.questCompletions || {}),
            [id]: { completedAt: Date.now(), xpEarned: xp },
          };
          return {
            completedQuests: newCompleted,
            questCompletions: newCompletions,
            user: state.user
              ? {
                  ...state.user,
                  xp: newXp,
                  level: Math.max(state.user.level || 1, newLevel),
                  streak: Math.max(state.user.streak || 1, 1),
                }
              : null,
          };
        }),
      addVibeScan: (scan) =>
        set((state) => {
          const newScan: VibeScan = {
            ...scan,
            id: Date.now(),
            timestamp: Date.now(),
            timeStr: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          };
          return {
            vibeHistory: [newScan, ...(state.vibeHistory || []).slice(0, 49)],
          };
        }),
      incrementSessions: () =>
        set((state) => ({
          user: state.user ? { ...state.user, sessions: (state.user.sessions || 0) + 1 } : null,
        })),
      updateSettings: (s) =>
        set((state) => ({ settings: { ...state.settings, ...s } })),
      setPsychNote: (patientId, note) =>
        set((state) => ({
          psychNotes: { ...state.psychNotes, [patientId]: note },
        })),
      addPsychMessage: (psychId, msg) =>
        set((state) => ({
          psychMessages: {
            ...state.psychMessages,
            [psychId]: [...(state.psychMessages[psychId] || []), msg],
          },
        })),
      markPsychRead: (psychId) =>
        set((state) => {
          const msgs = state.psychMessages[psychId] || [];
          const lastId = msgs.length > 0 ? msgs[msgs.length - 1].id : 0;
          return { psychLastRead: { ...state.psychLastRead, [psychId]: lastId } };
        }),
      setPsychBooking: (psychId, booking) =>
        set((state) => ({
          psychBookings: { ...state.psychBookings, [psychId]: booking },
        })),
      removePsychBooking: (psychId) =>
        set((state) => {
          const next = { ...state.psychBookings };
          delete next[psychId];
          return { psychBookings: next };
        }),
      setChatMessages: (msgs) => set({ chatMessages: msgs }),
      clearChatMessages: () => set({ chatMessages: [] }),
      logout: () => {
        localStorage.removeItem("soulsync_client_id");
        set({
          user: null,
          chatMessages: [],
          completedQuests: [],
          questCompletions: {},
          vibeHistory: [],
          psychMessages: {},
          psychBookings: {},
        });
      },
    }),
    { name: 'soulsync_v1' }
  )
);
