import { Router } from "express";
import { getOnlineUsers, getOnlinePsychs } from "../signaling";

const router = Router();

router.get("/presence", (_req, res) => {
  res.json({
    users: getOnlineUsers(),
    psychologists: getOnlinePsychs(),
  });
});

export default router;
