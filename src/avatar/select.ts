import type { Context } from "hono";
import { setSelection } from "./storage";

export async function handleSelect(c: Context) {
  let body: { name: string; entryId: string | null };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON" }, 400);
  }

  const { name, entryId } = body;
  if (!name) return c.json({ error: "name required" }, 400);

  const selection = setSelection(name, entryId ?? null);
  return c.json({ ok: true, imageUrl: selection.imageUrl, selectedId: selection.selectedId });
}
