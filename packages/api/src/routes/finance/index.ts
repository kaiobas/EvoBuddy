import { Router } from "express";
import accountsRouter from "./accounts.js";
import categoriesRouter from "./categories.js";

const router = Router();

router.use("/accounts", accountsRouter);
router.use("/categories", categoriesRouter);

// Sub-routers will be mounted here:
// - transactions
// - goals
// - recurring
// - dashboard-config

export default router;
