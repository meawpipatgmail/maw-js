import type { AvatarStyle } from "./models";
import { getQualityPrefix, getNegativePrefix, getRaceHint, AVATAR_POSE, AVATAR_NEGATIVE_SUFFIX } from "./models";

export interface AvatarFields {
  sex: string;
  race: string;
  skinTone: string;
  eyeColor: string;
  hairColor: string;
  hairStyle: string;
  bodyType: string;
  expression: string;
  appearance: string;
  style: AvatarStyle; // "chibi" | "anime" | "realistic"
}

export interface RefinedPrompt {
  prompt: string;
  negativePrompt: string;
}

export interface ValidationResult {
  valid: boolean;
  reason: string;
}

async function callGrok(system: string, user: string): Promise<string> {
  const key = process.env.XAI_API_KEY;
  if (!key) throw new Error("XAI_API_KEY not set");

  const res = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: "grok-4-1-fast-reasoning",
      max_tokens: 512,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Grok API error: ${res.status} ${text}`);
  }

  const data = await res.json() as { choices: Array<{ message: { content: string } }> };
  return data.choices[0].message.content;
}

function parseJson<T>(text: string): T {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error(`No JSON found in response: ${text}`);
  return JSON.parse(jsonMatch[0]) as T;
}

function buildUserMessage(fields: AvatarFields): string {
  const raceHint = getRaceHint(fields.race);

  const styleLabel = {
    chibi: "Anime Chibi (cute, small proportions, big head, big eyes)",
    anime: "Anime (detailed 2D illustration, standard proportions)",
    realistic: "Realistic (photorealistic, natural proportions)",
  }[fields.style];

  // For realistic style, omit blush-related terms
  const realisticNote = fields.style === "realistic"
    ? "\nIMPORTANT: Do NOT use 'red cheeks', 'blushing', 'blush', 'rosy cheeks'. Use 'gentle smile', 'soft gaze' instead."
    : "";

  return `Character fields:
- Style: ${styleLabel}
- Sex: ${fields.sex}
- Race: ${fields.race} (${raceHint})
- Skin Tone: ${fields.skinTone}
- Eye Color: ${fields.eyeColor}
- Hair: ${fields.hairColor}, ${fields.hairStyle}
- Body Type: ${fields.bodyType}
- Expression: ${fields.expression}
- Additional appearance: ${fields.appearance}

Describe ONLY the character's appearance (sex tag + physical traits + outfit + accessories).
Include sex tag (1girl/1boy/1person) at the start.
Do NOT include quality tags, pose, background, or lighting — those are handled separately.
${realisticNote}

Output JSON: { "prompt": "...", "negativePrompt": "..." }`;
}

export async function refinePrompt(
  fields: AvatarFields,
  sfw: boolean,
  modelBase: string,
): Promise<RefinedPrompt> {
  const sfwNote = sfw
    ? "IMPORTANT: Output is SAFE FOR WORK. Character must be fully clothed and appropriate for all audiences."
    : "Mature content is permitted if appropriate for the character.";

  const system = `You are an expert AI art prompt engineer for TensorArt image generation.
Describe ONLY the character's appearance based on the fields provided.
${sfwNote}
Output valid JSON only: { "prompt": "...", "negativePrompt": "..." }
For negativePrompt, describe appearance-specific negatives only (bad anatomy, wrong features, etc).
Do NOT include quality tags, background, or pose terms — those are handled separately.
NO markdown. NO explanations. JUST the JSON.`;

  const user = buildUserMessage(fields);
  const text = await callGrok(system, user);
  const parsed = parseJson<RefinedPrompt>(text);

  // Inject quality tags programmatically — not trusted to the LLM
  const qualityPrefix = getQualityPrefix(modelBase);
  const posePrefix = AVATAR_POSE[fields.style];
  const negativeBase = getNegativePrefix(modelBase);

  return {
    prompt: `${qualityPrefix}, ${posePrefix}, ${parsed.prompt}`,
    negativePrompt: `${negativeBase}, ${parsed.negativePrompt}, ${AVATAR_NEGATIVE_SUFFIX}`,
  };
}

export async function validatePrompt(prompt: string, sfw: boolean): Promise<ValidationResult> {
  const system = sfw
    ? `You are a content safety validator for image generation prompts.
The prompt must be SAFE FOR WORK. Reject any sexual, explicit, suggestive, or NSFW content.
Reject prompts containing: nudity, sexual poses, revealing clothing emphasis, sexual innuendo.
Output JSON only: { "valid": boolean, "reason": string }`
    : `You are a content safety validator for image generation prompts.
This is NSFW mode. Adult, sexual, and mature content is FULLY ALLOWED and should be marked valid.
ONLY reject content that is illegal or depicts minors.
Output JSON only: { "valid": boolean, "reason": string }`;

  const user = `Prompt: ${prompt}`;

  // console.log(`[validatePrompt] sfw=${sfw}`);
  // console.log(user);
  const text = await callGrok(system, user);
  return parseJson<ValidationResult>(text);
}
