import type { Context } from "hono";
import { readdirSync, readFileSync, existsSync } from "fs";
import { join } from "path";

const AVATARS_DIR = join(import.meta.dir, "../../data/avatars");

export async function handleAll(c: Context) {
  const result: Record<string, string | null> = {};

  if (!existsSync(AVATARS_DIR)) return c.json(result);

  try {
    const files = readdirSync(AVATARS_DIR).filter(
      f => f.endsWith(".json") && !f.endsWith("_gallery.json") && !f.startsWith("jobs")
    );

    for (const file of files) {
      try {
        const data = JSON.parse(readFileSync(join(AVATARS_DIR, file), "utf-8"));
        const name = data.oracleName as string | undefined;
        const imageUrl = data.imageUrl as string | null | undefined;
        if (name) result[name] = imageUrl ?? null;
      } catch { /* skip malformed */ }
    }
  } catch { /* dir unreadable */ }

  return c.json(result);
}
