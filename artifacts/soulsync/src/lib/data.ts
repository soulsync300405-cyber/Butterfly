export const QUESTS = [
  { id: 1, title: "ADHD Focus Sprint", category: "ADHD", xp: 60, duration: "8m", difficulty: "medium", desc: "A 5-question quiz to sharpen your attention and working memory.", steps: ["Pick ONE task right now", "Set a 2-minute timer", "Work on only that task", "Notice when your mind wanders", "Celebrate finishing"] },
  { id: 2, title: "OCD Grounding Ritual", category: "OCD", xp: 50, duration: "5m", difficulty: "easy", desc: "The 5-4-3-2-1 sensory grounding exercise to anchor yourself in the present.", steps: ["Name 5 things you see", "Name 4 things you can touch", "Name 3 things you hear", "Name 2 things you smell", "Name 1 thing you taste"] },
  { id: 3, title: "Anxiety Breath Reset", category: "Breathing", xp: 40, duration: "4m", difficulty: "easy", desc: "A guided breathing exercise synced with Asha to calm your nervous system.", steps: ["Sit comfortably", "Breathe in for 4 counts", "Hold for 7 counts", "Exhale for 8 counts", "Repeat 3 times"] },
  { id: 4, title: "Focus Flow Challenge", category: "Focus", xp: 80, duration: "12m", difficulty: "hard", desc: "Train sustained attention with a progressive concentration task.", steps: ["Remove all distractions", "Set a 10-minute timer", "Focus on one task only", "Track focus breaks", "Reflect on performance"] },
  { id: 5, title: "Emotion Naming Journal", category: "Anxiety", xp: 45, duration: "6m", difficulty: "easy", desc: "Name and describe 3 emotions you felt today. Build your EQ vocabulary.", steps: ["Find a quiet moment", "Think about your day", "Name emotion #1", "Name emotion #2", "Name emotion #3"] },
  { id: 6, title: "Grounding Body Scan", category: "Grounding", xp: 55, duration: "7m", difficulty: "medium", desc: "A mindful body scan to release tension and reconnect with your physical self.", steps: ["Lie or sit comfortably", "Close your eyes", "Start at your feet", "Slowly move upward", "Release tension as you go"] },
  { id: 7, title: "2-Minute Worry Box", category: "OCD", xp: 35, duration: "2m", difficulty: "easy", desc: "Write down 3 intrusive thoughts, fold them, and put them in your 'worry box'.", steps: ["Get paper and pen", "Write intrusive thought 1", "Write intrusive thought 2", "Write intrusive thought 3", "Fold and set aside"] },
  { id: 8, title: "Gratitude Snap", category: "Focus", xp: 25, duration: "3m", difficulty: "easy", desc: "Name 3 tiny good things from today. Rewire your brain toward positivity.", steps: ["Take a deep breath", "Think of 1 good thing", "Think of another", "Think of one more", "Feel grateful for each"] },
  { id: 9, title: "Social Energy Check", category: "Anxiety", xp: 50, duration: "5m", difficulty: "medium", desc: "Practice boundary-setting with a role-play scenario. Protect your energy.", steps: ["Think of a draining situation", "Identify your boundary", "Practice saying no kindly", "Notice how it feels", "Commit to one boundary today"] },
  { id: 10, title: "Sleep Wind-Down", category: "Grounding", xp: 60, duration: "10m", difficulty: "easy", desc: "A bedtime routine sequence to signal your brain it is safe to rest.", steps: ["Dim your screen", "Write tomorrow's top task", "Do 3 neck rolls each side", "Breathe deeply 5 times", "Set phone face-down"] },
  { id: 11, title: "Confidence Mirror", category: "Focus", xp: 70, duration: "8m", difficulty: "medium", desc: "A self-affirmation challenge. Look in the mirror and speak kindly to yourself.", steps: ["Find a mirror", "Make eye contact with yourself", "Say: 'I am doing my best'", "Name one strength", "Smile at yourself genuinely"] },
  { id: 12, title: "Emotion Regulation", category: "ADHD", xp: 45, duration: "6m", difficulty: "medium", desc: "An impulse check exercise. Pause before reacting to build emotional control.", steps: ["Think of a recent trigger", "Notice body sensation", "Count to 10 slowly", "Ask: is this worth reacting?", "Choose a calm response"] },
];

export const COURSES = [
  { id: 1, title: "Mastering ADHD Focus", category: "ADHD", episodes: 6, duration: "2h 40m", featured: true, desc: "Learn the science of flow state. Break tasks down, manage cognitive load, and harness hyperfocus safely.", gradient: "from-blue-600 to-indigo-700", ep1: "The ADHD Brain: Your Superpower", emoji: "🧠", matchScore: 98, new: false },
  { id: 2, title: "OCD: Understanding Your Mind", category: "OCD", episodes: 4, duration: "1h 30m", featured: false, desc: "Demystify OCD patterns, understand intrusive thoughts, and build a compassionate relationship with your mind.", gradient: "from-purple-600 to-fuchsia-700", ep1: "What OCD Actually Is", emoji: "🌀", matchScore: 91, new: false },
  { id: 3, title: "Anxiety Decoded", category: "Anxiety", episodes: 8, duration: "3h 10m", featured: false, desc: "CBT fundamentals for anxiety. Reframe, regulate, and reclaim your calm with science-backed tools.", gradient: "from-amber-600 to-orange-700", ep1: "The Anxiety Loop", emoji: "💭", matchScore: 95, new: true },
  { id: 4, title: "The Focus Formula", category: "Focus", episodes: 5, duration: "1h 55m", featured: false, desc: "Deep work strategies for students. Train your attention like a muscle with progressive exercises.", gradient: "from-teal-600 to-emerald-700", ep1: "Attention as a Skill", emoji: "🎯", matchScore: 89, new: false },
  { id: 5, title: "Emotional Intelligence 101", category: "EQ", episodes: 7, duration: "2h 45m", featured: false, desc: "Identify, understand, and manage emotions. Build empathy and stronger relationships.", gradient: "from-rose-600 to-pink-700", ep1: "What is EQ?", emoji: "❤️", matchScore: 93, new: false },
  { id: 6, title: "Sleep Science", category: "Wellness", episodes: 4, duration: "1h 20m", featured: false, desc: "Why you are tired all the time and what to do about it. Evidence-based sleep hygiene for students.", gradient: "from-violet-600 to-purple-700", ep1: "Your Circadian Rhythm", emoji: "🌙", matchScore: 87, new: true },
  { id: 7, title: "Stress to Strength", category: "Anxiety", episodes: 5, duration: "2h 00m", featured: false, desc: "Transform exam stress into focused energy. Practical techniques used by peak performers.", gradient: "from-cyan-600 to-sky-700", ep1: "Reframing Stress", emoji: "⚡", matchScore: 90, new: false },
  { id: 8, title: "Mindfulness Foundations", category: "Grounding", episodes: 6, duration: "2h 15m", featured: false, desc: "Build a daily mindfulness practice from scratch. No experience needed.", gradient: "from-green-600 to-emerald-700", ep1: "What Mindfulness Really Is", emoji: "🌿", matchScore: 84, new: false },
  { id: 9, title: "Confidence Architecture", category: "Focus", episodes: 5, duration: "1h 50m", featured: false, desc: "Build authentic self-confidence. Not fake it till you make it — actually make it.", gradient: "from-yellow-600 to-amber-700", ep1: "The Confidence Myth", emoji: "✨", matchScore: 88, new: true },
  { id: 10, title: "Social Anxiety Toolkit", category: "Anxiety", episodes: 6, duration: "2h 25m", featured: false, desc: "Real strategies for social situations. From small talk to presentations.", gradient: "from-red-600 to-rose-700", ep1: "Social Anxiety vs Introversion", emoji: "🫶", matchScore: 92, new: false },
];

export const PSYCHOLOGISTS = [
  { id: 1, name: "Dr. Priya Iyer", specialization: "ADHD & Anxiety", available: true, rating: 4.9, sessions: 248, avatar: "PI", languages: ["English", "Hindi", "Tamil"] },
  { id: 2, name: "Dr. Rohan Sharma", specialization: "OCD & CBT", available: true, rating: 4.8, sessions: 312, avatar: "RS", languages: ["English", "Hindi"] },
  { id: 3, name: "Dr. Ananya Mehta", specialization: "Stress & Focus", available: false, rating: 4.7, sessions: 189, avatar: "AM", languages: ["English", "Gujarati"] },
  { id: 4, name: "Dr. Vikram Bose", specialization: "Trauma & Resilience", available: true, rating: 4.9, sessions: 407, avatar: "VB", languages: ["English", "Bengali"] },
];

export const PATIENTS = [
  { id: 1, name: "Kartik Bisht", age: 22, tags: ["ADHD", "Anxiety"], status: "CRITICAL" as const, lastSession: "2h ago", riskScore: 94, emotion: "Suppressed Anxiety", sessions: 14, avatar: "KB", moodHistory: [60, 45, 30, 25, 40, 35, 28] },
  { id: 2, name: "Priya Sharma", age: 19, tags: ["OCD", "Focus"], status: "MODERATE" as const, lastSession: "1d ago", riskScore: 61, emotion: "Mild Fatigue", sessions: 7, avatar: "PS", moodHistory: [70, 65, 72, 60, 68, 65, 62] },
  { id: 3, name: "Aryan Mehta", age: 25, tags: ["Anxiety"], status: "STABLE" as const, lastSession: "3d ago", riskScore: 32, emotion: "Calm", sessions: 21, avatar: "AM", moodHistory: [80, 82, 78, 85, 83, 80, 82] },
  { id: 4, name: "Neha Gupta", age: 21, tags: ["ADHD", "Focus"], status: "MODERATE" as const, lastSession: "5h ago", riskScore: 58, emotion: "Distracted", sessions: 9, avatar: "NG", moodHistory: [65, 60, 55, 62, 58, 55, 60] },
];

export const NOTIFICATIONS = [
  { id: 1, type: "critical", title: "Critical Alert: Kartik Bisht", message: "Risk score jumped to 94. Immediate attention recommended.", time: "2m ago", read: false },
  { id: 2, type: "session", title: "Session Completed", message: "Priya Sharma completed a 45-min session with Asha.", time: "1h ago", read: false },
  { id: 3, type: "info", title: "New Patient Registration", message: "Sameer Kapoor has joined SoulSync and completed onboarding.", time: "3h ago", read: true },
  { id: 4, type: "warning", title: "Risk Level Change", message: "Neha Gupta's risk score increased from 45 to 58.", time: "5h ago", read: true },
  { id: 5, type: "session", title: "Session Completed", message: "Aryan Mehta completed his weekly check-in.", time: "1d ago", read: true },
  { id: 6, type: "info", title: "Weekly Report Ready", message: "Your weekly patient analytics report is ready for review.", time: "2d ago", read: true },
];

export const REPORTS = [
  { id: 1, patient: "Kartik Bisht", date: "May 12, 2026", duration: "48 min", themes: ["Academic stress", "Sleep issues", "Focus difficulties"], riskChange: +15, summary: "Patient expressed heightened anxiety around upcoming exams. Sleep disruption persisting for 2 weeks. Recommended immediate intervention." },
  { id: 2, patient: "Priya Sharma", date: "May 11, 2026", duration: "32 min", themes: ["Intrusive thoughts", "Routine adherence"], riskChange: -5, summary: "Good session. Patient practiced grounding techniques effectively. OCD symptom frequency reduced. Continuing ERP protocol." },
  { id: 3, patient: "Aryan Mehta", date: "May 10, 2026", duration: "55 min", themes: ["Relationship stress", "Self-esteem"], riskChange: -8, summary: "Strong progress. Patient demonstrates improved coping strategies. Risk score down significantly. Monthly check-in sufficient." },
  { id: 4, patient: "Neha Gupta", date: "May 9, 2026", duration: "41 min", themes: ["Focus challenges", "Academic pressure"], riskChange: +12, summary: "Focus symptoms worsening with semester load. ADHD management strategies need reinforcement. Consider medication review." },
];

export const MOOD_DATA = [
  { day: "Mon", score: 62, anxiety: 45, focus: 58 },
  { day: "Tue", score: 55, anxiety: 60, focus: 45 },
  { day: "Wed", score: 70, anxiety: 35, focus: 72 },
  { day: "Thu", score: 65, anxiety: 42, focus: 68 },
  { day: "Fri", score: 58, anxiety: 55, focus: 52 },
  { day: "Sat", score: 75, anxiety: 28, focus: 80 },
  { day: "Sun", score: 72, anxiety: 30, focus: 75 },
];

export const ASHA_RESPONSES = [
  "Bilkul samajh sakti hoon. Thoda aur batao — kya specific cheez hai jo zyada bother kar rahi hai?",
  "Yaar, ye feelings bahut real hain. Ek kaam karte hain — 5-4-3-2-1 technique try karein? 5 cheezein jo dikh rahi hain...",
  "Tumne jo share kiya, uske liye shukriya. Har step count karta hai, chahe kitna bhi chhota ho.",
  "Interesting! Aur jab aisa hota hai, tumhara body kaisa feel karta hai? Koi tightness chest mein?",
  "Haan! Ye progress hai! Chhoti victories bhi celebrate karni chahiye.",
  "Exams ka pressure real hai. Lekin yaad raho — tum sirf ek student nahi ho. Tum ek poora insaan ho.",
  "Neend nahi aana when stressed is super common. Try karo: phone 30 min pehle band karo, sirf ek boring book padho.",
  "Ye bhi guzar jayega. Aur tum pehle se zyada strong ho jis tarah se sochte ho. Main yahan hoon.",
  "Kya today kuch ek cheez hai jo acchi lagi? Kitni bhi chhoti ho — share karo.",
  "Breath in... 4... 3... 2... 1... Hold... 4... 3... 2... 1... Breathe out slowly. Better?",
];

export const MUSIC_TRACKS = [
  { id: 1, title: "Lo-fi Study Beats", artist: "ChillHop Radio", duration: "∞", playlist: "Focus" },
  { id: 2, title: "Rain on Window", artist: "Nature Sounds", duration: "∞", playlist: "Calm" },
  { id: 3, title: "40Hz Binaural Gamma", artist: "Brain.fm", duration: "∞", playlist: "Focus" },
  { id: 4, title: "Forest Morning", artist: "Nature Sounds", duration: "∞", playlist: "Calm" },
  { id: 5, title: "Deep Meditation Flow", artist: "Mindful Audio", duration: "∞", playlist: "Meditation" },
  { id: 6, title: "Upbeat Study Session", artist: "Focus Beats", duration: "∞", playlist: "Energy" },
];

export const SCHEDULE_SLOTS = [
  "Today 3:00 PM", "Today 5:30 PM", "Tomorrow 10:00 AM",
  "Tomorrow 2:00 PM", "Thu 11:00 AM", "Thu 4:00 PM", "Fri 9:00 AM",
];
