import { Router } from "express";
import accountsRouter from "./accounts.js";
import categoriesRouter from "./categories.js";
import recurringRouter from "./recurring.js";

const router = Router();

router.use("/accounts", accountsRouter);
router.use("/categories", categoriesRouter);
router.use("/recurring", recurringRouter);

// Sub-routers will be mounted here:
// - transactions
// - goals
// - dashboard-config

export default router;
