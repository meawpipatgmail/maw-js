import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { randomUUID } from "crypto";
import type { AvatarFields } from "./refine";

const AVATARS_DIR = join(import.meta.dir, "../../data/avatars");
const JOBS_DIR = join(AVATARS_DIR, "jobs");

function ensureDirs() {
  if (!existsSync(JOBS_DIR)) mkdirSync(JOBS_DIR, { recursive: true });
  if (!existsSync(AVATARS_DIR)) mkdirSync(AVATARS_DIR, { recursive: true });
}

function sanitizeName(name: string): string {
  // Oracle name should already be clean (e.g. "forge", "secretary")
  // but strip anything non-alphanumeric just in case
  return name.toLowerCase().replace(/[^a-z0-9-_]/g, "_");
}

// ---- Job State ----

export interface JobState {
  jobId: string;
  oracleName: string;
  status: "pending" | "done" | "failed";
  imageUrl?: string;
  error?: string;
  fields?: AvatarFields;
  createdAt: string;
  updatedAt: string;
}

export function saveJob(jobId: string, data: Partial<JobState> & { oracleName: string }): JobState {
  ensureDirs();
  const path = join(JOBS_DIR, `${jobId}.json`);
  const now = new Date().toISOString();
  const existing = loadJob(jobId);
  const state: JobState = {
    jobId,
    oracleName: data.oracleName,
    status: data.status || "pending",
    imageUrl: data.imageUrl,
    error: data.error,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    ...data,
  };
  writeFileSync(path, JSON.stringify(state, null, 2));
  return state;
}

export function loadJob(jobId: string): JobState | null {
  ensureDirs();
  const path = join(JOBS_DIR, `${jobId}.json`);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as JobState;
  } catch {
    return null;
  }
}

export function updateJob(jobId: string, patch: Partial<JobState>): JobState | null {
  const existing = loadJob(jobId);
  if (!existing) return null;
  const updated = { ...existing, ...patch, updatedAt: new Date().toISOString() };
  writeFileSync(join(JOBS_DIR, `${jobId}.json`), JSON.stringify(updated, null, 2));
  return updated;
}

// ---- Gallery ----

export interface GalleryEntry {
  id: string;
  imageUrl: string;
  fields: AvatarFields;
  createdAt: string;
}

export interface AvatarSelection {
  oracleName: string;
  selectedId: string | null;  // null = use procedural SVG
  imageUrl: string | null;    // denormalized for quick access
  fields: AvatarFields | null;
  updatedAt: string;
}

function galleryPath(name: string): string {
  return join(AVATARS_DIR, `${sanitizeName(name)}_gallery.json`);
}

function selectionPath(name: string): string {
  return join(AVATARS_DIR, `${sanitizeName(name)}.json`);
}

export function loadGallery(name: string): GalleryEntry[] {
  ensureDirs();
  const path = galleryPath(name);
  if (!existsSync(path)) return [];
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as GalleryEntry[];
  } catch {
    return [];
  }
}

export function addToGallery(name: string, imageUrl: string, fields: AvatarFields): GalleryEntry {
  ensureDirs();
  const gallery = loadGallery(name);
  const entry: GalleryEntry = {
    id: randomUUID(),
    imageUrl,
    fields,
    createdAt: new Date().toISOString(),
  };
  gallery.unshift(entry); // newest first
  writeFileSync(galleryPath(name), JSON.stringify(gallery, null, 2));
  return entry;
}

export function loadSelection(name: string): AvatarSelection | null {
  const path = selectionPath(name);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as AvatarSelection;
  } catch {
    return null;
  }
}

export function setSelection(name: string, entryId: string | null): AvatarSelection {
  ensureDirs();
  let imageUrl: string | null = null;
  let fields: AvatarFields | null = null;

  if (entryId !== null) {
    const gallery = loadGallery(name);
    const entry = gallery.find(e => e.id === entryId);
    if (entry) {
      imageUrl = entry.imageUrl;
      fields = entry.fields;
    }
  }

  const selection: AvatarSelection = {
    oracleName: name,
    selectedId: entryId,
    imageUrl,
    fields,
    updatedAt: new Date().toISOString(),
  };
  writeFileSync(selectionPath(name), JSON.stringify(selection, null, 2));
  return selection;
}

/** Called after a job succeeds — adds to gallery only, does NOT auto-select */
export function saveAvatarFromJob(name: string, imageUrl: string, fields: AvatarFields): GalleryEntry {
  return addToGallery(name, imageUrl, fields);
}
