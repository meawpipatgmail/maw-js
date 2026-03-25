export type AvatarStyle = "chibi" | "anime" | "realistic";

export interface AvatarModel {
  id: string;       // TensorArt model ID
  name: string;
  base: string;     // used to pick quality prefix
  sampler: string;
  vae: string;
  steps: number;
  cfgScale: number;
  width: number;
  height: number;
}

export const AVATAR_MODELS: Record<AvatarStyle, AvatarModel> = {
  chibi: {
    id: "960968281714340923",
    name: "REED Illustrious (Anime)",
    base: "illustrious",
    sampler: "DPM++ 2M Karras",
    vae: "sdxl_vae.safetensors",
    steps: 30,
    cfgScale: 5,
    width: 768,
    height: 1152,
  },
  anime: {
    id: "977348956268792231",
    name: "Milky Dreams",
    base: "illustrious",
    sampler: "DPM++ 2M Karras",
    vae: "sdxl_vae.safetensors",
    steps: 30,
    cfgScale: 5,
    width: 768,
    height: 1152,
  },
  realistic: {
    id: "956280112309918550",
    name: "Z-Image Moody Porn Mix",
    base: "z-image-turbo",
    sampler: "Euler a",
    vae: "Automatic",
    steps: 8,
    cfgScale: 1,
    width: 768,
    height: 1152,
  },
};

// ---- Quality prefixes (injected programmatically after LLM refinement) ----
// Sourced from Narratia prompt-utils.ts patterns

export const QUALITY_PREFIXES: Record<string, string> = {
  "illustrious":
    "embedding:lazypos, lazypos, digital art, mature, (oiled skin:0.8), (glossy skin:0.8), ((masterpiece, highest quality, best quality, anime style shading, dynamic lighting)), absurdres, very aesthetic, source_anime, detailed illustration, 8K UHD, anime screencap, anime coloring",
  "z-image-turbo":
    "((Masterpiece, Highest quality, best quality, photo-realistic, photorealistic, realistic human, DSLR photo, photography, skin pores, natural skin texture, realistic lighting, film grain, 8k, ultra-detailed, intricate details, sharp focus, professional lighting))",
};

export const NEGATIVE_PREFIXES: Record<string, string> = {
  "illustrious":
    "embedding:lazyneg, lazyneg, child, loli, bad hands, bad feet, missing fingers, extra missing, missing arms, missing legs, 3D, photorealistic, hyper-realistic, realistic, rough sketch, fewer digits, extra digits, watermark, signature, text font, username, logo, words, letters, digits, autograph, trademark, flat color, low contrast, low saturation, washed out, overexposed",
  "z-image-turbo":
    "child, red cheeks, loli, bad anatomy, bad hands, missing fingers, extra digits, bad proportions, cropped, low quality, blurry, text, watermark, signature, logo, oily skin, shiny skin, wet skin, sweat, plastic skin, greasy hair",
};

// ---- Avatar pose prefix (appended after quality + character description) ----

export const AVATAR_POSE: Record<AvatarStyle, string> = {
  chibi:
    "(high contrast:0.7), (bright lighting:0.2), (cel shading:0.1), (warm tones:1), solo, full body, full shot, standing, looking at viewer, soft lighting, chibi style, detailed character design, soft shading, ((white background)), ((plain background)), ((simple background)), ((solid color background))",
  anime:
    "(high contrast:0.7), (bright lighting:0.2), (cel shading:0.1), (warm tones:1), solo, medium full shot, standing, looking at viewer, soft lighting, anime style, detailed character design, soft shading, ((white background)), ((plain background)), ((simple background)), ((solid color background))",
  realistic:
    "(high contrast:0.7), (bright lighting:0.2), (cinematic lighting:0.1), (warm tones:1), solo, medium shot, standing, looking at viewer, soft lighting, detailed character design, soft shading, ((white background)), ((plain background)), ((simple background)), ((solid color background))",
};

// Appended to negative prompt for all styles — prevents background bleed and duplicates
export const AVATAR_NEGATIVE_SUFFIX =
  "((background)), ((scenery)), ((environment)), ((trees)), ((sky)), ((landscape)), lifted leg, bent knee, busy background, character fusion, merged faces, multiple heads on same body, ((multiple girls)), ((2girls)), ((3girls)), ((twins)), ((clone)), ((duplicate))";

// ---- Race-specific prompt hints for Grok ----

export const RACE_HINTS: Record<string, string> = {
  robot: "The character is a robot/android. Replace skin tone with metallic plating color. Use terms like 'mechanical body', 'glowing eyes', 'metal chassis', 'circuitry'. Omit hair if not specified.",
  alien: "The character is an alien. Skin color may be unusual (blue, green, purple, etc.). Use terms like 'alien features', 'bioluminescent markings', 'otherworldly'. May have unusual anatomy.",
  demon: "The character is a demon. May have horns, tail, unusual skin color. Use terms like 'demonic', 'dark energy', 'glowing eyes', 'sinister aura'.",
  human: "The character is human. Use natural skin tone and hair descriptions.",
  default: "Describe the character's physical appearance faithfully.",
};

export function getRaceHint(race: string): string {
  return RACE_HINTS[race.toLowerCase()] ?? RACE_HINTS.default;
}

export function getModelForStyle(style: AvatarStyle): AvatarModel {
  return AVATAR_MODELS[style];
}

export function getQualityPrefix(base: string): string {
  return QUALITY_PREFIXES[base] ?? QUALITY_PREFIXES["illustrious"];
}

export function getNegativePrefix(base: string): string {
  return NEGATIVE_PREFIXES[base] ?? NEGATIVE_PREFIXES["illustrious"];
}
