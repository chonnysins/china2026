import { getStore } from "@netlify/blobs";
import { randomUUID } from "node:crypto";

const STORE = "trip-photos";
const TAG_RE = /^[a-z0-9_-]{1,32}$/;
const MAX_BYTES = 9 * 1024 * 1024; // 9 MB safety cap (client already compresses)

export default async (req) => {
  const store = getStore(STORE);
  const url = new URL(req.url);

  // ---- serve a single image: GET ?id=<tag>/<uuid> ----
  const id = url.searchParams.get("id");
  if (req.method === "GET" && id) {
    const res = await store.getWithMetadata(id, { type: "arrayBuffer" });
    if (!res) return new Response("Not found", { status: 404 });
    return new Response(res.data, {
      headers: {
        "content-type": (res.metadata && res.metadata.ct) || "image/jpeg",
        // ids are unique forever, so let the browser cache hard (saves repeat calls)
        "cache-control": "public, max-age=31536000, immutable"
      }
    });
  }

  // ---- list photos: GET ?list=1[&tag=shanghai] ----
  if (req.method === "GET" && url.searchParams.get("list")) {
    const tag = url.searchParams.get("tag") || "";
    const prefix = tag ? tag + "/" : "";
    const { blobs } = await store.list({ prefix });
    const photos = blobs
      .map((b) => ({ id: b.key, tag: b.key.split("/")[0] }))
      .reverse();
    return Response.json({ photos }, { headers: { "cache-control": "no-store" } });
  }

  // ---- upload: POST multipart/form-data (file, tag, by, secret) ----
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
    const key = `${tag}/${randomUUID()}`;
    const buf = await file.arrayBuffer();
    await store.set(key, buf, {
      metadata: { ct: file.type || "image/jpeg", by, ts: Date.now() }
    });
    return Response.json({ ok: true, id: key });
  }

  // ---- delete: DELETE ?id=<tag>/<uuid>  (pass-phrase via x-upload-secret header) ----
  if (req.method === "DELETE") {
    const expected = process.env.UPLOAD_SECRET || "";
    if (!expected || req.headers.get("x-upload-secret") !== expected) {
      return new Response("Unauthorized", { status: 401 });
    }
    const delId = url.searchParams.get("id");
    if (!delId) return new Response("No id", { status: 400 });
    await store.delete(delId);
    return Response.json({ ok: true });
  }

  return new Response("Method not allowed", { status: 405 });
};
