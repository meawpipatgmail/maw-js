import { randomUUID } from "crypto";

const BASE_URL = "https://ap-east-1.tensorart.cloud/v1";

function getKey(): string {
  const key = process.env.TENSORART_API_KEY;
  if (!key) throw new Error("TENSORART_API_KEY not set");
  return key;
}

export async function submitJob(
  prompt: string,
  negativePrompt: string,
): Promise<string> {
  const body = {
    request_id: randomUUID(),
    stages: [
      {
        type: "INPUT_INITIALIZE",
        inputInitialize: { seed: -1, count: 1 },
      },
      {
        type: "DIFFUSION",
        diffusion: {
          width: 512,
          height: 512,
          prompts: [{ text: prompt }],
          negativePrompts: [{ text: negativePrompt }],
          sdModel: "977348956268792231", // Counterfeit-V3.0 (anime/chibi)
          sdVae: "sdxl_vae.safetensors",
          steps: 25,
          cfgScale: 7,
          sampler: "DPM++ 2M Karras",
        },
      },
    ],
  };

  const res = await fetch(`${BASE_URL}/jobs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getKey()}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`TensorArt submit failed: ${res.status} ${text}`);
  }

  const data = await res.json() as { job: { id: string } };
  return data.job.id;
}

export interface JobPollResult {
  status: "PENDING" | "RUNNING" | "SUCCESS" | "FAILED";
  imageUrl?: string;
}

export async function pollJob(jobId: string): Promise<JobPollResult> {
  const res = await fetch(`${BASE_URL}/jobs/${jobId}`, {
    headers: { Authorization: `Bearer ${getKey()}` },
  });

  if (!res.ok) {
    throw new Error(`TensorArt poll failed: ${res.status}`);
  }

  const data = await res.json() as {
    job: {
      status: string;
      successInfo?: { images: Array<{ url: string }> };
    };
  };

  const status = data.job.status as JobPollResult["status"];
  const imageUrl = data.job.successInfo?.images?.[0]?.url;
  return { status, imageUrl };
}

export async function pollUntilDone(jobId: string, retries = 40, delayMs = 3000): Promise<string> {
  for (let i = 0; i < retries; i++) {
    const result = await pollJob(jobId);
    if (result.status === "SUCCESS" && result.imageUrl) return result.imageUrl;
    if (result.status === "FAILED") throw new Error("TensorArt job failed");
    if (i < retries - 1) await new Promise(r => setTimeout(r, delayMs));
  }
  throw new Error("TensorArt job timed out");
}
