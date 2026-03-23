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
}

export interface RefinedPrompt {
  prompt: string;
  negativePrompt: string;
}

export interface ValidationResult {
  valid: boolean;
  reason: string;
}

const userMessage = (fields: AvatarFields) => `Character fields:
- Sex: ${fields.sex}
- Race: ${fields.race}
- Skin Tone: ${fields.skinTone}
- Eye Color: ${fields.eyeColor}
- Hair: ${fields.hairColor}, ${fields.hairStyle}
- Body Type: ${fields.bodyType}
- Expression: ${fields.expression}
- Additional appearance: ${fields.appearance}

Generate an optimized TensorArt prompt for this character as a sprite with transparent background.`;

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
  // Try to extract JSON from text (LLM may add preamble/code block)
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error(`No JSON found in response: ${text}`);
  return JSON.parse(jsonMatch[0]) as T;
}

export async function refinePrompt(fields: AvatarFields, sfw: boolean): Promise<RefinedPrompt> {
  const user = userMessage(fields);

  if (sfw) {
    const system = `You are an anime avatar prompt engineer for TensorArt.
Generate a safe-for-work chibi/anime character sprite prompt.
Keep the character fully clothed and appropriate for all audiences.
Output JSON: { "prompt": "...", "negativePrompt": "..." }`;
    const text = await callGrok(system, user);
    return parseJson<RefinedPrompt>(text);
  } else {
    const system = `You are an anime avatar prompt engineer for TensorArt.
Generate an anime character sprite prompt.
Output JSON: { "prompt": "...", "negativePrompt": "..." }`;
    const text = await callGrok(system, user);
    return parseJson<RefinedPrompt>(text);
  }
}

export async function validatePrompt(prompt: string, sfw: boolean): Promise<ValidationResult> {
  const system = `You are a content safety validator for image generation prompts.
Check if the given prompt is appropriate given the SFW setting.
Output JSON: { "valid": boolean, "reason": string }`;

  const user = `SFW: ${sfw}
Prompt: ${prompt}`;

  // Always use Claude for validation (SFW check is safe for Claude)
  const text = await callGrok(system, user);
  return parseJson<ValidationResult>(text);
}
