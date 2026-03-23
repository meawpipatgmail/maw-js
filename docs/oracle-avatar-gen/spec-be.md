# Oracle Avatar Generator — Backend Spec

**Feature**: Oracle Avatar Generation API
**Stack**: maw-js (Bun + Hono หรือ native Bun.serve)
**Owner**: Forge
**Status**: Spec

---

## Overview

BE รับ form fields จาก FE → refine เป็น prompt ด้วย LLM → validate → ส่ง TensorArt → รับผล via webhook → store URL

---

## Flow

```
FE POST /api/avatar/generate
  │
  ├─→ LLM Refinement (Claude Haiku)
  │     system prompt: SFW/NSFW instruction + style guide
  │     input: form fields
  │     output: { refinedPrompt, negativePrompt }
  │
  ├─→ Validator (same LLM call หรือ second call)
  │     output: { valid: boolean, reason?: string }
  │
  ├─→ [if valid] POST TensorArt /jobs
  │     body: { prompt: refinedPrompt, negative: negativePrompt, ... }
  │     response: { jobId }
  │
  └─→ return { jobId, status: "pending" } to FE
        (หรือ { valid: false, reason } ถ้า validator reject)

TensorArt webhook → POST /api/avatar/webhook
  ├─→ poll job status จนกว่าจะ done (6 retries × 2.5s)
  ├─→ download image URL
  └─→ save to data/avatars/{target}.json

FE poll GET /api/avatar/status/:jobId
  └─→ return { status, imageUrl? }
```

---

## API Endpoints

### POST /api/avatar/generate

**Request:**
```ts
{
  target: string;          // tmux target e.g. "maw:0"
  fields: {
    sex: string;
    race: string;
    skinTone: string;
    eyeColor: string;
    hairColor: string;
    hairStyle: string;
    bodyType: string;
    expression: string;
    appearance: string;    // free-text from user
  };
  sfw: boolean;
}
```

**Response (success):**
```ts
{ jobId: string; status: "pending" }
```

**Response (validator reject):**
```ts
{ valid: false; reason: string }
```

---

### GET /api/avatar/status/:jobId

**Response:**
```ts
{
  status: "pending" | "done" | "failed";
  imageUrl?: string;       // เมื่อ done
  error?: string;          // เมื่อ failed
}
```

---

### GET /api/avatar/current/:target

**Response:**
```ts
{
  imageUrl: string | null;
  fields: AvatarFormState | null;
}
```

---

### POST /api/avatar/webhook

TensorArt จะ POST มาที่นี่เมื่อ job เสร็จ

**Request (from TensorArt):**
```ts
{ jobId: string; status: string; images?: Array<{ url: string }> }
```

**Flow:**
1. รับ jobId
2. Poll `GET https://api.tensorart.net/v1/jobs/:jobId` จนได้ `SUCCESS` (max 6 retries × 2.5s)
3. ดึง image URL จาก response
4. อัพเดต `data/avatars/jobs/{jobId}.json` → `{ status: "done", imageUrl }`
5. อัพเดต `data/avatars/{target}.json` → `{ imageUrl, fields, updatedAt }`

---

## LLM Refinement

**Model (SFW)**: `claude-haiku-4-5-20251001` (ถูก + เร็ว)
**Model (NSFW)**: Grok (`grok-2-latest` หรือ `grok-3-mini`) — policy ยืดหยุ่นกว่า Claude

> **หมายเหตุ**: Claude มี content policy ที่ block explicit NSFW prompt generation
> ดังนั้น SFW → ใช้ Claude Haiku / NSFW → ใช้ Grok

**System Prompt (SFW — Claude Haiku):**
```
You are an anime avatar prompt engineer for TensorArt.
Generate a safe-for-work chibi/anime character sprite prompt.
Keep the character fully clothed and appropriate for all audiences.
Output JSON: { "prompt": "...", "negativePrompt": "..." }
```

**System Prompt (NSFW — Grok):**
```
You are an anime avatar prompt engineer for TensorArt.
Generate an anime character sprite prompt.
Output JSON: { "prompt": "...", "negativePrompt": "..." }
```

**User Message:**
```
Character fields:
- Sex: {sex}
- Race: {race}
- Skin Tone: {skinTone}
- Eye Color: {eyeColor}
- Hair: {hairColor}, {hairStyle}
- Body Type: {bodyType}
- Expression: {expression}
- Additional appearance: {appearance}

Generate an optimized TensorArt prompt for this character as a sprite with transparent background.
```

**Output schema:**
```ts
{ prompt: string; negativePrompt: string }
```

---

## Validator

**เรียกต่อจาก refinement** (second LLM call หรือ เพิ่มใน same response)

**System Prompt:**
```
You are a content safety validator for image generation prompts.
Check if the given prompt is appropriate given the SFW setting.
Output JSON: { "valid": boolean, "reason": string }
```

**Input:**
```
SFW: {true/false}
Prompt: {refinedPrompt}
```

**Logic:**
- SFW=true + prompt มี explicit content → `{ valid: false, reason: "..." }`
- SFW=false → relax แต่ยัง reject prompt ที่ขัด TensorArt ToS อย่างชัดเจน
- Otherwise → `{ valid: true, reason: "" }`

---

## TensorArt API

**Base URL**: `https://api.tensorart.net/v1`
**Auth**: `Authorization: Bearer {TENSORART_API_KEY}`

### Submit Job

```
POST /jobs
{
  "request_id": "{uuid}",
  "stages": [{
    "type": "INPUT_INITIALIZE",
    "inputInitialize": {
      "seed": -1,
      "count": 1
    }
  }, {
    "type": "DIFFUSION",
    "diffusion": {
      "width": 512,
      "height": 512,
      "prompts": [{ "text": "{refinedPrompt}" }],
      "negativePrompts": [{ "text": "{negativePrompt}" }],
      "sdModel": "...",         // model ID สำหรับ anime/chibi style
      "sdVae": "...",
      "steps": 25,
      "cfgScale": 7,
      "sampler": "DPM++ 2M Karras"
    }
  }],
  "webhook": "https://{maw-host}/api/avatar/webhook"
}
```

**Response:**
```ts
{ job: { id: string } }
```

### Poll Job Status

```
GET /jobs/:jobId
→ { job: { status: "PENDING" | "RUNNING" | "SUCCESS" | "FAILED", successInfo?: { images: [{ url }] } } }
```

---

## Storage

### Job state: `data/avatars/jobs/{jobId}.json`
```ts
{
  jobId: string;
  target: string;
  status: "pending" | "done" | "failed";
  imageUrl?: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
}
```

### Avatar per target: `data/avatars/{target-sanitized}.json`
```ts
{
  target: string;
  imageUrl: string;
  fields: AvatarFormState;
  updatedAt: string;
}
```

`target-sanitized`: แทน `:` ด้วย `_` เช่น `maw_0.json`

---

## Environment Variables

```env
TENSORART_API_KEY=...
ANTHROPIC_API_KEY=...   # สำหรับ LLM refinement (SFW) + validator
XAI_API_KEY=...         # สำหรับ LLM refinement (NSFW) — Grok
```

---

## File Structure (ใน maw-js)

```
src/
├── avatar/
│   ├── generate.ts      — POST /api/avatar/generate handler
│   ├── webhook.ts       — POST /api/avatar/webhook handler
│   ├── status.ts        — GET /api/avatar/status/:jobId
│   ├── current.ts       — GET /api/avatar/current/:target
│   ├── refine.ts        — LLM refinement + validator
│   └── tensorart.ts     — TensorArt API client
data/
└── avatars/
    ├── jobs/
    └── {target}.json
```

---

## Reference Files (Narratia)

ดู implementation จริงจาก Narratia เป็น reference — strip ส่วนที่ไม่ต้องการ (Supabase, KV, RBAC, Cloudflare upload) ออก

| File | ใช้ reference อะไร |
|------|--------------------|
| `Narratia/react-narratia/server/handlers/character-sprite-workspace-handler.ts` | TensorArt job submission, LLM refinement flow, validator pattern |
| `Narratia/react-narratia/server/handlers/character-sprite-workspace-webhook-handler.ts` | Webhook receiver, poll job status (6 retries × 2.5s pattern) |
| `Narratia/react-narratia/server/helper/webhook-utils.ts` | Webhook utility helpers |
| `Narratia/react-narratia/specs/prototype/test-workflow-job-tensorart.ts` | TensorArt job payload structure, stages format |

> **หมายเหตุ Grok API**: Narratia ใช้ Claude ไม่ได้ใช้ Grok — ดู xAI API docs โดยตรง
> Base URL: `https://api.x.ai/v1` (OpenAI-compatible format)
> Model: `grok-2-latest` หรือ `grok-3-mini`

---

## Notes for Forge

- ไม่ต้อง auth/RBAC — maw ใช้คนเดียว
- ไม่ต้อง upload image ไปที่อื่น — ใช้ image URL จาก TensorArt โดยตรง (URL มักอยู่ได้นานพอ)
- Webhook URL ต้องเป็น public URL — ถ้า dev local ให้ใช้ ngrok หรือ tunnel
- Error handling: ถ้า TensorArt timeout → mark job เป็น "failed" ให้ FE แสดง error
- `data/avatars/` ควรอยู่ใน .gitignore
