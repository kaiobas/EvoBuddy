import { Router } from "express";
import accountsRouter from "./accounts.js";
import categoriesRouter from "./categories.js";
import goalsRouter from "./goals.js";
import recurringRouter from "./recurring.js";
import transactionsRouter from "./transactions.js";

const router = Router();

router.use("/accounts", accountsRouter);
router.use("/categories", categoriesRouter);
router.use("/goals", goalsRouter);
router.use("/recurring", recurringRouter);
router.use("/transactions", transactionsRouter);

// Sub-routers will be mounted here:
// - dashboard-config

export default router;
