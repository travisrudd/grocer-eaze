type AuthEnv = {
  DB: D1Database;
  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;
  AUTH_SECRET?: string;
  INITIAL_ADMIN_EMAIL?: string;
  INITIAL_ADMIN_EMAILS?: string;
};

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: "user" | "admin";
  accessStatus: string;
  complimentaryUntil: string | null;
  billingExempt: boolean;
  subscriptionStatus: string | null;
  subscriptionEndsAt: string | null;
  hasAccess: boolean;
};

const cookieName = "grocer_eaze_session";

function initialAdminEmails(env: AuthEnv) {
  return new Set(
    [env.INITIAL_ADMIN_EMAIL, ...(env.INITIAL_ADMIN_EMAILS || "").split(",")]
      .map((email) => String(email || "").trim().toLowerCase())
      .filter(Boolean),
  );
}

export function hasProductAccess(user: Omit<SessionUser, "hasAccess"> | SessionUser | null) {
  if (!user || user.accessStatus === "suspended") return false;
  if (user.role === "admin" || user.billingExempt) return true;
  if (user.accessStatus === "complimentary") {
    if (!user.complimentaryUntil || new Date(user.complimentaryUntil).getTime() > Date.now()) return true;
  }
  return ["active", "trialing"].includes(user.subscriptionStatus || "")
    || ["active", "trialing"].includes(user.accessStatus);
}

function response(value: unknown, status = 200, headers?: HeadersInit) {
  return Response.json(value, { status, headers: { "Cache-Control": "no-store", ...headers } });
}

async function digest(value: string) {
  const bytes = new TextEncoder().encode(value);
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))].map((item) => item.toString(16).padStart(2, "0")).join("");
}

function constantTimeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index++) difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
}

function cookies(request: Request) {
  return Object.fromEntries((request.headers.get("cookie") || "").split(";").map((item) => item.trim().split("=")).filter(([key]) => key));
}

async function requestJsonWithinLimit<T>(request: Request, maximumBytes: number): Promise<T> {
  const declaredBytes = Number(request.headers.get("content-length") || 0);
  if (declaredBytes > maximumBytes) throw new Error("REQUEST_TOO_LARGE");
  if (!request.body) throw new Error("INVALID_JSON");
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let received = 0;
  let text = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > maximumBytes) { await reader.cancel(); throw new Error("REQUEST_TOO_LARGE"); }
    text += decoder.decode(value, { stream: true });
  }
  try { return JSON.parse(text + decoder.decode()) as T; }
  catch { throw new Error("INVALID_JSON"); }
}

export async function ensureAuthSchema(db: D1Database) {
  await db.batch([
    db.prepare("CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, name TEXT NOT NULL, phone TEXT NOT NULL DEFAULT '', role TEXT NOT NULL DEFAULT 'user', access_status TEXT NOT NULL DEFAULT 'pending', trial_ends_at TEXT, complimentary_until TEXT, billing_exempt INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)"),
    db.prepare("CREATE INDEX IF NOT EXISTS users_email_idx ON users(email)"),
    db.prepare("CREATE TABLE IF NOT EXISTS auth_codes (email TEXT PRIMARY KEY, code_hash TEXT NOT NULL, name TEXT NOT NULL, phone TEXT NOT NULL DEFAULT '', expires_at TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL)"),
    db.prepare("CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires_at TEXT NOT NULL, created_at TEXT NOT NULL)"),
    db.prepare("CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id)"),
    db.prepare("CREATE TABLE IF NOT EXISTS auth_rate_limits (id TEXT PRIMARY KEY, attempts INTEGER NOT NULL DEFAULT 0, expires_at TEXT NOT NULL)"),
    db.prepare("CREATE INDEX IF NOT EXISTS auth_rate_limits_expires_idx ON auth_rate_limits(expires_at)"),
    db.prepare("CREATE TABLE IF NOT EXISTS admin_audit_log (id TEXT PRIMARY KEY, admin_user_id TEXT NOT NULL, target_user_id TEXT NOT NULL, action TEXT NOT NULL, detail_json TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL)"),
  ]);
}

export async function rateLimit(request: Request, env: AuthEnv, action: string, limit: number, subject = "", subjectLimit = limit) {
  const address = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const bucket = Math.floor(Date.now() / (15 * 60_000));
  const identifiers = [
    await digest(`${action}:ip:${address}:${bucket}:${env.AUTH_SECRET || ""}`),
    ...(subject ? [await digest(`${action}:subject:${subject}:${bucket}:${env.AUTH_SECRET || ""}`)] : []),
  ];
  const expiresAt = new Date((bucket + 1) * 15 * 60_000).toISOString();
  await env.DB.prepare("DELETE FROM auth_rate_limits WHERE expires_at <= ?").bind(new Date().toISOString()).run();
  const results = await env.DB.batch(identifiers.map((id) => env.DB.prepare("INSERT INTO auth_rate_limits(id,attempts,expires_at) VALUES(?,1,?) ON CONFLICT(id) DO UPDATE SET attempts=attempts+1 RETURNING attempts").bind(id, expiresAt)));
  return results.every((result, index) => Number(result.results?.[0]?.attempts || 0) <= (index === 0 ? limit : subjectLimit));
}

async function createSession(userId: string, env: AuthEnv) {
  const now = new Date();
  const tokenBytes = crypto.getRandomValues(new Uint8Array(32));
  const token = [...tokenBytes].map((item) => item.toString(16).padStart(2, "0")).join("");
  await env.DB.prepare("DELETE FROM sessions WHERE expires_at <= ?").bind(now.toISOString()).run();
  await env.DB.prepare("INSERT INTO sessions(token_hash,user_id,expires_at,created_at) VALUES(?,?,?,?)")
    .bind(await digest(token), userId, new Date(now.getTime() + 30 * 86400_000).toISOString(), now.toISOString()).run();
  return `${cookieName}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000`;
}

export async function getSessionUser(request: Request, env: AuthEnv): Promise<SessionUser | null> {
  const token = cookies(request)[cookieName];
  if (!token) return null;
  await ensureAuthSchema(env.DB);
  const tokenHash = await digest(token);
  const row = await env.DB.prepare("SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ?").bind(tokenHash, new Date().toISOString()).first();
  if (!row) return null;
  const user: Omit<SessionUser, "hasAccess"> = {
    id: String(row.id), name: String(row.name), email: String(row.email), phone: String(row.phone || ""),
    role: row.role === "admin" ? "admin" : "user", accessStatus: String(row.access_status),
    complimentaryUntil: row.complimentary_until ? String(row.complimentary_until) : null, billingExempt: Boolean(row.billing_exempt),
    subscriptionStatus: row.subscription_status ? String(row.subscription_status) : null,
    subscriptionEndsAt: row.subscription_ends_at ? String(row.subscription_ends_at) : null,
  };
  return { ...user, hasAccess: hasProductAccess(user) };
}

async function sendCode(email: string, code: string, env: AuthEnv) {
  if (!env.RESEND_API_KEY || !env.EMAIL_FROM) throw new Error("Email delivery is unavailable.");
  const sent = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json", "User-Agent": "Grocer-Eaze/1.0 (https://grocer-eaze.com)" },
    body: JSON.stringify({ from: env.EMAIL_FROM, to: [email], subject: `${code} is your Grocer-Eaze sign-in code`, html: `<h1>Your sign-in code is ${code}</h1><p>It expires in 10 minutes. If you did not request this, you can ignore this email.</p>` }),
  });
  if (!sent.ok) {
    console.error("Resend verification email failed", { status: sent.status });
    throw new Error(`Could not send verification email (${sent.status}).`);
  }
}

async function sendAccountNotFound(email: string, env: AuthEnv) {
  if (!env.RESEND_API_KEY || !env.EMAIL_FROM) throw new Error("Email delivery is unavailable.");
  const sent = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json", "User-Agent": "Grocer-Eaze/1.0 (https://grocer-eaze.com)" },
    body: JSON.stringify({
      from: env.EMAIL_FROM,
      to: [email],
      subject: "Your Grocer-Eaze sign-in request",
      html: "<h1>No Grocer-Eaze account is connected to this email yet.</h1><p>If you made this request, return to Grocer-Eaze and choose <strong>Create account</strong>. If you did not request this, you can ignore this email.</p>",
    }),
  });
  if (!sent.ok) throw new Error("Could not send account guidance.");
}

export async function handleAuthRequest(request: Request, env: AuthEnv): Promise<Response | null> {
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/api/auth/") && !url.pathname.startsWith("/api/admin/")) return null;
  await ensureAuthSchema(env.DB);

  if (url.pathname === "/api/auth/me" && request.method === "GET") return response({ user: await getSessionUser(request, env) });

  if (url.pathname === "/api/auth/start" && request.method === "POST") {
    if (!env.AUTH_SECRET) return response({ error: "Secure signup is being configured. Please try again shortly." }, 503);
    let body: { intent?: string; name?: string; email?: string; phone?: string };
    try { body = await requestJsonWithinLimit(request, 16_384); }
    catch (error) { return response({ error: error instanceof Error && error.message === "REQUEST_TOO_LARGE" ? "That request is too large." : "Enter valid sign-in information." }, error instanceof Error && error.message === "REQUEST_TOO_LARGE" ? 413 : 400); }
    const intent = body.intent === "signup" ? "signup" : body.intent === "signin" ? "signin" : "";
    const email = String(body.email || "").trim().toLowerCase().slice(0, 254);
    const submittedName = String(body.name || "").trim().slice(0, 100);
    const phone = String(body.phone || "").trim();
    if (!intent || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || phone.length > 30) return response({ error: "Enter a valid email address." }, 400);
    if (intent === "signup" && submittedName.length < 2) return response({ error: "Enter your name to create an account." }, 400);
    if (!await rateLimit(request, env, "email-start", 12, email, 4)) return response({ error: "Too many sign-in attempts. Please try again in 15 minutes." }, 429);
    await env.DB.prepare("DELETE FROM auth_codes WHERE expires_at <= ?").bind(new Date().toISOString()).run();
    const existingUser = await env.DB.prepare("SELECT name,phone FROM users WHERE email = ?").bind(email).first();
    if (intent === "signin" && !existingUser) {
      try { await sendAccountNotFound(email, env); }
      catch { return response({ error: "Email delivery is temporarily unavailable. Please try again." }, 502); }
      return response({ sent: true });
    }
    const name = intent === "signup" ? submittedName : String(existingUser?.name || "");
    const savedPhone = intent === "signup" ? phone : String(existingUser?.phone || "");
    const recent = await env.DB.prepare("SELECT created_at FROM auth_codes WHERE email = ?").bind(email).first();
    if (recent && Date.now() - new Date(String(recent.created_at)).getTime() < 60_000) return response({ error: "Please wait a minute before requesting another code." }, 429);
    const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000).padStart(6, "0");
    const codeHash = await digest(`${email}:${code}:${env.AUTH_SECRET}`);
    const now = new Date();
    await env.DB.prepare("INSERT OR REPLACE INTO auth_codes(email, code_hash, name, phone, expires_at, attempts, created_at) VALUES(?,?,?,?,?,?,?)")
      .bind(email, codeHash, name, savedPhone, new Date(now.getTime() + 10 * 60_000).toISOString(), 0, now.toISOString()).run();
    try { await sendCode(email, code, env); }
    catch {
      await env.DB.prepare("DELETE FROM auth_codes WHERE email = ?").bind(email).run();
      return response({ error: "Email delivery is temporarily unavailable. Please try again." }, 502);
    }
    return response({ sent: true });
  }

  if (url.pathname === "/api/auth/verify" && request.method === "POST") {
    if (!env.AUTH_SECRET) return response({ error: "Secure signup is being configured. Please try again shortly." }, 503);
    let body: { email?: string; code?: string };
    try { body = await requestJsonWithinLimit(request, 8_192); }
    catch (error) { return response({ error: error instanceof Error && error.message === "REQUEST_TOO_LARGE" ? "That request is too large." : "Enter a valid verification code." }, error instanceof Error && error.message === "REQUEST_TOO_LARGE" ? 413 : 400); }
    const email = String(body.email || "").trim().toLowerCase().slice(0, 254);
    const code = String(body.code || "").trim().slice(0, 6);
    if (!await rateLimit(request, env, "email-verify", 30, email, 10)) return response({ error: "Too many verification attempts. Please try again in 15 minutes." }, 429);
    const record = await env.DB.prepare("SELECT * FROM auth_codes WHERE email = ?").bind(email).first();
    if (!record || new Date(String(record.expires_at)).getTime() < Date.now() || Number(record.attempts) >= 5) return response({ error: "That code expired. Request a new one." }, 400);
    const expected = await digest(`${email}:${code}:${env.AUTH_SECRET}`);
    if (!constantTimeEqual(expected, String(record.code_hash))) {
      await env.DB.prepare("UPDATE auth_codes SET attempts = attempts + 1 WHERE email = ?").bind(email).run();
      return response({ error: "That code is incorrect." }, 400);
    }
    const now = new Date();
    const existing = await env.DB.prepare("SELECT id FROM users WHERE email = ?").bind(email).first();
    const id = existing ? String(existing.id) : crypto.randomUUID();
    const isInitialAdmin = initialAdminEmails(env).has(email);
    await env.DB.prepare("INSERT INTO users(id,email,name,phone,role,access_status,trial_ends_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(email) DO UPDATE SET name=excluded.name, phone=excluded.phone, role=CASE WHEN ? = 1 THEN 'admin' ELSE users.role END, updated_at=excluded.updated_at")
      .bind(id, email, record.name, record.phone, isInitialAdmin ? "admin" : "user", "pending", null, now.toISOString(), now.toISOString(), isInitialAdmin ? 1 : 0).run();
    const sessionCookie = await createSession(id, env);
    await env.DB.prepare("DELETE FROM auth_codes WHERE email = ?").bind(email).run();
    return response({ verified: true }, 200, { "Set-Cookie": sessionCookie });
  }

  if (url.pathname === "/api/auth/signout" && request.method === "POST") {
    const token = cookies(request)[cookieName];
    if (token) await env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(await digest(token)).run();
    return response({ signedOut: true }, 200, { "Set-Cookie": `${cookieName}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0` });
  }

  const admin = await getSessionUser(request, env);
  if (!admin || admin.role !== "admin") return response({ error: "Administrator access required." }, 403);

  if (url.pathname === "/api/admin/users" && request.method === "POST") {
    let body: { q?: string };
    try { body = await requestJsonWithinLimit(request, 8_192); }
    catch (error) { return response({ error: error instanceof Error && error.message === "REQUEST_TOO_LARGE" ? "That search is too large." : "Enter a valid search." }, error instanceof Error && error.message === "REQUEST_TOO_LARGE" ? 413 : 400); }
    const query = `%${String(body.q || "").trim().slice(0, 200)}%`;
    const result = await env.DB.prepare("SELECT id,email,name,phone,role,access_status,trial_ends_at,complimentary_until,billing_exempt,created_at FROM users WHERE email LIKE ? OR name LIKE ? ORDER BY created_at DESC LIMIT 100").bind(query, query).all();
    return response({ users: result.results });
  }

  if (url.pathname === "/api/admin/users" && request.method === "PATCH") {
    let body: { userId?: string; action?: string; until?: string | null };
    try { body = await requestJsonWithinLimit(request, 8_192); }
    catch { return response({ error: "Enter a valid account update." }, 400); }
    if (!body.userId) return response({ error: "A user is required." }, 400);
    const allowed = ["grant_complimentary", "revoke_complimentary", "billing_exempt", "billing_required", "suspend", "activate", "make_admin", "remove_admin"];
    if (!allowed.includes(String(body.action))) return response({ error: "Unsupported action." }, 400);
    if (body.userId === admin.id && ["suspend", "remove_admin"].includes(String(body.action))) return response({ error: "Administrators cannot suspend themselves or remove their own administrator role." }, 400);
    const updates: Record<string, string | number | null> = {
      grant_complimentary: "complimentary", revoke_complimentary: "pending", suspend: "suspended", activate: "active",
      make_admin: "admin", remove_admin: "user",
    };
    if (body.action === "billing_exempt" || body.action === "billing_required") {
      await env.DB.prepare("UPDATE users SET billing_exempt = ?, updated_at = ? WHERE id = ?").bind(body.action === "billing_exempt" ? 1 : 0, new Date().toISOString(), body.userId).run();
    } else if (body.action === "make_admin" || body.action === "remove_admin") {
      await env.DB.prepare("UPDATE users SET role = ?, updated_at = ? WHERE id = ?").bind(updates[body.action], new Date().toISOString(), body.userId).run();
    } else {
      await env.DB.prepare("UPDATE users SET access_status = ?, complimentary_until = ?, updated_at = ? WHERE id = ?").bind(updates[body.action], body.action === "grant_complimentary" ? body.until || null : null, new Date().toISOString(), body.userId).run();
    }
    await env.DB.prepare("INSERT INTO admin_audit_log(id,admin_user_id,target_user_id,action,detail_json,created_at) VALUES(?,?,?,?,?,?)").bind(crypto.randomUUID(), admin.id, body.userId, body.action, JSON.stringify({ until: body.until || null }), new Date().toISOString()).run();
    return response({ saved: true });
  }

  if (url.pathname === "/api/admin/audit" && request.method === "GET") {
    const result = await env.DB.prepare("SELECT a.*, u.email AS target_email FROM admin_audit_log a LEFT JOIN users u ON u.id = a.target_user_id ORDER BY a.created_at DESC LIMIT 100").all();
    return response({ events: result.results });
  }
  return response({ error: "Not found." }, 404);
}
