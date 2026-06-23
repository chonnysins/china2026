import { getStore } from "@netlify/blobs";
import { randomUUID } from "node:crypto";

const STORE = "trip-photos";
const INDEX_KEY = "_index.json";
const TAG_RE = /^[a-z0-9_-]{1,32}$/;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_BYTES = 9 * 1024 * 1024; // 9 MB safety cap (client already compresses)

// Read the photo index with STRONG consistency so a write (heart/upload/delete)
// is immediately visible to the very next read. Without this, Netlify Blobs'
// default eventual consistency can serve a stale index for up to 60s, which is
// why a freshly-hearted photo didn't show up in the Favourites carousel.
async function loadIndex(imgStore, idxStore) {
  const list = await idxStore.get(INDEX_KEY, { type: "json" });
  if (Array.isArray(list)) return list;
  // Index missing → one-time migration: rebuild it from any image blobs that
  // were uploaded before the index existed, so old photos aren't lost.
  let items = [];
  try {
    const { blobs } = await imgStore.list();
    items = blobs
      .filter((b) => b.key !== INDEX_KEY)
      .map((b) => ({ id: b.key, tag: b.key.split("/")[0], by: "", day: "", heart: false, ts: 0 }));
  } catch { items = []; }
  await idxStore.setJSON(INDEX_KEY, items);
  return items;
}
async function saveIndex(idxStore, list) {
  await idxStore.setJSON(INDEX_KEY, list);
}
function authorized(req) {
  const expected = process.env.UPLOAD_SECRET || "";
  return !!expected && req.headers.get("x-upload-secret") === expected;
}

export default async (req) => {
  const store = getStore(STORE);                                  // images: fast, cached
  const idx = getStore({ name: STORE, consistency: "strong" });   // index: read-after-write
  const url = new URL(req.url);
  const id = url.searchParams.get("id");

  // ---- serve a single image: GET ?id=<tag>/<uuid> ----
  if (req.method === "GET" && id && !url.searchParams.get("list")) {
    const res = await store.getWithMetadata(id, { type: "arrayBuffer" });
    if (!res) return new Response("Not found", { status: 404 });
    return new Response(res.data, {
      headers: {
        "content-type": (res.metadata && res.metadata.ct) || "image/jpeg",
        "cache-control": "public, max-age=31536000, immutable"
      }
    });
  }

  // ---- list: GET ?list=1[&tag=shanghai][&scope=daily&day=YYYY-MM-DD][&scope=favourites] ----
  if (req.method === "GET" && url.searchParams.get("list")) {
    const tag = url.searchParams.get("tag") || "";
    const scope = url.searchParams.get("scope") || "";
    const day = url.searchParams.get("day") || "";
    let items = await loadIndex(store, idx);
    if (tag) items = items.filter((p) => p.tag === tag);
    if (scope === "favourites") items = items.filter((p) => p.heart);
    if (scope === "daily") items = items.filter((p) => p.day === day);
    items = items.slice().reverse(); // newest first
    return Response.json({ photos: items }, { headers: { "cache-control": "no-store" } });
  }

  // ---- upload: POST multipart/form-data (file, tag, by, day, secret) ----
  if (req.method === "POST") {
    let form;
    try { form = await req.formData(); }
    catch { return new Response("Bad form data", { status: 400 }); }

    const expected = process.env.UPLOAD_SECRET || "";
    if (!expected || form.get("secret") !== expected) {
      return new Response("Unauthorized", { status: 401 });
    }

    const tag = String(form.get("tag") || "");
    if (!TAG_RE.test(tag)) return new Response("Bad tag", { status: 400 });

    const file = form.get("file");
    if (!file || typeof file === "string") return new Response("No file", { status: 400 });
    if (file.size > MAX_BYTES) return new Response("File too large", { status: 413 });

    const by = String(form.get("by") || "").slice(0, 60);
    const dayRaw = String(form.get("day") || "");
    const day = DAY_RE.test(dayRaw) ? dayRaw : "";

    const photoId = `${tag}/${randomUUID()}`;
    const buf = await file.arrayBuffer();
    await store.set(photoId, buf, { metadata: { ct: file.type || "image/jpeg" } });

    const items = await loadIndex(store, idx);
    items.push({ id: photoId, tag, by, day, heart: false, ts: Date.now() });
    await saveIndex(idx, items);

    return Response.json({ ok: true, id: photoId });
  }

  // ---- heart toggle: PATCH ?id=<tag>/<uuid>  (x-upload-secret header) ----
  if (req.method === "PATCH") {
    if (!authorized(req)) return new Response("Unauthorized", { status: 401 });
    if (!id) return new Response("No id", { status: 400 });
    const items = await loadIndex(store, idx);
    const rec = items.find((p) => p.id === id);
    if (!rec) return new Response("Not found", { status: 404 });
    rec.heart = !rec.heart;
    await saveIndex(idx, items);
    return Response.json({ ok: true, heart: rec.heart });
  }

  // ---- delete: DELETE ?id=<tag>/<uuid>  (x-upload-secret header) ----
  if (req.method === "DELETE") {
    if (!authorized(req)) return new Response("Unauthorized", { status: 401 });
    if (!id) return new Response("No id", { status: 400 });
    await store.delete(id);
    const items = await loadIndex(store, idx);
    await saveIndex(idx, items.filter((p) => p.id !== id));
    return Response.json({ ok: true });
  }

  return new Response("Method not allowed", { status: 405 });
};
