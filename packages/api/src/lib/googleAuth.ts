import { google } from "googleapis";
import { createHmac } from "crypto";
import { encrypt, decrypt } from "./crypto.js";
import { supabaseAdmin } from "./supabase.js";
import { AppError } from "../middleware/error.js";

const SCOPES = ["https://www.googleapis.com/auth/calendar.events"];

export function createOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

export function createState(userId: string): string {
  const hmac = createHmac("sha256", process.env.GOOGLE_TOKEN_ENCRYPTION_KEY!);
  hmac.update(userId);
  const sig = hmac.digest("hex");
  return Buffer.from(`${userId}:${sig}`).toString("base64url");
}

export function verifyState(state: string): string | null {
  try {
    const decoded = Buffer.from(state, "base64url").toString("utf8");
    const colonIdx = decoded.indexOf(":");
    if (colonIdx === -1) return null;
    const userId = decoded.slice(0, colonIdx);
    const sig = decoded.slice(colonIdx + 1);
    const hmac = createHmac("sha256", process.env.GOOGLE_TOKEN_ENCRYPTION_KEY!);
    hmac.update(userId);
    const expected = hmac.digest("hex");
    if (sig !== expected) return null;
    return userId;
  } catch {
    return null;
  }
}

export function getAuthUrl(userId: string): string {
  const oauth2Client = createOAuth2Client();
  return oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
    prompt: "consent",
    state: createState(userId),
  });
}

export async function getValidAccessToken(userId: string): Promise<string> {
  const { data, error } = await supabaseAdmin!
    .from("google_calendar_tokens")
    .select("access_token, refresh_token, expires_at")
    .eq("user_id", userId)
    .single();

  if (error || !data)
    throw new AppError("Google Calendar não conectado", 400);

  const expiresAt = new Date(data.expires_at as string);
  const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000);

  if (expiresAt < fiveMinutesFromNow) {
    const oauth2Client = createOAuth2Client();
    oauth2Client.setCredentials({
      refresh_token: decrypt(data.refresh_token as string),
    });

    const { credentials } = await oauth2Client.refreshAccessToken();
    if (!credentials.access_token || !credentials.expiry_date) {
      throw new AppError("Falha ao renovar token Google", 500);
    }

    await supabaseAdmin!
      .from("google_calendar_tokens")
      .update({
        access_token: encrypt(credentials.access_token),
        expires_at: new Date(credentials.expiry_date).toISOString(),
      })
      .eq("user_id", userId);

    return credentials.access_token;
  }

  return decrypt(data.access_token as string);
}
