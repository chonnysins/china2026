import { getStore } from "@netlify/blobs";

const STORE = "trip-checklist";
const KEY = "items.json";

function authorized(req) {
  const expected = process.env.UPLOAD_SECRET || "";
  return !!expected && req.headers.get("x-upload-secret") === expected;
}

export default async (req) => {
  // Strong consistency so a tick/add is immediately visible on the next read.
  const store = getStore({ name: STORE, consistency: "strong" });

  if (req.method === "GET") {
    const items = await store.get(KEY, { type: "json" });
    return Response.json(
      { items: Array.isArray(items) ? items : [] },
      { headers: { "cache-control": "no-store" } }
    );
  }

  if (req.method === "PUT") {
    if (!authorized(req)) return new Response("Unauthorized", { status: 401 });
    let body;
    try { body = await req.json(); }
    catch { return new Response("Bad JSON", { status: 400 }); }
    const items = Array.isArray(body.items)
      ? body.items.slice(0, 200).map((it) => ({
          id: String(it.id || "").slice(0, 40),
          text: String(it.text || "").slice(0, 200),
          done: !!it.done
        })).filter((it) => it.text)
      : [];
    await store.setJSON(KEY, items);
    return Response.json({ ok: true, items });
  }

  return new Response("Method not allowed", { status: 405 });
};
