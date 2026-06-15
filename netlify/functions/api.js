import { db } from "../../db/index.js";
import { users, quotes } from "../../db/schema.js";
import { eq, and, sql } from "drizzle-orm";

export default async (req) => {
  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/\.netlify\/functions\/api/, "");
  const method = req.method;
  const body = req.body ? await req.json() : {};

  try {
    // ─── USERS ─────────────────────────────────────
    if (path === "/users/register" && method === "POST") {
      const { email, password, username, gender } = body;
      if (!email || !password || !username) {
        return json(400, { error: "Email, password e username obbligatori" });
      }
      const existing = await db.select().from(users).where(eq(users.email, email));
      if (existing.length > 0) {
        return json(409, { error: "Email già registrata" });
      }
      const [created] = await db.insert(users).values({ email, password, username, gender }).returning();
      return json(201, { success: true, user: { email: created.email, username: created.username, gender: created.gender, createdAt: created.createdAt } });
    }

    if (path === "/users/login" && method === "POST") {
      const { email, password } = body;
      const [found] = await db.select().from(users).where(and(eq(users.email, email), eq(users.password, password)));
      if (!found) {
        return json(401, { error: "Email o password errati" });
      }
      return json(200, { success: true, user: { email: found.email, username: found.username, gender: found.gender, createdAt: found.createdAt } });
    }

    // ─── QUOTES ─────────────────────────────────────
    if (path === "/quotes" && method === "GET") {
      const userEmail = url.searchParams.get("email");
      if (!userEmail) return json(400, { error: "Email richiesta" });
      const list = await db.select().from(quotes).where(eq(quotes.userEmail, userEmail)).orderBy(sql`created_at DESC`);
      return json(200, list);
    }

    if (path === "/quotes" && method === "POST") {
      const { email, quote } = body;
      if (!email || !quote) return json(400, { error: "Email e quote richiesti" });
      const [saved] = await db.insert(quotes).values({
        id: quote.id,
        userEmail: email,
        title: quote.title,
        client: quote.client,
        date: quote.date,
        intro: quote.intro,
        color: quote.color,
        vat: quote.vat,
        status: quote.status || "BOZZA",
        owner: quote.owner,
        options: JSON.stringify(quote.options || []),
        clauses: JSON.stringify(quote.clauses || []),
      }).returning();
      return json(201, saved);
    }

    if (path.startsWith("/quotes/") && method === "PUT") {
      const quoteId = path.replace("/quotes/", "");
      const { quote } = body;
      if (!quote) return json(400, { error: "Quote richiesto" });
      const [updated] = await db.update(quotes).set({
        title: quote.title,
        client: quote.client,
        date: quote.date,
        intro: quote.intro,
        color: quote.color,
        vat: quote.vat,
        status: quote.status,
        owner: quote.owner,
        options: JSON.stringify(quote.options || []),
        clauses: JSON.stringify(quote.clauses || []),
        updatedAt: sql`now()`,
      }).where(eq(quotes.id, quoteId)).returning();
      return json(200, updated);
    }

    if (path.startsWith("/quotes/") && method === "DELETE") {
      const quoteId = path.replace("/quotes/", "");
      await db.delete(quotes).where(eq(quotes.id, quoteId));
      return json(200, { success: true });
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
