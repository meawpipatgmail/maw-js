import type { Context } from "hono";
import { refinePrompt, validatePrompt } from "./refine";
import type { AvatarFields } from "./refine";
import { submitJob, pollUntilDone } from "./tensorart";
import { saveJob, updateJob, saveAvatarFromJob, downloadImage } from "./storage";
import { getModelForStyle } from "./models";

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

  // Resolve model based on style
  const style = fields.style ?? "chibi";
  const model = getModelForStyle(style);

  // LLM refinement — pass model.base for quality prefix selection
  let refined: { prompt: string; negativePrompt: string };
  try {
    refined = await refinePrompt(fields, sfw ?? true, model.base);
    console.log(refined);
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

  // Submit to TensorArt with model config
  let jobId: string;
  try {
    jobId = await submitJob(refined.prompt, refined.negativePrompt, model);
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
    const remoteUrl = await pollUntilDone(jobId);

    // Download image locally before the presigned URL expires
    let localPath: string;
    try {
      localPath = await downloadImage(remoteUrl, jobId);
      console.log(`[avatar] job ${jobId} image saved locally: ${localPath}`);
    } catch (dlErr: any) {
      console.error(`[avatar] job ${jobId} image download failed: ${dlErr.message}, using remote URL`);
      localPath = remoteUrl;
    }

    updateJob(jobId, { status: "done", imageUrl: localPath });
    saveAvatarFromJob(name, localPath, fields);
  } catch (e: any) {
    console.error(`[avatar] job ${jobId} failed:`, e.message);
    updateJob(jobId, { status: "failed", error: e.message });
  }
}
