import { Router } from "express";
import { db } from "@workspace/db";
import {
  usersTable, companionsTable, chatMessagesTable,
  questProgressTable, psychMessagesTable, psychBookingsTable,
  userSettingsTable, moodLogsTable,
} from "@workspace/db";
import { eq, and } from "drizzle-orm";

const router = Router();

// ── GET /api/sync/:clientId  — load all data for a session ────────────────────
router.get("/sync/:clientId", async (req, res) => {
  const { clientId } = req.params;
  if (!clientId || clientId.length > 128) {
    res.status(400).json({ error: "invalid clientId" });
    return;
  }

  try {
    const [user, companion, chatMsgs, quests, psychMsgs, bookings, settings] = await Promise.all([
      db.select().from(usersTable).where(eq(usersTable.clientId, clientId)).limit(1),
      db.select().from(companionsTable).where(eq(companionsTable.clientId, clientId)).limit(1),
      db.select().from(chatMessagesTable).where(eq(chatMessagesTable.clientId, clientId)).orderBy(chatMessagesTable.createdAt),
      db.select().from(questProgressTable).where(eq(questProgressTable.clientId, clientId)),
      db.select().from(psychMessagesTable).where(eq(psychMessagesTable.clientId, clientId)).orderBy(psychMessagesTable.createdAt),
      db.select().from(psychBookingsTable).where(eq(psychBookingsTable.clientId, clientId)),
      db.select().from(userSettingsTable).where(eq(userSettingsTable.clientId, clientId)).limit(1),
    ]);

    res.json({
      user: user[0] ?? null,
      companion: companion[0] ?? null,
      chatMessages: chatMsgs,
      completedQuests: quests.map(q => q.questId),
      psychMessages: groupByPsychId(psychMsgs),
      psychBookings: groupBookingsById(bookings),
      settings: settings[0] ?? null,
    });
  } catch (err) {
    req.log?.error({ err }, "sync GET failed");
    res.status(500).json({ error: "db error" });
  }
});

// ── POST /api/sync  — full upsert of store state ──────────────────────────────
router.post("/sync", async (req, res) => {
  const { clientId, user, companion, completedQuests, psychMessages, psychBookings, settings } = req.body as {
    clientId: string;
    user?: { name: string; tags: string[]; level: number; xp: number; streak: number; sessions: number } | null;
    companion?: { name: string; gender: string; description: string; appearance: string; voiceStyle: string; language: string; tone: number; creativity: number } | null;
    completedQuests?: number[];
    psychMessages?: Record<string, Array<{ id: number; role: string; text: string; time: string }>>;
    psychBookings?: Record<string, { slot: string; sessionType: string; notes: string }>;
    settings?: Record<string, unknown> | null;
  };

  if (!clientId || typeof clientId !== "string" || clientId.length > 128) {
    res.status(400).json({ error: "invalid clientId" });
    return;
  }

  try {
    const ops: Promise<unknown>[] = [];

    // Upsert user profile
    if (user) {
      ops.push(
        db.insert(usersTable)
          .values({ clientId, name: user.name, tags: user.tags, level: user.level, xp: user.xp, streak: user.streak, sessions: user.sessions })
          .onConflictDoUpdate({ target: usersTable.clientId, set: { name: user.name, tags: user.tags, level: user.level, xp: user.xp, streak: user.streak, sessions: user.sessions, updatedAt: new Date() } })
      );
    }

    // Upsert companion
    if (companion) {
      ops.push(
        db.insert(companionsTable)
          .values({ clientId, name: companion.name, gender: companion.gender, description: companion.description, appearance: companion.appearance, voiceStyle: companion.voiceStyle, language: companion.language, tone: companion.tone, creativity: companion.creativity })
          .onConflictDoUpdate({ target: companionsTable.clientId, set: { name: companion.name, gender: companion.gender, description: companion.description, appearance: companion.appearance, voiceStyle: companion.voiceStyle, language: companion.language, tone: companion.tone, creativity: companion.creativity, updatedAt: new Date() } })
      );
    }

    // Upsert settings
    if (settings) {
      ops.push(
        db.insert(userSettingsTable)
          .values({
            clientId,
            theme: String(settings.theme ?? "light"),
            notifications: Boolean(settings.notifications ?? true),
            dailyReminder: String(settings.dailyReminder ?? "09:00"),
            weeklyReport: Boolean(settings.weeklyReport ?? true),
            dataSharing: Boolean(settings.dataSharing ?? false),
            analytics: Boolean(settings.analytics ?? true),
            sessionRecording: Boolean(settings.sessionRecording ?? false),
            fontSize: String(settings.fontSize ?? "medium"),
            language: String(settings.language ?? "hinglish"),
          })
          .onConflictDoUpdate({
            target: userSettingsTable.clientId,
            set: {
              theme: String(settings.theme ?? "light"),
              notifications: Boolean(settings.notifications ?? true),
              dailyReminder: String(settings.dailyReminder ?? "09:00"),
              weeklyReport: Boolean(settings.weeklyReport ?? true),
              dataSharing: Boolean(settings.dataSharing ?? false),
              analytics: Boolean(settings.analytics ?? true),
              sessionRecording: Boolean(settings.sessionRecording ?? false),
              fontSize: String(settings.fontSize ?? "medium"),
              language: String(settings.language ?? "hinglish"),
              updatedAt: new Date(),
            },
          })
      );
    }

    await Promise.all(ops);

    // Sync quest progress (insert missing only)
    if (Array.isArray(completedQuests) && completedQuests.length > 0) {
      const existing = await db.select({ questId: questProgressTable.questId })
        .from(questProgressTable)
        .where(eq(questProgressTable.clientId, clientId));
      const existingIds = new Set(existing.map(r => r.questId));
      const newQuests = completedQuests.filter(id => !existingIds.has(id));
      if (newQuests.length > 0) {
        await db.insert(questProgressTable).values(
          newQuests.map(id => ({ clientId, questId: id, xpEarned: 0 }))
        );
      }
    }

    // Sync psych messages (insert missing)
    if (psychMessages && typeof psychMessages === "object") {
      const existingMsgs = await db.select({ msgId: psychMessagesTable.id })
        .from(psychMessagesTable).where(eq(psychMessagesTable.clientId, clientId));
      const existingCount = existingMsgs.length;

      let totalIncoming = 0;
      const toInsert: Array<{ clientId: string; psychId: number; role: string; content: string; msgTime: string }> = [];
      for (const [psychIdStr, msgs] of Object.entries(psychMessages)) {
        const psychId = parseInt(psychIdStr, 10);
        if (isNaN(psychId)) continue;
        for (const msg of msgs) {
          totalIncoming++;
          toInsert.push({ clientId, psychId, role: String(msg.role), content: String(msg.text), msgTime: String(msg.time) });
        }
      }

      if (totalIncoming > existingCount && toInsert.length > 0) {
        await db.insert(psychMessagesTable).values(toInsert).onConflictDoNothing();
      }
    }

    // Sync bookings (upsert per psychId)
    if (psychBookings && typeof psychBookings === "object") {
      for (const [psychIdStr, booking] of Object.entries(psychBookings)) {
        const psychId = parseInt(psychIdStr, 10);
        if (isNaN(psychId)) continue;
        await db.insert(psychBookingsTable)
          .values({ clientId, psychId, slot: String(booking.slot), sessionType: String(booking.sessionType), notes: String(booking.notes) })
          .onConflictDoNothing();
      }
    }

    res.json({ ok: true });
  } catch (err) {
    req.log?.error({ err }, "sync POST failed");
    res.status(500).json({ error: "db error" });
  }
});

// ── POST /api/sync/chat  — append a single chat message ──────────────────────
router.post("/sync/chat", async (req, res) => {
  const { clientId, role, content, msgTime } = req.body as {
    clientId: string; role: string; content: string; msgTime: string;
  };
  if (!clientId || !role || !content) {
    res.status(400).json({ error: "missing fields" });
    return;
  }
  try {
    await db.insert(chatMessagesTable).values({ clientId, role: String(role), content: String(content), msgTime: String(msgTime ?? "") });
    res.json({ ok: true });
  } catch (err) {
    req.log?.error({ err }, "sync/chat POST failed");
    res.status(500).json({ error: "db error" });
  }
});

// ── POST /api/sync/mood  — log a mood entry ───────────────────────────────────
router.post("/sync/mood", async (req, res) => {
  const { clientId, mood, emotion, intensity, note } = req.body as {
    clientId: string; mood: string; emotion?: string; intensity?: number; note?: string;
  };
  if (!clientId || !mood) {
    res.status(400).json({ error: "missing fields" });
    return;
  }
  try {
    await db.insert(moodLogsTable).values({
      clientId,
      mood: String(mood),
      emotion: String(emotion ?? ""),
      intensity: typeof intensity === "number" ? intensity : 5,
      note: String(note ?? ""),
    });
    res.json({ ok: true });
  } catch (err) {
    req.log?.error({ err }, "sync/mood POST failed");
    res.status(500).json({ error: "db error" });
  }
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function groupByPsychId(rows: Array<{ psychId: number; role: string; content: string; msgTime: string; id: number }>) {
  const out: Record<number, Array<{ id: number; role: string; text: string; time: string }>> = {};
  for (const r of rows) {
    if (!out[r.psychId]) out[r.psychId] = [];
    out[r.psychId].push({ id: r.id, role: r.role, text: r.content, time: r.msgTime });
  }
  return out;
}

function groupBookingsById(rows: Array<{ psychId: number; slot: string; sessionType: string; notes: string }>) {
  const out: Record<number, { slot: string; sessionType: string; notes: string }> = {};
  for (const r of rows) {
    out[r.psychId] = { slot: r.slot, sessionType: r.sessionType, notes: r.notes };
  }
  return out;
}

export default router;
