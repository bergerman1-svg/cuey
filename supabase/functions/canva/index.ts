// Cuey — "Add from Canva" (Pro): pick one of your Canva designs inside Cuey, it comes in as cues.
// Canva Connect API (app "Cuey", AAHOGOQ3ItU, scopes design:meta:read + design:content:read — read only).
// The client secret (CANVA_CLIENT_SECRET) and the user's Canva tokens stay here on the server; the browser never sees them.
// Actions (POST JSON {action, ...}):
//   start    (signed in)  → {url}          new PKCE verifier + state, saved server-side; the app opens the url
//   finish   (public)     → {ok}           the callback page sends {code, state}; state ties it to the user who started
//   status   (signed in)  → {connected}
//   list     (signed in)  → {items, continuation}   your designs (title, thumbnail, pages)
//   export   (signed in)  → {job}          {design_id, kind:'png'|'mp4'}
//   job      (signed in)  → {job}          {id} → status + download urls (one per page)
//   file     (signed in)  → the file bytes {url} (only export-download.canva.com), for browsers that can't fetch it directly
//   disconnect (signed in)→ {ok}           revoke at Canva + forget the tokens
import { createClient } from "jsr:@supabase/supabase-js@2";

const CLIENT_ID = "OC-AaGI0-gvUqsP";
const REDIRECT = "https://cuey.live/app/canva-callback.html";
const SCOPES = "design:meta:read design:content:read";
const API = "https://api.canva.com/rest/v1";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "content-type, apikey, authorization, x-client-info" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const b64url = (u: Uint8Array) => btoa(String.fromCharCode(...u)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const rnd = (n: number) => b64url(crypto.getRandomValues(new Uint8Array(n)));
const basic = () => "Basic " + btoa(CLIENT_ID + ":" + (Deno.env.get("CANVA_CLIENT_SECRET") || "").trim());

async function userOf(req: Request): Promise<string | null> {
  const tk = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!tk) return null;
  const { data } = await db.auth.getUser(tk);
  return data?.user?.id || null;
}

async function tokenCall(form: Record<string, string>) {
  const r = await fetch(API + "/oauth/token", { method: "POST", headers: { Authorization: basic(), "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(form) });
  const j = await r.json().catch(() => null);
  if (!r.ok || !j?.access_token) { console.error("canva token", r.status, JSON.stringify(j).slice(0, 300)); return null; }
  return j as { access_token: string; refresh_token: string; expires_in: number };
}
async function keep(uid: string, j: { access_token: string; refresh_token: string; expires_in: number }) {
  await db.from("canva_tokens").upsert({ user_id: uid, access_token: j.access_token, refresh_token: j.refresh_token, expires_at: new Date(Date.now() + (j.expires_in - 60) * 1000).toISOString(), updated_at: new Date().toISOString() });
}
// a valid access token for this user (refreshes when needed; refresh tokens are single-use)
async function access(uid: string): Promise<string | null> {
  const { data: row } = await db.from("canva_tokens").select("*").eq("user_id", uid).maybeSingle();
  if (!row) return null;
  if (new Date(row.expires_at).getTime() > Date.now()) return row.access_token;
  const j = await tokenCall({ grant_type: "refresh_token", refresh_token: row.refresh_token });
  if (!j) { // another request may have refreshed it a moment ago
    const { data: again } = await db.from("canva_tokens").select("*").eq("user_id", uid).maybeSingle();
    if (again && again.refresh_token !== row.refresh_token && new Date(again.expires_at).getTime() > Date.now()) return again.access_token;
    await db.from("canva_tokens").delete().eq("user_id", uid); // the link to Canva is gone: connect again
    return null;
  }
  await keep(uid, j);
  return j.access_token;
}
async function canva(uid: string, path: string, init?: RequestInit) {
  const at = await access(uid);
  if (!at) return { status: 401, body: { error: "not_connected" } };
  const r = await fetch(API + path, { ...init, headers: { ...(init?.headers || {}), Authorization: "Bearer " + at, "Content-Type": "application/json" } });
  const body = await r.json().catch(() => ({}));
  if (r.status === 401) { await db.from("canva_tokens").delete().eq("user_id", uid); return { status: 401, body: { error: "not_connected" } }; }
  return { status: r.status, body };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  if (!(Deno.env.get("CANVA_CLIENT_SECRET") || "").trim()) return json({ error: "not_configured" }, 503);
  let b: any; try { b = await req.json(); } catch { return json({ error: "bad_json" }, 400); }
  const action = String(b?.action || "");

  if (action === "finish") { // from cuey.live/app/canva-callback.html — no Cuey session there (desktop users finish in their browser)
    const state = String(b?.state || ""), code = String(b?.code || "");
    if (!/^[A-Za-z0-9_-]{20,80}$/.test(state) || !code || code.length > 2000) return json({ error: "bad_request" }, 400);
    const { data: row } = await db.from("canva_auth").delete().eq("state", state).select().maybeSingle(); // one use only
    if (!row || Date.now() - new Date(row.created_at).getTime() > 15 * 60 * 1000) return json({ error: "expired" }, 410);
    const j = await tokenCall({ grant_type: "authorization_code", code, code_verifier: row.verifier, redirect_uri: REDIRECT });
    if (!j) return json({ error: "exchange" }, 502);
    await keep(row.user_id, j);
    return json({ ok: true });
  }

  const uid = await userOf(req);
  if (!uid) return json({ error: "sign_in" }, 401);

  if (action === "start") {
    const verifier = rnd(48), state = rnd(24);
    const ch = b64url(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))));
    const { error } = await db.from("canva_auth").insert({ state, user_id: uid, verifier });
    if (error) return json({ error: "db" }, 500);
    const q = new URLSearchParams({ code_challenge: ch, code_challenge_method: "s256", response_type: "code", client_id: CLIENT_ID, scope: SCOPES, redirect_uri: REDIRECT, state });
    return json({ url: "https://www.canva.com/api/oauth/authorize?" + q.toString() });
  }
  if (action === "status") {
    const { data } = await db.from("canva_tokens").select("user_id").eq("user_id", uid).maybeSingle();
    return json({ connected: !!data });
  }
  if (action === "list") {
    const q = new URLSearchParams({ limit: "30", sort_by: b?.query ? "relevance" : "modified_descending" });
    if (b?.query) q.set("query", String(b.query).slice(0, 255));
    if (b?.continuation) q.set("continuation", String(b.continuation).slice(0, 2000));
    const r = await canva(uid, "/designs?" + q.toString());
    if (r.status !== 200) return json(r.body, r.status);
    const items = ((r.body as any).items || []).map((d: any) => ({ id: d.id, title: d.title || "", pages: d.page_count || 0, thumb: d.thumbnail?.url || "", w: d.thumbnail?.width || 0, h: d.thumbnail?.height || 0, updated: d.updated_at || 0 }));
    return json({ items, continuation: (r.body as any).continuation || null });
  }
  if (action === "export") {
    const id = String(b?.design_id || "");
    if (!/^[A-Za-z0-9_-]{4,40}$/.test(id)) return json({ error: "bad_request" }, 400);
    const format = b?.kind === "mp4" ? { type: "mp4", quality: "horizontal_1080p" } : { type: "png", width: 1920 };
    const r = await canva(uid, "/exports", { method: "POST", body: JSON.stringify({ design_id: id, format }) });
    return json(r.status === 200 ? { job: (r.body as any).job } : r.body, r.status);
  }
  if (action === "job") {
    const id = String(b?.id || "");
    if (!/^[A-Za-z0-9_-]{4,80}$/.test(id)) return json({ error: "bad_request" }, 400);
    const r = await canva(uid, "/exports/" + id);
    return json(r.status === 200 ? { job: (r.body as any).job } : r.body, r.status);
  }
  if (action === "file") {
    let u: URL; try { u = new URL(String(b?.url || "")); } catch { return json({ error: "bad_request" }, 400); }
    if (u.protocol !== "https:" || !/(^|\.)canva\.com$/.test(u.hostname)) return json({ error: "bad_request" }, 400);
    const r = await fetch(u.toString());
    if (!r.ok || !r.body) return json({ error: "download" }, 502);
    return new Response(r.body, { headers: { ...cors, "Content-Type": r.headers.get("Content-Type") || "application/octet-stream" } });
  }
  if (action === "disconnect") {
    const { data: row } = await db.from("canva_tokens").select("refresh_token").eq("user_id", uid).maybeSingle();
    if (row) await fetch(API + "/oauth/revoke", { method: "POST", headers: { Authorization: basic(), "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ token: row.refresh_token }) }).catch(() => {});
    await db.from("canva_tokens").delete().eq("user_id", uid);
    return json({ ok: true });
  }
  return json({ error: "action" }, 400);
});
