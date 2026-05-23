import { Router, type IRouter } from "express";
import healthRouter from "./health";
import chatRouter from "./chat";
import presenceRouter from "./presence";
import syncRouter from "./sync";

const router: IRouter = Router();

router.use(healthRouter);
router.use(chatRouter);
router.use(presenceRouter);
router.use(syncRouter);

export default router;
