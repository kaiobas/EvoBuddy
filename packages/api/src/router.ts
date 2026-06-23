import { Router } from "express";
import { globalRateLimit } from "./middleware/rateLimit.js";
import healthRouter from "./routes/health.js";
import notesRouter from "./routes/notes.js";
import tasksRouter from "./routes/tasks.js";
import financeRouter from "./routes/finance/index.js";
import calendarRouter from "./routes/calendar/index.js";
import usersRouter from "./routes/users.js";

const router: Router = Router();

// Rate limiting global
router.use(globalRateLimit);

// Rotas
router.use("/api/health", healthRouter);
router.use("/api/notes", notesRouter);
router.use("/api/tasks", tasksRouter);
router.use("/api/finance", financeRouter);
router.use("/api/calendar", calendarRouter);
router.use("/api/users", usersRouter);

export default router;
