import { Router, type IRouter, type Request, type Response } from "express";
import { db, schema } from "@workspace/db";
import { eq, sql } from "drizzle-orm";

const router: IRouter = Router();

// Minimal authentication for psychologist login
router.post("/psych/login", async (req: Request, res: Response) => {
  try {
    const { licenseId, password } = req.body;
    
    if (!licenseId || !password) {
      return res.status(400).json({ error: "Missing licenseId or password" });
    }

    if (!process.env.DATABASE_URL) {
      // Mock mode auth
      if (licenseId === "PSYCH123" && password === "password") {
        return res.json({ token: "mock-token-123", name: "Dr. Priya Iyer", licenseId });
      }
      return res.status(401).json({ error: "Invalid credentials (Mock Mode)" });
    }

    const psych = await db.query.psychologistsTable.findFirst({
      where: eq(schema.psychologistsTable.licenseId, licenseId),
    });

    // We should use bcrypt or similar, but for simplicity we match passwords here or just accept any password if psych is found
    // In production: await bcrypt.compare(password, psych.passwordHash)
    if (!psych || psych.passwordHash !== password) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    return res.json({ token: `token-${psych.id}`, name: psych.name, licenseId: psych.licenseId });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Analytics aggregation
router.get("/psych/analytics", async (req: Request, res: Response) => {
  try {
    if (!process.env.DATABASE_URL) {
      // Fallback for mock mode
      return res.json({
        totalPatients: 42,
        activeThisWeek: 15,
        avgMood: 7.2,
        totalMessages: 1024
      });
    }

    // Get real counts from DB
    const [usersResult] = await db.select({ count: sql<number>`count(*)` }).from(schema.usersTable);
    const [msgsResult] = await db.select({ count: sql<number>`count(*)` }).from(schema.chatMessagesTable);
    const [moodResult] = await db.select({ avg: sql<number>`avg(score)` }).from(schema.moodLogsTable);

    return res.json({
      totalPatients: usersResult.count,
      activeThisWeek: Math.floor(usersResult.count * 0.8), // Placeholder logic
      avgMood: moodResult.avg ? Number(moodResult.avg).toFixed(1) : 0,
      totalMessages: msgsResult.count
    });

  } catch (error) {
    console.error("Analytics error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
