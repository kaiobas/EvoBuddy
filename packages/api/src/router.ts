import { Router } from "express";
import { globalRateLimit } from "./middleware/rateLimit.js";
import healthRouter from "./routes/health.js";
import notesRouter from "./routes/notes.js";
import tasksRouter from "./routes/tasks.js";

const router: Router = Router();

// Rate limiting global
router.use(globalRateLimit);

// Rotas
router.use("/api/health", healthRouter);
router.use("/api/notes", notesRouter);
router.use("/api/tasks", tasksRouter);

export default router;
