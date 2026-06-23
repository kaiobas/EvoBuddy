import { Router } from "express";
import categoriesRouter from "./categories.js";

const router = Router();

// sub-routes mounted by Tasks 3 and 4
router.use("/categories", categoriesRouter);

export default router;
