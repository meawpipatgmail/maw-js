# Oracle Avatar Generator — Frontend Spec

**Feature**: Oracle Avatar Generation Form
**Route**: `#avatar` (new hash route in maw office UI)
**Owner**: Forge
**Status**: Spec

---

## Overview

หน้าสำหรับให้ user กำหนด appearance ของ Oracle avatar แล้วส่งไปสร้างรูปผ่าน TensorArt
UI ยึด pattern ของ Narratia CharacterVisualsModal (AppearanceTab) — grid of editable fields + preset + custom input

---

## Route

เพิ่ม `#avatar` ใน App.tsx hash router เช่นเดียวกับ `#secretary`

---

## Layout

```
┌─────────────────────────────────────────────┐
│  Oracle Avatar                              │
│                                             │
│  [Current Avatar Display]                  │
│                                             │
│  ┌──────────┬──────────┐                   │
│  │ Sex      │ Race     │                   │
│  ├──────────┼──────────┤                   │
│  │ Skin     │ Eye Color│                   │
│  ├──────────┼──────────┤                   │
│  │ Hair Color│ Hair Style│                 │
│  ├──────────┼──────────┤                   │
│  │ Body Type│ Expression│                  │
│  └──────────┴──────────┘                   │
│                                             │
│  Appearance (free-text prompt)              │
│  [textarea]                                 │
│                                             │
│  [SFW ●────] / [● NSFW]                   │
│                                             │
│  [Generate Avatar]                          │
└─────────────────────────────────────────────┘
```

---

## Fields

### Grid Fields (2 column, each with preset + custom)

| Field | Presets |
|-------|---------|
| Sex | Male / Female / Non-binary |
| Race | Human / Robot / Demon / Alien|
| Skin Tone | Fair / Tan / Dark / Blue / Purple / Green |
| Eye Color | Brown / Blue / Red / Gold / Glowing White / Purple |
| Hair Color | Black / White / Silver / Brown / Blue / Pink / Rainbow |
| Hair Style | Short / Long / Ponytail / Bob / Braided / Wild |
| Body Type | Slim / Average / Chibi / Muscular |
| Expression | Cheerful / Calm / Focused / Mysterious / Mischievous |

### Each field UX:
- แสดง current value (หรือ placeholder ถ้ายังไม่ได้เลือก)
- กดที่ row → เปิด inline dropdown หรือ small modal
- Dropdown: แสดง preset list + "Custom..." option ท้ายสุด
- ถ้าเลือก "Custom..." → แสดง text input ให้พิมพ์เอง

### Appearance Field
- `<textarea>` free-text prompt เต็ม width
- Placeholder: `"chibi Oracle with purple hair, glowing eyes, holding a book..."`
- ไม่มี preset (user พิมพ์เอง)

### SFW/NSFW Toggle
- Default: SFW
- Toggle switch พร้อม label ชัดเจน
- เมื่อ NSFW: แสดง warning text เล็กๆ

---

## Current Avatar Display

- ด้านบนฟอร์ม
- ถ้ายังไม่มี avatar → แสดง procedural SVG (AgentAvatar component เดิม)
- ถ้ามี generated avatar → แสดงรูปจาก URL ที่ store ไว้
- ขนาด ~120x120px, rounded

---

## Generate Flow (FE side)

```
user กรอก fields → กด "Generate Avatar"
  → POST /api/avatar/generate { fields, sfw }
  → แสดง loading state ("Generating...")
  → poll GET /api/avatar/status/:jobId ทุก 3s
  → เมื่อ status = "done" → แสดงรูปใหม่
  → เมื่อ status = "failed" → แสดง error message
```

### Validator Error
ถ้า BE ส่งกลับ `{ valid: false, reason: "..." }`:
- ไม่ส่ง TensorArt
- แสดง reason ให้ user แก้ fields ก่อน

### Loading State
- ปุ่ม Generate disabled
- แสดง spinner หรือ text "Generating... (may take ~30s)"

---

## Component Structure

```
AvatarPage
├── AvatarDisplay (current image or SVG fallback)
├── AvatarFieldGrid
│   └── AvatarFieldRow × 8 (label + value + edit)
│       └── AvatarFieldEditor (preset list + custom input)
├── AppearanceTextarea
├── SfwToggle
└── GenerateButton
```

---

## State Shape

```ts
interface AvatarFormState {
  sex: string;
  race: string;
  skinTone: string;
  eyeColor: string;
  hairColor: string;
  hairStyle: string;
  bodyType: string;
  expression: string;
  appearance: string;
  sfw: boolean;
}

interface GenerateStatus {
  phase: "idle" | "pending" | "done" | "failed";
  jobId?: string;
  imageUrl?: string;
  error?: string;
}
```

---

## Storage (FE reads)

FE อ่าน current avatar URL จาก:
```
GET /api/avatar/current/:target
→ { imageUrl: "https://..." | null, fields: AvatarFormState | null }
```

ถ้า `imageUrl` null → fallback ไปที่ AgentAvatar SVG

---

## Notes for Forge

- ใช้ dark theme เดียวกับส่วนอื่นของ maw office (`#0a0a0f`, `#1a1a24`)
- Field grid ควร responsive: 2 col บน desktop, 1 col บน mobile
- ไม่ต้องมี auth — maw ใช้คนเดียว
- SFW toggle ต้องชัดเจน ไม่ให้ user กด NSFW โดยไม่ตั้งใจ
