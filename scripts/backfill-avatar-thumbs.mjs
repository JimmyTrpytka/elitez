// Jednorázově: doplní malé profilovky (128 px, „-sm“) ke starším nahráním.
// Spuštění: node --env-file=.env.local scripts/backfill-avatar-thumbs.mjs [--write]
// Bez --write jen spočítá, co by udělal. Potřebuje SUPABASE_SECRET_KEY (jen server).
import sharp from "sharp";
import { createClient } from "@supabase/supabase-js";

const write = process.argv.includes("--write");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) throw new Error("Chybí NEXT_PUBLIC_SUPABASE_URL nebo SUPABASE_SECRET_KEY");

const supabase = createClient(url, key, { auth: { persistSession: false } });
const BUCKET = "avatars";

function thumbPath(path) {
  const dot = path.lastIndexOf(".");
  return dot > path.lastIndexOf("/") ? `${path.slice(0, dot)}-sm${path.slice(dot)}` : `${path}-sm`;
}

const { data: profiles, error } = await supabase
  .from("profiles")
  .select("id, avatar_path")
  .not("avatar_path", "is", null);
if (error) throw error;

let done = 0, skipped = 0, failed = 0;
for (const { avatar_path: path } of profiles) {
  const thumb = thumbPath(path);
  const folder = path.slice(0, path.lastIndexOf("/"));
  const { data: existing } = await supabase.storage.from(BUCKET).list(folder, { search: thumb.slice(folder.length + 1) });
  if (existing?.some((f) => `${folder}/${f.name}` === thumb)) { skipped++; continue; }
  if (!write) { done++; continue; }
  try {
    const { data: blob, error: dlError } = await supabase.storage.from(BUCKET).download(path);
    if (dlError) throw dlError;
    const isJpg = /\.jpe?g$/i.test(path);
    const pipeline = sharp(Buffer.from(await blob.arrayBuffer())).resize(128, 128, { fit: "cover" });
    const out = isJpg ? await pipeline.jpeg({ quality: 82 }).toBuffer() : await pipeline.webp({ quality: 80 }).toBuffer();
    const { error: upError } = await supabase.storage
      .from(BUCKET)
      .upload(thumb, out, { contentType: isJpg ? "image/jpeg" : "image/webp", upsert: true });
    if (upError) throw upError;
    done++;
  } catch (e) {
    failed++;
    console.error("Nepovedlo se:", path, e?.message ?? e);
  }
}
console.log(
  `${write ? "Vytvořeno" : "K vytvoření"}: ${done}, už existuje: ${skipped}, chyby: ${failed} (profilovek celkem: ${profiles.length})`,
);
