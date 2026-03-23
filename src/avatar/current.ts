import type { Context } from "hono";
import { loadSelection } from "./storage";

export async function handleCurrent(c: Context) {
  const target = c.req.param("target");
  if (!target) return c.json({ error: "target required" }, 400);

  const selection = loadSelection(target);
  if (!selection) {
    return c.json({ imageUrl: null, fields: null, selectedId: null });
  }

  return c.json({
    imageUrl: selection.imageUrl,
    fields: selection.fields,
    selectedId: selection.selectedId,
  });
}
