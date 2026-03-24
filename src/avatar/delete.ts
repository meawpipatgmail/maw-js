import type { Context } from "hono";
import { existsSync, unlinkSync } from "fs";
import { join } from "path";
import { loadGallery, loadSelection, setSelection } from "./storage";

const IMAGES_DIR = join(import.meta.dir, "../../data/avatars/images");

export async function handleDeleteGalleryEntry(c: Context) {
  const name = c.req.param("name");
  const entryId = c.req.param("entryId");

  if (!name || !entryId) {
    return c.json({ error: "Missing name or entryId" }, 400);
  }

  const gallery = loadGallery(name);
  const entry = gallery.find(e => e.id === entryId);
  if (!entry) {
    return c.json({ error: "Entry not found" }, 404);
  }

  // Delete local image file if it's a local path
  const localMatch = entry.imageUrl.match(/^\/api\/avatar\/images\/(.+)$/);
  if (localMatch) {
    const filePath = join(IMAGES_DIR, localMatch[1]);
    if (existsSync(filePath)) {
      try { unlinkSync(filePath); } catch {}
    }
  }

  // Remove entry from gallery
  const { writeFileSync } = await import("fs");
  const { join: pathJoin } = await import("path");
  const sanitized = name.toLowerCase().replace(/[^a-z0-9-_]/g, "_");
  const galleryFile = pathJoin(import.meta.dir, `../../data/avatars/${sanitized}_gallery.json`);
  const updated = gallery.filter(e => e.id !== entryId);
  writeFileSync(galleryFile, JSON.stringify(updated, null, 2));

  // If deleted entry was the active selection → clear it
  const selection = loadSelection(name);
  if (selection?.selectedId === entryId) {
    setSelection(name, null);
  }

  return c.json({ ok: true, remaining: updated.length });
}
