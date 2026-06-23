import { Router } from "express";
import categoriesRouter from "./categories.js";
import eventsRouter from "./events.js";

const router = Router();

// sub-routes mounted by Tasks 3 and 4
router.use("/categories", categoriesRouter);
router.use("/events", eventsRouter);

export default router;
