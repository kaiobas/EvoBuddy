import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import router from "./router.js";
import { errorHandler } from "./middleware/error.js";

const app: express.Application = express();
const port = parseInt(process.env.PORT || "3001", 10);

// ─── Segurança ───────────────────────────────────────────────
app.use(helmet());
app.use(
  cors({
    origin: process.env.CORS_ORIGIN?.split(",") || ["http://localhost:5173"],
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// ─── Parsers ─────────────────────────────────────────────────
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// ─── Rotas ───────────────────────────────────────────────────
app.use(router);

// ─── Error Handler (deve ser o último) ───────────────────────
app.use(errorHandler);

// ─── Start ───────────────────────────────────────────────────
if (process.env.NODE_ENV !== "test") {
  app.listen(port, () => {
    console.log(`[api] Server running on http://localhost:${port}`);
  });
}

export default app;
