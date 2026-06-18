import { db } from "../../db/index.js";
import { users, quotes } from "../../db/schema.js";
import { eq, and, sql } from "drizzle-orm";

export default async (req) => {
  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/\.netlify\/functions\/api/, "").replace(/^\/api/, "");
  const method = req.method;
  const body = req.body ? await req.json() : {};

  try {
    // ─── HEALTH CHECK ───────────────────────────────
    if (path === "/ping" && method === "GET") {
      return json(200, { ok: true });
    }

    // ─── USERS ─────────────────────────────────────
    if (path === "/users/register" && method === "POST") {
      const { email, password, username, gender, role, tokenLimit } = body;
      if (!email || !password || !username) {
        return json(400, { error: "Email, password e username obbligatori" });
      }
      const existing = await db.select().from(users).where(eq(users.email, email));
      if (existing.length > 0) {
        return json(409, { error: "Email già registrata" });
      }
      const [created] = await db.insert(users).values({
        email, password, username, gender,
        role: role || "user",
        tokenLimit: tokenLimit || 1000000,
      }).returning();
      return json(201, {
        success: true,
        user: {
          email: created.email, username: created.username, gender: created.gender,
          role: created.role, createdAt: created.createdAt,
          tokensUsed: created.tokensUsed, tokenLimit: created.tokenLimit,
        }
      });
    }

    if (path === "/users/login" && method === "POST") {
      const { email, password } = body;
      const [found] = await db.select().from(users).where(and(eq(users.email, email), eq(users.password, password)));
      if (!found) {
        return json(401, { error: "Email o password errati" });
      }
      return json(200, {
        success: true,
        user: {
          email: found.email, username: found.username, gender: found.gender,
          role: found.role, createdAt: found.createdAt,
          tokensUsed: found.tokensUsed, tokenLimit: found.tokenLimit,
        }
      });
    }

    if (path === "/users" && method === "GET") {
      const list = await db.select({
        email: users.email, username: users.username, gender: users.gender,
        role: users.role, createdAt: users.createdAt,
        tokensUsed: users.tokensUsed, tokenLimit: users.tokenLimit,
      }).from(users).orderBy(sql`created_at DESC`);
      return json(200, list);
    }

    if (path.startsWith("/users/") && path.endsWith("/profile") && method === "GET") {
      const email = decodeURIComponent(path.replace("/users/", "").replace("/profile", ""));
      const [found] = await db.select().from(users).where(eq(users.email, email));
      if (!found) return json(404, { error: "Utente non trovato" });
      return json(200, {
        email: found.email, username: found.username, gender: found.gender,
        role: found.role, tokensUsed: found.tokensUsed, tokenLimit: found.tokenLimit,
      });
    }

    if (path === "/users/limits" && method === "PATCH") {
      const { email, tokenLimit } = body;
      if (!email || tokenLimit === undefined) return json(400, { error: "Email e tokenLimit richiesti" });
      await db.update(users).set({ tokenLimit }).where(eq(users.email, email));
      return json(200, { success: true });
    }

    if (path === "/users/tokens" && method === "POST") {
      const { email, tokens } = body;
      if (!email || !tokens) return json(400, { error: "Email e tokens richiesti" });
      await db.update(users).set({
        tokensUsed: sql`tokens_used + ${tokens}`
      }).where(eq(users.email, email));
      return json(200, { success: true });
    }

    // ─── QUOTES ─────────────────────────────────────
    if (path === "/quotes" && method === "GET") {
      const userEmail = url.searchParams.get("email");
      if (!userEmail) return json(400, { error: "Email richiesta" });
      const list = await db.select().from(quotes).where(eq(quotes.userEmail, userEmail)).orderBy(sql`created_at DESC`);
      return json(200, list);
    }

    if (path === "/quotes/all" && method === "GET") {
      const list = await db.select().from(quotes).orderBy(sql`created_at DESC`);
      return json(200, list);
    }

    if (path === "/quotes" && method === "POST") {
      const { email, quote } = body;
      if (!email || !quote) return json(400, { error: "Email e quote richiesti" });

      // Upsert: try insert, on conflict update
      const existing = await db.select().from(quotes).where(eq(quotes.id, quote.id));
      if (existing.length > 0) {
        const [updated] = await db.update(quotes).set({
          title: quote.title, client: quote.client, date: quote.date,
          intro: quote.intro, color: quote.color, vat: quote.vat,
          status: quote.status || "BOZZA", owner: quote.owner,
          options: JSON.stringify(quote.options || []),
          clauses: JSON.stringify(quote.clauses || []),
          updatedAt: sql`now()`,
        }).where(eq(quotes.id, quote.id)).returning();
        return json(200, updated);
      }

      const [saved] = await db.insert(quotes).values({
        id: quote.id, userEmail: email, title: quote.title, client: quote.client,
        date: quote.date, intro: quote.intro, color: quote.color, vat: quote.vat,
        status: quote.status || "BOZZA", owner: quote.owner,
        options: JSON.stringify(quote.options || []),
        clauses: JSON.stringify(quote.clauses || []),
      }).returning();
      return json(201, saved);
    }

    if (path.startsWith("/quotes/") && method === "DELETE") {
      const quoteId = path.replace("/quotes/", "");
      await db.delete(quotes).where(eq(quotes.id, quoteId));
      return json(200, { success: true });
    }

    // ─── ADMIN SEED (create or update admin silently) ─
    if (path === "/admin/seed" && method === "POST") {
      const { email, password, username, gender, tokenLimit } = body;
      const [existing] = await db.select().from(users).where(eq(users.email, email));
      if (existing) {
        await db.update(users).set({ role: "admin", tokenLimit: tokenLimit || 999999999 }).where(eq(users.email, email));
      } else {
        await db.insert(users).values({ email, password, username, gender, role: "admin", tokenLimit: tokenLimit || 999999999 });
      }
      return json(200, { success: true });
    }

    // ─── DEEPSEEK STATUS CHECK (debug) ─────────────
    if (path === "/admin/deepseek-status" && method === "GET") {
      const hasKey = !!process.env.DEEPSEEK_API_KEY;
      return json(200, {
        configured: hasKey,
      });
    }

    // ─── AI CHAT PROXY (env var only — key never reaches client) ─
    if (path === "/ai/chat" && method === "POST") {
      const apiKey = process.env.DEEPSEEK_API_KEY;
      if (!apiKey) {
        console.error('[DeepSeek] DEEPSEEK_API_KEY env var not set — check Netlify → Site settings → Environment variables → scoped to Functions');
        return json(503, { error: "DeepSeek non configurato. L'amministratore deve impostare DEEPSEEK_API_KEY nelle variabili d'ambiente di Netlify (scope: Functions)." });
      }
      console.log('[DeepSeek] Proxying chat request with Netlify environment configuration');
      const { model, messages, response_format, temperature } = body;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 25000);
      let res;
      try {
        res = await fetch("https://api.deepseek.com/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
          body: JSON.stringify({
            model: model || "deepseek-chat",
            messages,
            response_format: response_format || { type: "json_object" },
            temperature: temperature ?? 0.7,
          }),
          signal: controller.signal,
        });
      } catch (err) {
        if (err.name === "AbortError") {
          console.error("[DeepSeek] Request timed out after 25 seconds");
          return json(504, { error: "DeepSeek non ha risposto entro 25 secondi. Riprova con un prompt più breve o tra qualche istante." });
        }
        throw err;
      } finally {
        clearTimeout(timeout);
      }
      if (!res.ok) {
        const errBody = await res.text().catch(() => "Unknown error");
        if (res.status === 402) return json(402, { error: "Credito DeepSeek esaurito. Ricarica su platform.deepseek.com" });
        if (res.status === 401) return json(401, { error: "Chiave API DeepSeek non valida" });
        if (res.status === 429) return json(429, { error: "Troppe richieste a DeepSeek. Attendi qualche secondo e riprova." });
        return json(res.status, { error: `DeepSeek (${res.status}): ${errBody.substring(0, 200)}` });
      }
      const data = await res.json();
      return json(200, data);
    }

    return json(404, { error: "Endpoint non trovato" });
  } catch (err) {
    console.error("API error:", err);
    return json(500, { error: err.message });
  }
};

function json(status, data) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const config = {
  path: "/api/*",
};
