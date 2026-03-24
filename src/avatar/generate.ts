import type { Context } from "hono";
import { refinePrompt, validatePrompt } from "./refine";
import type { AvatarFields } from "./refine";
import { submitJob, pollUntilDone } from "./tensorart";
import { saveJob, updateJob, saveAvatarFromJob } from "./storage";

export async function handleGenerate(c: Context) {
  let body: { name: string; fields: AvatarFields; sfw: boolean };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const { name, fields, sfw } = body;
  if (!name || !fields) {
    return c.json({ error: "name and fields required" }, 400);
  }

  // LLM refinement
  let refined: { prompt: string; negativePrompt: string };
  try {
    refined = await refinePrompt(fields, sfw ?? true);
  } catch (e: any) {
    return c.json({ error: `Refinement failed: ${e.message}` }, 500);
  }

  // Validator
  let validation: { valid: boolean; reason: string };
  try {
    validation = await validatePrompt(refined.prompt, sfw ?? true);
  } catch (e: any) {
    return c.json({ error: `Validation failed: ${e.message}` }, 500);
  }

  if (!validation.valid) {
    return c.json({ valid: false, reason: validation.reason });
  }

  // Submit to TensorArt
  let jobId: string;
  try {
    jobId = await submitJob(refined.prompt, refined.negativePrompt);
  } catch (e: any) {
    return c.json({ error: `TensorArt submit failed: ${e.message}` }, 500);
  }

  saveJob(jobId, { oracleName: name, status: "pending", fields });

  // Poll TensorArt in background
  processJob(jobId, name, fields).catch(e => console.error("[avatar] processJob error:", e.message));

  return c.json({ jobId, status: "pending" });
}

async function processJob(jobId: string, name: string, fields: AvatarFields) {
  try {
    // console.log(`[avatar] polling TensorArt for job ${jobId} (oracle: ${name})...`);
    const imageUrl = await pollUntilDone(jobId);
    // console.log(`[avatar] job ${jobId} done:`, imageUrl);
    updateJob(jobId, { status: "done", imageUrl });
    saveAvatarFromJob(name, imageUrl, fields);
  } catch (e: any) {
    console.error(`[avatar] job ${jobId} failed:`, e.message);
    updateJob(jobId, { status: "failed", error: e.message });
  }
}
