import type { Context } from "hono";
import { loadSelection } from "./storage";

export async function handleCurrent(c: Context) {
  const name = c.req.param("name");
  if (!name) return c.json({ error: "name required" }, 400);

  const selection = loadSelection(name);
  if (!selection) {
    return c.json({ imageUrl: null, fields: null, selectedId: null });
  }

  return c.json({
    imageUrl: selection.imageUrl,
    fields: selection.fields,
    selectedId: selection.selectedId,
  });
}
