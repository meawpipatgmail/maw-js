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

function sanitizeTarget(target: string): string {
  return target.replace(/:/g, "_");
}

// ---- Job State ----

export interface JobState {
  jobId: string;
  target: string;
  status: "pending" | "done" | "failed";
  imageUrl?: string;
  error?: string;
  fields?: AvatarFields;
  createdAt: string;
  updatedAt: string;
}

export function saveJob(jobId: string, data: Partial<JobState> & { target: string }): JobState {
  ensureDirs();
  const path = join(JOBS_DIR, `${jobId}.json`);
  const now = new Date().toISOString();
  const existing = loadJob(jobId);
  const state: JobState = {
    jobId,
    target: data.target,
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
  target: string;
  selectedId: string | null;  // null = use SVG
  imageUrl: string | null;    // denormalized for quick access
  fields: AvatarFields | null;
  updatedAt: string;
}

function galleryPath(target: string): string {
  return join(AVATARS_DIR, `${sanitizeTarget(target)}_gallery.json`);
}

function selectionPath(target: string): string {
  return join(AVATARS_DIR, `${sanitizeTarget(target)}.json`);
}

export function loadGallery(target: string): GalleryEntry[] {
  ensureDirs();
  const path = galleryPath(target);
  if (!existsSync(path)) return [];
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as GalleryEntry[];
  } catch {
    return [];
  }
}

export function addToGallery(target: string, imageUrl: string, fields: AvatarFields): GalleryEntry {
  ensureDirs();
  const gallery = loadGallery(target);
  const entry: GalleryEntry = {
    id: randomUUID(),
    imageUrl,
    fields,
    createdAt: new Date().toISOString(),
  };
  gallery.unshift(entry); // newest first
  writeFileSync(galleryPath(target), JSON.stringify(gallery, null, 2));
  return entry;
}

export function loadSelection(target: string): AvatarSelection | null {
  const path = selectionPath(target);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as AvatarSelection;
  } catch {
    return null;
  }
}

export function setSelection(target: string, entryId: string | null): AvatarSelection {
  ensureDirs();
  let imageUrl: string | null = null;
  let fields: AvatarFields | null = null;

  if (entryId !== null) {
    const gallery = loadGallery(target);
    const entry = gallery.find(e => e.id === entryId);
    if (entry) {
      imageUrl = entry.imageUrl;
      fields = entry.fields;
    }
  }

  const selection: AvatarSelection = {
    target,
    selectedId: entryId,
    imageUrl,
    fields,
    updatedAt: new Date().toISOString(),
  };
  writeFileSync(selectionPath(target), JSON.stringify(selection, null, 2));
  return selection;
}

/** Called after a job succeeds — adds to gallery and auto-selects it */
export function saveAvatarFromJob(target: string, imageUrl: string, fields: AvatarFields): GalleryEntry {
  const entry = addToGallery(target, imageUrl, fields);
  setSelection(target, entry.id);
  return entry;
}
