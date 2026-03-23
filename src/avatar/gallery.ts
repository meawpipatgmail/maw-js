import type { Context } from "hono";
import { loadGallery } from "./storage";

export async function handleGallery(c: Context) {
  const target = c.req.param("target");
  if (!target) return c.json({ error: "target required" }, 400);

  const gallery = loadGallery(target);
  return c.json({ gallery });
}
