import { Router, type IRouter } from "express";
import healthRouter from "./health";
import chatRouter from "./chat";
import presenceRouter from "./presence";

const router: IRouter = Router();

router.use(healthRouter);
router.use(chatRouter);
router.use(presenceRouter);

export default router;
