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
  theme: 'light' | 'dark';
  notifications: boolean;
  dailyReminder: string;
  weeklyReport: boolean;
  dataSharing: boolean;
  analytics: boolean;
  sessionRecording: boolean;
  fontSize: 'small' | 'medium' | 'large';
  language: string;
};

type StoreState = {
  user: UserProfile | null;
  companion: Companion | null;
  completedQuests: number[];
  settings: Settings;
  psychNotes: Record<number, string>;
  setUser: (u: UserProfile) => void;
  setCompanion: (c: Companion) => void;
  completeQuest: (id: number, xp: number) => void;
  updateSettings: (s: Partial<Settings>) => void;
  setPsychNote: (patientId: number, note: string) => void;
};

export const useStore = create<StoreState>()(
  persist(
    (set) => ({
      user: null,
      companion: null,
      completedQuests: [],
      settings: {
        theme: 'light',
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
      setUser: (u) => set({ user: u }),
      setCompanion: (c) => set({ companion: c }),
      completeQuest: (id, xp) =>
        set((state) => ({
          completedQuests: state.completedQuests.includes(id)
            ? state.completedQuests
            : [...state.completedQuests, id],
          user: state.user
            ? { ...state.user, xp: state.user.xp + xp }
            : null,
        })),
      updateSettings: (s) =>
        set((state) => ({ settings: { ...state.settings, ...s } })),
      setPsychNote: (patientId, note) =>
        set((state) => ({
          psychNotes: { ...state.psychNotes, [patientId]: note },
        })),
    }),
    { name: 'soulsync_v1' }
  )
);
