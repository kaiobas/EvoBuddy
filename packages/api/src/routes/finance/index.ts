import { Router } from "express";
import accountsRouter from "./accounts.js";
import categoriesRouter from "./categories.js";
import recurringRouter from "./recurring.js";
import transactionsRouter from "./transactions.js";

const router = Router();

router.use("/accounts", accountsRouter);
router.use("/categories", categoriesRouter);
router.use("/recurring", recurringRouter);
router.use("/transactions", transactionsRouter);

// Sub-routers will be mounted here:
// - goals
// - dashboard-config

export default router;
