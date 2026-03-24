import type { Context } from "hono";
import { loadGallery } from "./storage";

export async function handleGallery(c: Context) {
  const name = c.req.param("name");
  if (!name) return c.json({ error: "name required" }, 400);

  const gallery = loadGallery(name);
  return c.json({ gallery });
}
