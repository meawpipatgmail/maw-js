import type { Context } from "hono";
import { loadJob } from "./storage";

export async function handleStatus(c: Context) {
  const jobId = c.req.param("jobId");
  if (!jobId) return c.json({ error: "jobId required" }, 400);

  const job = loadJob(jobId);
  if (!job) return c.json({ error: "Job not found" }, 404);

  return c.json({
    status: job.status,
    imageUrl: job.imageUrl,
    error: job.error,
  });
}
