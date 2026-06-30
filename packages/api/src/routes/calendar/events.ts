import { Router } from "express";
import { z } from "zod";
import { authMiddleware } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { supabaseAdmin } from "../../lib/supabase.js";
import { AppError } from "../../middleware/error.js";

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// ---------------------------------------------------------------------------
// Recurring expansion helpers
// ---------------------------------------------------------------------------

/**
 * Advances a date string (YYYY-MM-DD) by the given frequency.
 * Uses T12:00:00Z noon anchor to avoid DST edge cases.
 */
function advanceDate(dateStr: string, frequency: string): string {
  const d = new Date(dateStr + "T12:00:00Z");
  if (frequency === "daily") d.setUTCDate(d.getUTCDate() + 1);
  else if (frequency === "weekly") d.setUTCDate(d.getUTCDate() + 7);
  else if (frequency === "monthly") d.setUTCMonth(d.getUTCMonth() + 1);
  else if (frequency === "yearly") d.setUTCFullYear(d.getUTCFullYear() + 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Expands a single event into all its instances within [from, to].
 * Non-recurring events are returned as-is (single-element array).
 * Recurring instances get a virtual id of `${base_id}_${date}`.
 */
function expandRecurring(event: Record<string, unknown>, from: string, to: string): Record<string, unknown>[] {
  if (!event.recurring) return [{ ...event }];

  const recurring = event.recurring as { frequency: string; end_date?: string | null };
  const { frequency, end_date } = recurring;

  const instances: Record<string, unknown>[] = [];
  const limit = end_date && end_date < to ? end_date : to;
  let safety = 0;

  // Skip ahead to the start of the requested range
  let current = event.date as string;
  // Advance to first occurrence >= from
  while (current < from) {
    current = advanceDate(current, frequency);
    if (end_date && current > end_date) return [];
  }

  while (current <= limit && safety < 500) {
    instances.push({ ...event, id: `${event.id}_${current}`, date: current });
    current = advanceDate(current, frequency);
    safety++;
  }

  return instances;
}

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const createSchema = z.object({
  title: z.string().min(1),
  description: z.string().default(""),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  start_time: z.string().nullable().optional(),
  end_time: z.string().nullable().optional(),
  all_day: z.boolean().default(true),
  category_id: z.string().nullable().optional(),
  recurring: z
    .object({
      frequency: z.enum(["daily", "weekly", "monthly", "yearly"]),
      days_of_week: z.array(z.number().min(0).max(6)).optional(),
      end_date: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
  notification_minutes: z.number().nullable().optional(),
  create_task: z.boolean().optional(),
}).refine(
  (data) => data.all_day !== false || (data.start_time != null && data.start_time !== ""),
  { message: "start_time required when all_day is false", path: ["start_time"] }
);

function makeUlid(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 26);
}

const updateSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  start_time: z.string().nullable().optional(),
  end_time: z.string().nullable().optional(),
  all_day: z.boolean().optional(),
  category_id: z.string().nullable().optional(),
  recurring: z
    .object({
      frequency: z.enum(["daily", "weekly", "monthly", "yearly"]),
      days_of_week: z.array(z.number().min(0).max(6)).optional(),
      end_date: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
  notification_minutes: z.number().nullable().optional(),
});

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

/**
 * GET /api/calendar/events?from=YYYY-MM-DD&to=YYYY-MM-DD
 * Fetch events in range and expand recurring events into individual instances.
 */
router.get("/", async (req, res, next) => {
  try {
    const from = req.query.from as string | undefined;
    const to = req.query.to as string | undefined;

    if (!from || !to) {
      throw new AppError("Query params 'from' and 'to' are required (YYYY-MM-DD)", 400);
    }

    // Fetch base events that start in range OR are recurring (may have started earlier)
    const { data, error } = await supabaseAdmin!
      .from("calendar_events")
      .select("*")
      .eq("user_id", req.user!.id)
      .or(`date.gte.${from},recurring.not.is.null`)
      .lte("date", to)
      .order("date", { ascending: true })
      .order("start_time", { ascending: true });

    if (error) throw new AppError(error.message, 500);

    // Expand recurring events into individual instances within the range
    const expanded = (data ?? []).flatMap((event) =>
      expandRecurring(event as Record<string, unknown>, from, to)
    );

    // Sort flat array by date then start_time
    expanded.sort((a, b) => {
      const dateCmp = (a.date as string).localeCompare(b.date as string);
      if (dateCmp !== 0) return dateCmp;
      const aTime = (a.start_time as string | null) ?? "";
      const bTime = (b.start_time as string | null) ?? "";
      return aTime.localeCompare(bTime);
    });

    res.json(expanded);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/calendar/events
 * Create a new calendar event.
 */
router.post("/", validate(createSchema), async (req, res, next) => {
  try {
    const {
      title,
      description,
      date,
      start_time,
      end_time,
      all_day,
      category_id,
      recurring,
      notification_minutes,
    } = req.body;

    if (category_id) {
      const { data: cat } = await supabaseAdmin!
        .from("calendar_categories")
        .select("id")
        .eq("id", category_id)
        .eq("user_id", req.user!.id)
        .single();
      if (!cat) throw new AppError("Categoria não encontrada", 404);
    }

    const ulid = crypto.randomUUID().replace(/-/g, "").slice(0, 26);

    const { data, error } = await supabaseAdmin!
      .from("calendar_events")
      .insert({
        id: ulid,
        user_id: req.user!.id,
        title,
        description,
        date,
        start_time: start_time ?? null,
        end_time: end_time ?? null,
        all_day,
        category_id: category_id ?? null,
        recurring: recurring ?? null,
        notification_minutes: notification_minutes ?? null,
      })
      .select()
      .single();

    if (error) throw new AppError(error.message, 500);

    if (req.body.create_task && data) {
      const evt = data as Record<string, unknown>;
      const taskPayload: Record<string, unknown> = {
        id: makeUlid(),
        user_id: req.user!.id,
        title: evt.title,
        description: "",
        calendar_event_id: evt.id,
        due_date: evt.date,
      };

      if (!evt.all_day && evt.start_time && evt.end_time) {
        taskPayload.starts_at = `${evt.date}T${evt.start_time}:00`;
        taskPayload.ends_at   = `${evt.date}T${evt.end_time}:00`;
      }

      await supabaseAdmin!.from("tasks").insert(taskPayload);
    }

    res.status(201).json(data);
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/calendar/events/:id
 * Update an existing calendar event.
 * Use the base event ID (without `_date` suffix for recurring instances).
 */
router.put("/:id", validate(updateSchema), async (req, res, next) => {
  try {
    const updates: Record<string, unknown> = {
      ...req.body,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabaseAdmin!
      .from("calendar_events")
      .update(updates)
      .eq("id", req.params.id)
      .eq("user_id", req.user!.id)
      .select()
      .single();

    if (error || !data) {
      throw new AppError("Evento não encontrado", 404);
    }

    const { data: linkedTask } = await supabaseAdmin!
      .from("tasks")
      .select("id")
      .eq("calendar_event_id", req.params.id)
      .eq("user_id", req.user!.id)
      .maybeSingle();

    if (linkedTask) {
      const evt = data as Record<string, unknown>;
      const taskUpdates: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };

      if (req.body.title !== undefined) taskUpdates.title = evt.title;

      if (
        req.body.date !== undefined ||
        req.body.start_time !== undefined ||
        req.body.end_time !== undefined ||
        req.body.all_day !== undefined
      ) {
        taskUpdates.due_date = evt.date;
        if (!evt.all_day && evt.start_time && evt.end_time) {
          taskUpdates.starts_at = `${evt.date}T${evt.start_time}:00`;
          taskUpdates.ends_at   = `${evt.date}T${evt.end_time}:00`;
        } else {
          taskUpdates.starts_at = null;
          taskUpdates.ends_at   = null;
        }
      }

      await supabaseAdmin!
        .from("tasks")
        .update(taskUpdates)
        .eq("id", (linkedTask as Record<string, unknown>).id)
        .eq("user_id", req.user!.id);
    }

    res.json(data);
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/calendar/events/:id
 * Remove a calendar event. Returns 204 No Content.
 * Use the base event ID (without `_date` suffix for recurring instances).
 */
router.delete("/:id", async (req, res, next) => {
  try {
    const { error } = await supabaseAdmin!
      .from("calendar_events")
      .delete()
      .eq("id", req.params.id)
      .eq("user_id", req.user!.id);

    if (error) throw new AppError(error.message, 500);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
