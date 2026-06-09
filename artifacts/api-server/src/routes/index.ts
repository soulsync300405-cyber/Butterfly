import { Router, type IRouter } from "express";
import healthRouter from "./health";
import chatRouter from "./chat";
import presenceRouter from "./presence";
import syncRouter from "./sync";
import psychRouter from "./psych";
import authRouter from "./auth";

const router: IRouter = Router();

router.use(healthRouter);
router.use(chatRouter);
router.use(presenceRouter);
router.use(syncRouter);
router.use(psychRouter);
router.use(authRouter);

export default router;