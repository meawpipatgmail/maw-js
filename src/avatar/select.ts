import type { Context } from "hono";
import { setSelection } from "./storage";

export async function handleSelect(c: Context) {
  let body: { target: string; entryId: string | null };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON" }, 400);
  }

  const { target, entryId } = body;
  if (!target) return c.json({ error: "target required" }, 400);

  const selection = setSelection(target, entryId ?? null);
  return c.json({ ok: true, imageUrl: selection.imageUrl, selectedId: selection.selectedId });
}
