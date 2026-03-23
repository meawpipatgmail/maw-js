import { useState, useEffect, useCallback, useRef } from "react";
import { AgentAvatar } from "./AgentAvatar";
import { apiUrl } from "../lib/api";

// ---- Types ----

interface AvatarFields {
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

interface AvatarFormState extends AvatarFields {
  sfw: boolean;
}

interface GenerateStatus {
  phase: "idle" | "pending" | "done" | "failed";
  jobId?: string;
  imageUrl?: string;
  error?: string;
}

interface GalleryEntry {
  id: string;
  imageUrl: string;
  fields: AvatarFields;
  createdAt: string;
}

// ---- Field definitions ----

const FIELDS: { key: keyof AvatarFields; label: string; presets: string[] }[] = [
  { key: "sex", label: "Sex", presets: ["Male", "Female", "Non-binary"] },
  { key: "race", label: "Race", presets: ["Human", "Robot", "Demon", "Alien"] },
  { key: "skinTone", label: "Skin Tone", presets: ["Fair", "Tan", "Dark", "Blue", "Purple", "Green"] },
  { key: "eyeColor", label: "Eye Color", presets: ["Brown", "Blue", "Red", "Gold", "Glowing White", "Purple"] },
  { key: "hairColor", label: "Hair Color", presets: ["Black", "White", "Silver", "Brown", "Blue", "Pink", "Rainbow"] },
  { key: "hairStyle", label: "Hair Style", presets: ["Short", "Long", "Ponytail", "Bob", "Braided", "Wild"] },
  { key: "bodyType", label: "Body Type", presets: ["Slim", "Average", "Chibi", "Muscular"] },
  { key: "expression", label: "Expression", presets: ["Cheerful", "Calm", "Focused", "Mysterious", "Mischievous"] },
];

const DEFAULTS: AvatarFormState = {
  sex: "", race: "", skinTone: "", eyeColor: "",
  hairColor: "", hairStyle: "", bodyType: "", expression: "",
  appearance: "", sfw: true,
};

// ---- AvatarFieldEditor ----

function AvatarFieldEditor({ label, value, presets, onChange, onClose }: {
  label: string; value: string; presets: string[];
  onChange: (v: string) => void; onClose: () => void;
}) {
  const [custom, setCustom] = useState(presets.includes(value) ? "" : value);
  const [showCustom, setShowCustom] = useState(!presets.includes(value) && value !== "");

  return (
    <div
      className="absolute z-50 top-full left-0 mt-1 w-48 rounded-xl border border-white/10 shadow-xl overflow-hidden"
      style={{ background: "#1a1a24" }}
    >
      <div className="px-3 py-1.5 text-[10px] uppercase tracking-widest text-white/30 border-b border-white/8">
        {label}
      </div>
      {presets.map(p => (
        <button key={p} className="w-full text-left px-3 py-1.5 text-[12px] font-mono hover:bg-white/6 transition-colors"
          style={{ color: value === p ? "#89b4fa" : "#ccc" }}
          onClick={() => { onChange(p); onClose(); }}
        >
          {value === p ? "✓ " : "  "}{p}
        </button>
      ))}
      <button className="w-full text-left px-3 py-1.5 text-[12px] font-mono hover:bg-white/6 transition-colors text-white/40"
        onClick={() => setShowCustom(true)}
      >
        {"  "}Custom...
      </button>
      {showCustom && (
        <div className="px-3 pb-2">
          <input autoFocus
            className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-[12px] font-mono text-white outline-none focus:border-[#89b4fa]/50"
            placeholder="type custom value..."
            value={custom}
            onChange={e => setCustom(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter" && custom.trim()) { onChange(custom.trim()); onClose(); }
              if (e.key === "Escape") onClose();
            }}
          />
        </div>
      )}
    </div>
  );
}

// ---- AvatarFieldRow ----

function AvatarFieldRow({ fieldKey, label, presets, value, onChange }: {
  fieldKey: string; label: string; presets: string[];
  value: string; onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const rowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (rowRef.current && !rowRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={rowRef} className="relative">
      <button
        className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-white/5 transition-colors text-left"
        onClick={() => setOpen(o => !o)}
      >
        <span className="text-[11px] text-white/40 font-mono w-24 shrink-0">{label}</span>
        <span className="text-[12px] font-mono flex-1 text-right" style={{ color: value ? "#89b4fa" : "#444" }}>
          {value || "—"}
        </span>
        <span className="text-white/20 ml-2 text-[10px]">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <AvatarFieldEditor label={label} value={value} presets={presets}
          onChange={onChange} onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}

// ---- AvatarDisplay ----

function AvatarDisplay({ imageUrl, selectedId }: { imageUrl: string | null; selectedId: string | null }) {
  return (
    <div className="flex justify-center mb-6">
      <div
        className="w-28 h-28 rounded-full overflow-hidden flex items-center justify-center border-2"
        style={{ background: "#1a1a24", borderColor: imageUrl ? "#89b4fa44" : "#ffffff22" }}
      >
        {imageUrl ? (
          <img src={imageUrl} alt="avatar" className="w-full h-full object-cover" />
        ) : (
          <svg width={100} height={88} viewBox="-55 -55 110 88" style={{ overflow: "visible" }}>
            <AgentAvatar name="oracle" target="maw:0" status="ready" preview="" accent="#89b4fa" onClick={() => {}} />
          </svg>
        )}
      </div>
      {!imageUrl && (
        <div className="absolute mt-32 text-[10px] text-white/20 font-mono">procedural svg</div>
      )}
    </div>
  );
}

// ---- GalleryGrid ----

function GalleryGrid({ gallery, selectedId, onSelect, onUseSvg }: {
  gallery: GalleryEntry[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onUseSvg: () => void;
}) {
  if (gallery.length === 0) return null;

  return (
    <div className="mb-6">
      <div className="text-[11px] text-white/30 font-mono uppercase tracking-widest mb-2">Gallery</div>
      <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
        {/* SVG fallback option */}
        <button
          className="aspect-square rounded-xl border-2 flex items-center justify-center transition-all overflow-hidden"
          style={{
            background: "#0f0f18",
            borderColor: selectedId === null ? "#89b4fa" : "#ffffff15",
          }}
          onClick={onUseSvg}
          title="Use procedural SVG"
        >
          <svg width={40} height={36} viewBox="-55 -55 110 88" style={{ overflow: "visible" }}>
            <AgentAvatar name="oracle" target="maw:0" status="ready" preview="" accent="#89b4fa" onClick={() => {}} />
          </svg>
        </button>

        {gallery.map(entry => (
          <button
            key={entry.id}
            className="aspect-square rounded-xl border-2 overflow-hidden transition-all"
            style={{
              borderColor: selectedId === entry.id ? "#89b4fa" : "#ffffff15",
              background: "#0f0f18",
            }}
            onClick={() => onSelect(entry.id)}
            title={new Date(entry.createdAt).toLocaleString()}
          >
            <img src={entry.imageUrl} alt="avatar" className="w-full h-full object-cover" />
          </button>
        ))}
      </div>
    </div>
  );
}

// ---- Main AvatarPage ----

const TARGET = "maw:0";

export function AvatarPage() {
  const [form, setForm] = useState<AvatarFormState>(DEFAULTS);
  const [status, setStatus] = useState<GenerateStatus>({ phase: "idle" });
  const [currentImageUrl, setCurrentImageUrl] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [gallery, setGallery] = useState<GalleryEntry[]>([]);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchGallery = useCallback(() => {
    fetch(apiUrl(`/api/avatar/gallery/${encodeURIComponent(TARGET)}`))
      .then(r => r.json())
      .then((data: { gallery: GalleryEntry[] }) => setGallery(data.gallery || []))
      .catch(() => {});
  }, []);

  // Load current selection + gallery on mount
  useEffect(() => {
    fetch(apiUrl(`/api/avatar/current/${encodeURIComponent(TARGET)}`))
      .then(r => r.json())
      .then((data: { imageUrl: string | null; fields: AvatarFields | null; selectedId: string | null }) => {
        setCurrentImageUrl(data.imageUrl);
        setSelectedId(data.selectedId);
        if (data.fields) setForm(f => ({ ...f, ...data.fields }));
      })
      .catch(() => {});
    fetchGallery();
  }, [fetchGallery]);

  // Poll job status
  const startPolling = useCallback((jobId: string) => {
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(apiUrl(`/api/avatar/status/${jobId}`));
        const data = await res.json() as { status: string; imageUrl?: string; error?: string };
        if (data.status === "done") {
          clearInterval(pollRef.current!);
          setStatus({ phase: "done", jobId, imageUrl: data.imageUrl });
          if (data.imageUrl) setCurrentImageUrl(data.imageUrl);
          fetchGallery();
          // Refresh current selection to get new selectedId
          fetch(apiUrl(`/api/avatar/current/${encodeURIComponent(TARGET)}`))
            .then(r => r.json())
            .then((d: { selectedId: string | null }) => setSelectedId(d.selectedId))
            .catch(() => {});
        } else if (data.status === "failed") {
          clearInterval(pollRef.current!);
          setStatus({ phase: "failed", jobId, error: data.error || "Generation failed" });
        }
      } catch {
        // ignore poll errors
      }
    }, 3000);
  }, [fetchGallery]);

  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  const setField = useCallback(<K extends keyof AvatarFormState>(key: K, value: AvatarFormState[K]) => {
    setForm(f => ({ ...f, [key]: value }));
  }, []);

  const handleGenerate = useCallback(async () => {
    setStatus({ phase: "pending" });
    try {
      const { sfw, ...fields } = form;
      const res = await fetch(apiUrl("/api/avatar/generate"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target: TARGET, fields, sfw }),
      });
      const data = await res.json() as { jobId?: string; status?: string; valid?: boolean; reason?: string; error?: string };

      if (data.valid === false) {
        setStatus({ phase: "failed", error: data.reason || "Content rejected by validator" });
        return;
      }
      if (data.error) {
        setStatus({ phase: "failed", error: data.error });
        return;
      }
      if (data.jobId) {
        setStatus({ phase: "pending", jobId: data.jobId });
        startPolling(data.jobId);
      }
    } catch (e: any) {
      setStatus({ phase: "failed", error: e.message });
    }
  }, [form, startPolling]);

  const handleSelectEntry = useCallback(async (entryId: string) => {
    try {
      const res = await fetch(apiUrl("/api/avatar/select"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target: TARGET, entryId }),
      });
      const data = await res.json() as { ok: boolean; imageUrl: string | null; selectedId: string | null };
      if (data.ok) {
        setCurrentImageUrl(data.imageUrl);
        setSelectedId(data.selectedId);
      }
    } catch {}
  }, []);

  const handleUseSvg = useCallback(async () => {
    try {
      const res = await fetch(apiUrl("/api/avatar/select"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target: TARGET, entryId: null }),
      });
      const data = await res.json() as { ok: boolean };
      if (data.ok) {
        setCurrentImageUrl(null);
        setSelectedId(null);
      }
    } catch {}
  }, []);

  const leftFields = FIELDS.slice(0, 4);
  const rightFields = FIELDS.slice(4);

  return (
    <div className="max-w-lg mx-auto px-4 py-6" style={{ color: "#ccc" }}>
      <h1 className="text-lg font-mono font-bold text-white/80 mb-6">Oracle Avatar</h1>

      <AvatarDisplay imageUrl={currentImageUrl} selectedId={selectedId} />

      <GalleryGrid
        gallery={gallery}
        selectedId={selectedId}
        onSelect={handleSelectEntry}
        onUseSvg={handleUseSvg}
      />

      {/* Field grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 mb-4 rounded-xl border border-white/8 overflow-visible" style={{ background: "#0f0f18" }}>
        <div className="flex flex-col divide-y divide-white/5">
          {leftFields.map(f => (
            <AvatarFieldRow key={f.key} fieldKey={f.key} label={f.label} presets={f.presets}
              value={form[f.key]} onChange={v => setField(f.key, v)}
            />
          ))}
        </div>
        <div className="flex flex-col divide-y divide-white/5 sm:border-l border-white/5">
          {rightFields.map(f => (
            <AvatarFieldRow key={f.key} fieldKey={f.key} label={f.label} presets={f.presets}
              value={form[f.key]} onChange={v => setField(f.key, v)}
            />
          ))}
        </div>
      </div>

      {/* Appearance textarea */}
      <div className="mb-4">
        <label className="block text-[11px] text-white/40 font-mono mb-1">Appearance</label>
        <textarea
          className="w-full rounded-xl border border-white/8 px-3 py-2 text-[12px] font-mono text-white/80 resize-none outline-none focus:border-[#89b4fa]/40 transition-colors"
          style={{ background: "#0f0f18", minHeight: 72 }}
          rows={3}
          placeholder="chibi Oracle with purple hair, glowing eyes, holding a book..."
          value={form.appearance}
          onChange={e => setField("appearance", e.target.value)}
        />
      </div>

      {/* SFW toggle */}
      <div className="mb-5 flex items-center gap-3">
        <button
          className="relative w-12 h-6 rounded-full transition-colors flex-shrink-0"
          style={{ background: form.sfw ? "#4caf50" : "#ef5350" }}
          onClick={() => setField("sfw", !form.sfw)}
          title={form.sfw ? "SFW mode" : "NSFW mode"}
        >
          <span
            className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform"
            style={{ transform: form.sfw ? "translateX(2px)" : "translateX(26px)" }}
          />
        </button>
        <span className="text-[12px] font-mono" style={{ color: form.sfw ? "#4caf50" : "#ef5350" }}>
          {form.sfw ? "SFW" : "NSFW"}
        </span>
        {!form.sfw && (
          <span className="text-[11px] text-white/30">NSFW content — uses Grok model</span>
        )}
      </div>

      {/* Status messages */}
      {status.phase === "failed" && status.error && (
        <div className="mb-4 px-3 py-2 rounded-lg text-[12px] font-mono" style={{ background: "#ef535015", color: "#ef9a9a", border: "1px solid #ef535030" }}>
          {status.error}
        </div>
      )}
      {status.phase === "done" && (
        <div className="mb-4 px-3 py-2 rounded-lg text-[12px] font-mono" style={{ background: "#4caf5015", color: "#a5d6a7", border: "1px solid #4caf5030" }}>
          Avatar generated — check gallery above
        </div>
      )}

      {/* Generate button */}
      <button
        className="w-full py-2.5 rounded-xl font-mono text-[13px] font-semibold transition-all"
        style={{
          background: status.phase === "pending" ? "#89b4fa22" : "#89b4fa",
          color: status.phase === "pending" ? "#89b4fa" : "#0a0a0f",
          cursor: status.phase === "pending" ? "not-allowed" : "pointer",
          border: "1px solid #89b4fa44",
        }}
        onClick={status.phase !== "pending" ? handleGenerate : undefined}
        disabled={status.phase === "pending"}
      >
        {status.phase === "pending" ? "Generating... (may take ~30s)" : "Generate Avatar"}
      </button>
    </div>
  );
}
