import { Router } from "express";
import { db, schema } from "@workspace/db";
import { eq } from "drizzle-orm";
import crypto from "crypto";

const router = Router();

// Registration
router.post("/auth/register", async (req, res) => {
  try {
    const { username, password, name } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: "Missing username or password" });
    }

    if (!process.env.DATABASE_URL) {
      // Mock mode
      return res.json({ clientId: `mock-client-${Date.now()}`, username, name: name || username });
    }

    // Check if exists
    const existing = await db.query.usersTable.findFirst({
      where: eq(schema.usersTable.username, username),
    });

    if (existing) {
      return res.status(409).json({ error: "Username already taken" });
    }

    const clientId = crypto.randomUUID();
    // In production we'd use bcrypt, simplified here
    const passwordHash = password; 

    await db.insert(schema.usersTable).values({
      clientId,
      username,
      passwordHash,
      name: name || username,
    });

    return res.json({ clientId, username, name: name || username });
  } catch (error) {
    console.error("Register error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Login
router.post("/auth/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: "Missing username or password" });
    }

    if (!process.env.DATABASE_URL) {
      // Mock mode
      return res.json({ clientId: `mock-client-123`, username, name: username });
    }

    const user = await db.query.usersTable.findFirst({
      where: eq(schema.usersTable.username, username),
    });

    if (!user || user.passwordHash !== password) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    return res.json({ clientId: user.clientId, username: user.username, name: user.name });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
