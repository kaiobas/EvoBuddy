import { Router } from "express";
import accountsRouter from "./accounts.js";
import categoriesRouter from "./categories.js";
import dashboardConfigRouter from "./dashboard-config.js";
import goalsRouter from "./goals.js";
import recurringRouter from "./recurring.js";
import transactionsRouter from "./transactions.js";
import pluggyRouter from "./pluggy.js";

const router = Router();

router.use("/accounts", accountsRouter);
router.use("/categories", categoriesRouter);
router.use("/dashboard-config", dashboardConfigRouter);
router.use("/goals", goalsRouter);
router.use("/recurring", recurringRouter);
router.use("/transactions", transactionsRouter);
router.use("/pluggy", pluggyRouter);

export default router;
