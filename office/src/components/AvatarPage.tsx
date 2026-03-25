import { useState, useEffect, useCallback, useRef } from "react";
import { AgentAvatar } from "./AgentAvatar";
import { apiUrl } from "../lib/api";
import { useFleetStore } from "../lib/store";
import type { AgentState } from "../lib/types";

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
  style: string;
}

interface AvatarFormState extends AvatarFields {
  sfw: boolean;
}

interface GenerateStatus {
  phase: "idle" | "pending" | "done" | "failed";
  jobId?: string;
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
  { key: "style", label: "Style", presets: ["chibi", "anime", "realistic"] },
  { key: "sex", label: "Sex", presets: ["Male", "Female", "Non-binary"] },
  { key: "race", label: "Race", presets: ["Human", "Robot", "Demon", "Alien"] },
  { key: "skinTone", label: "Skin Tone", presets: ["Fair", "Tan", "Dark", "Blue", "Purple", "Green"] },
  { key: "eyeColor", label: "Eye Color", presets: ["Brown", "Blue", "Red", "Gold", "Glowing White", "Purple"] },
  { key: "hairColor", label: "Hair Color", presets: ["Black", "White", "Silver", "Brown", "Blue", "Pink", "Rainbow"] },
  { key: "hairStyle", label: "Hair Style", presets: ["Short", "Long", "Ponytail", "Bob", "Braided", "Wild"] },
  { key: "bodyType", label: "Body Type", presets: ["Slim", "Average", "Muscular"] },
  { key: "expression", label: "Expression", presets: ["Cheerful", "Calm", "Focused", "Mysterious", "Mischievous"] },
];

const DEFAULTS: AvatarFormState = {
  style: "chibi", sex: "", race: "", skinTone: "", eyeColor: "",
  hairColor: "", hairStyle: "", bodyType: "", expression: "",
  appearance: "", sfw: true,
};

// ---- OracleSelector ----

function OracleSelector({ agents, selected, onSelect }: {
  agents: AgentState[];
  selected: string | null;
  onSelect: (name: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const selectedAgent = agents.find(a => a.name === selected);

  return (
    <div ref={ref} className="relative mb-6">
      <label className="block text-[11px] text-white/40 font-mono uppercase tracking-widest mb-1.5">
        Oracle
      </label>
      <button
        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors text-left"
        style={{
          background: "#0f0f18",
          borderColor: selected ? "#89b4fa44" : "#ffffff20",
        }}
        onClick={() => setOpen(o => !o)}
      >
        {selectedAgent ? (
          <>
            <div className="w-7 h-7 rounded-full overflow-hidden shrink-0 flex items-center justify-center" style={{ background: "#1a1a24" }}>
              <AgentAvatar name={selectedAgent.name} target={selectedAgent.target} status={selectedAgent.status} preview={selectedAgent.preview} accent="#89b4fa" onClick={() => { }} size={[28, 24]} viewBox="-55 -55 110 88" />
            </div>
            <span className="font-mono text-[13px]" style={{ color: "#89b4fa" }}>{selectedAgent.name}</span>
            <span className="text-[11px] text-white/30 font-mono">{selectedAgent.target}</span>
          </>
        ) : (
          <span className="font-mono text-[13px] text-white/30">Select an Oracle...</span>
        )}
        <span className="ml-auto text-white/20 text-[10px]">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div
          className="absolute z-50 top-full left-0 right-0 mt-1 rounded-xl border border-white/10 overflow-hidden shadow-xl"
          style={{ background: "#1a1a24" }}
        >
          {agents.length === 0 ? (
            <div className="px-4 py-3 text-[12px] text-white/30 font-mono">No active agents</div>
          ) : agents.map(agent => (
            <button
              key={agent.target}
              className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/5 transition-colors text-left"
              onClick={() => { onSelect(agent.name); setOpen(false); }}
            >
              <div className="w-6 h-6 rounded-full overflow-hidden shrink-0 flex items-center justify-center" style={{ background: "#0f0f18" }}>
                <AgentAvatar name={agent.name} target={agent.target} status={agent.status} preview={agent.preview} accent="#89b4fa" onClick={() => { }} size={[24, 21]} viewBox="-55 -55 110 88" />
              </div>
              <span className="font-mono text-[12px]" style={{ color: agent.name === selected ? "#89b4fa" : "#ccc" }}>
                {agent.name === selected ? "✓ " : ""}{agent.name}
              </span>
              <span className="text-[10px] text-white/25 font-mono ml-auto">{agent.target}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---- AvatarFieldEditor ----

function AvatarFieldEditor({ label, value, presets, onChange, onClose }: {
  label: string; value: string; presets: string[];
  onChange: (v: string) => void; onClose: () => void;
}) {
  const [custom, setCustom] = useState(presets.includes(value) ? "" : value);
  const [showCustom, setShowCustom] = useState(!presets.includes(value) && value !== "");

  return (
    <div className="absolute z-50 top-full left-0 mt-1 w-48 rounded-xl border border-white/10 shadow-xl overflow-hidden" style={{ background: "#1a1a24" }}>
      <div className="px-3 py-1.5 text-[10px] uppercase tracking-widest text-white/30 border-b border-white/8">{label}</div>
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
      >{"  "}Custom...</button>
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

function AvatarFieldRow({ fieldKey, label, presets, value, onChange, disabled }: {
  fieldKey: string; label: string; presets: string[];
  value: string; onChange: (v: string) => void; disabled?: boolean;
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
        className="w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors text-left"
        style={{ cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.4 : 1 }}
        onClick={() => !disabled && setOpen(o => !o)}
      >
        <span className="text-[11px] text-white/40 font-mono w-24 shrink-0">{label}</span>
        <span className="text-[12px] font-mono flex-1 text-right" style={{ color: value ? "#89b4fa" : "#444" }}>
          {value || "—"}
        </span>
        <span className="text-white/20 ml-2 text-[10px]">{open ? "▲" : "▼"}</span>
      </button>
      {open && !disabled && (
        <AvatarFieldEditor label={label} value={value} presets={presets} onChange={onChange} onClose={() => setOpen(false)} />
      )}
    </div>
  );
}

// ---- AvatarDisplay ----

function AvatarDisplay({ imageUrl, oracleName, onExpand }: { imageUrl: string | null; oracleName: string | null; onExpand: () => void }) {
  return (
    <div className="flex flex-col items-center mb-6">
      <div
        className="w-24 h-24 rounded-full overflow-hidden flex items-center justify-center border-2"
        style={{
          background: "#1a1a24",
          borderColor: imageUrl ? "#89b4fa44" : "#ffffff15",
          cursor: imageUrl ? "pointer" : "default",
        }}
        onClick={imageUrl ? onExpand : undefined}
        title={imageUrl ? "Click to expand" : undefined}
      >
        {imageUrl ? (
          <img src={imageUrl} alt="avatar" className="w-full h-full object-cover object-top" />
        ) : (
          <AgentAvatar
            name={oracleName || "oracle"}
            target="maw:0"
            status="ready"
            preview=""
            accent="#89b4fa"
            onClick={() => { }}
            size={[88, 78]}
            viewBox="-55 -55 110 88"
            forceSvg
          />
        )}
      </div>
      {!imageUrl && oracleName && (
        <span className="mt-1.5 text-[10px] text-white/20 font-mono">procedural svg</span>
      )}
    </div>
  );
}

// ---- ImageLightbox ----

function ImageLightbox({ src, onClose }: { src: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.85)" }}
      onClick={onClose}
    >
      <img
        src={src}
        alt="avatar full"
        className="max-h-[90vh] max-w-[90vw] object-contain rounded-xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      />
      <button
        className="absolute top-4 right-4 w-9 h-9 rounded-full flex items-center justify-center text-white/60 hover:text-white transition-colors"
        style={{ background: "#ffffff12", border: "1px solid #ffffff20" }}
        onClick={onClose}
      >
        ✕
      </button>
    </div>
  );
}

// ---- ConfirmModal ----

function ConfirmModal({ message, onConfirm, onCancel }: {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.7)" }}>
      <div className="rounded-2xl border border-white/10 shadow-2xl p-6 flex flex-col gap-4 w-72" style={{ background: "#16161f" }}>
        <p className="text-[13px] font-mono text-white/80 text-center leading-relaxed">{message}</p>
        <div className="flex gap-2 justify-center">
          <button
            className="px-4 py-1.5 rounded-lg text-[12px] font-mono transition-colors"
            style={{ background: "#ef535020", color: "#ef5350", border: "1px solid #ef535040" }}
            onClick={onConfirm}
          >
            Delete
          </button>
          <button
            className="px-4 py-1.5 rounded-lg text-[12px] font-mono transition-colors text-white/50 hover:text-white/80"
            style={{ background: "#ffffff08", border: "1px solid #ffffff15" }}
            onClick={onCancel}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ---- GalleryGrid ----

function GalleryGrid({ gallery, selectedId, oracleName, onSelect, onUseSvg, onDelete }: {
  gallery: GalleryEntry[];
  selectedId: string | null;
  oracleName: string;
  onSelect: (id: string) => void;
  onUseSvg: () => void;
  onDelete: (id: string) => void;
}) {
  const [confirmId, setConfirmId] = useState<string | null>(null);

  if (gallery.length === 0) return (
    <div className="mb-6 text-[11px] text-white/20 font-mono text-center py-4">
      No avatars generated yet for {oracleName}
    </div>
  );

  return (
    <div className="mb-6">
      {confirmId && (
        <ConfirmModal
          message="Delete this avatar? This cannot be undone."
          onConfirm={() => { onDelete(confirmId); setConfirmId(null); }}
          onCancel={() => setConfirmId(null)}
        />
      )}
      <div className="text-[11px] text-white/30 font-mono uppercase tracking-widest mb-2">
        Gallery — click to use
      </div>
      <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
        {/* SVG option */}
        <button
          className="aspect-square rounded-xl border-2 flex items-center justify-center transition-all overflow-hidden"
          style={{ background: "#0f0f18", borderColor: selectedId === null ? "#89b4fa" : "#ffffff15" }}
          onClick={onUseSvg}
          title="Use procedural SVG"
        >
          <AgentAvatar name={oracleName} target="maw:0" status="ready" preview="" accent="#89b4fa" onClick={() => { }} size={[40, 36]} viewBox="-55 -55 110 88" forceSvg />
        </button>

        {gallery.map(entry => (
          <div
            key={entry.id}
            className="relative aspect-square rounded-xl border-2 overflow-hidden group"
            style={{ borderColor: selectedId === entry.id ? "#89b4fa" : "#ffffff15", background: "#0f0f18" }}
          >
            <button
              className="absolute inset-0 w-full h-full"
              onClick={() => onSelect(entry.id)}
              title={new Date(entry.createdAt).toLocaleString()}
            >
              <img src={entry.imageUrl} alt="avatar" className="w-full h-full object-cover object-top" />
              {selectedId === entry.id && (
                <div className="absolute inset-0 flex items-end justify-center pb-1" style={{ background: "#89b4fa22" }}>
                  <span className="text-[9px] font-mono text-[#89b4fa] bg-black/60 px-1 rounded">active</span>
                </div>
              )}
            </button>
            {/* Delete button — visible on hover */}
            <button
              className="absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity z-10"
              style={{ background: "#ef535090", color: "#fff", fontSize: 10 }}
              onClick={(e) => { e.stopPropagation(); setConfirmId(entry.id); }}
              title="Delete avatar"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---- Main AvatarPage ----

export function AvatarPage({ agents }: { agents: AgentState[] }) {
  const [selectedOracle, setSelectedOracle] = useState<string | null>(null);
  const [form, setForm] = useState<AvatarFormState>(DEFAULTS);
  const [status, setStatus] = useState<GenerateStatus>({ phase: "idle" });
  const [currentImageUrl, setCurrentImageUrl] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [gallery, setGallery] = useState<GalleryEntry[]>([]);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const setAvatarUrls = useFleetStore((s) => s.setAvatarUrls);

  /** Re-fetch global avatar URLs so other pages update immediately */
  const refreshGlobalAvatars = useCallback(() => {
    fetch(apiUrl("/api/avatar/all"))
      .then(r => r.json())
      .then((data: Record<string, string | null>) => setAvatarUrls(data))
      .catch(() => { });
  }, [setAvatarUrls]);

  const fetchGallery = useCallback((name: string) => {
    fetch(apiUrl(`/api/avatar/gallery/${encodeURIComponent(name)}`))
      .then(r => r.json())
      .then((data: { gallery: GalleryEntry[] }) => setGallery(data.gallery || []))
      .catch(() => { });
  }, []);

  const fetchCurrent = useCallback((name: string) => {
    fetch(apiUrl(`/api/avatar/current/${encodeURIComponent(name)}`))
      .then(r => r.json())
      .then((data: { imageUrl: string | null; fields: AvatarFields | null; selectedId: string | null }) => {
        setCurrentImageUrl(data.imageUrl);
        setSelectedId(data.selectedId);
        if (data.fields && Object.keys(data.fields).length > 0) {
          setForm(f => ({ ...f, ...data.fields }));
        }
      })
      .catch(() => { });
  }, []);

  // Load when Oracle changes
  const handleSelectOracle = useCallback((name: string) => {
    setSelectedOracle(name);
    setStatus({ phase: "idle" });
    setCurrentImageUrl(null);
    setSelectedId(null);
    setGallery([]);
    setForm(DEFAULTS);
    fetchCurrent(name);
    fetchGallery(name);
  }, [fetchCurrent, fetchGallery]);

  // Poll job status
  const startPolling = useCallback((jobId: string, name: string) => {
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(apiUrl(`/api/avatar/status/${jobId}`));
        const data = await res.json() as { status: string; error?: string };
        if (data.status === "done") {
          clearInterval(pollRef.current!);
          setStatus({ phase: "done", jobId });
          fetchGallery(name); // refresh gallery to show new entry
        } else if (data.status === "failed") {
          clearInterval(pollRef.current!);
          setStatus({ phase: "failed", jobId, error: data.error || "Generation failed" });
        }
      } catch { /* ignore */ }
    }, 3000);
  }, [fetchGallery]);

  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  const setField = useCallback(<K extends keyof AvatarFormState>(key: K, value: AvatarFormState[K]) => {
    setForm(f => ({ ...f, [key]: value }));
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!selectedOracle) return;
    setStatus({ phase: "pending" });
    try {
      const { sfw, ...fields } = form;
      const res = await fetch(apiUrl("/api/avatar/generate"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: selectedOracle, fields, sfw }),
      });
      const data = await res.json() as { jobId?: string; valid?: boolean; reason?: string; error?: string };

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
        startPolling(data.jobId, selectedOracle);
      }
    } catch (e: any) {
      setStatus({ phase: "failed", error: e.message });
    }
  }, [form, selectedOracle, startPolling]);

  const handleSelectEntry = useCallback(async (entryId: string) => {
    if (!selectedOracle) return;
    try {
      const res = await fetch(apiUrl("/api/avatar/select"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: selectedOracle, entryId }),
      });
      const data = await res.json() as { ok: boolean; imageUrl: string | null; selectedId: string | null };
      if (data.ok) {
        setCurrentImageUrl(data.imageUrl);
        setSelectedId(data.selectedId);
        refreshGlobalAvatars();
      }
    } catch { }
  }, [selectedOracle, refreshGlobalAvatars]);

  const handleDeleteEntry = useCallback(async (entryId: string) => {
    if (!selectedOracle) return;
    try {
      const res = await fetch(apiUrl(`/api/avatar/gallery/${encodeURIComponent(selectedOracle)}/${encodeURIComponent(entryId)}`), {
        method: "DELETE",
      });
      const data = await res.json() as { ok: boolean };
      if (data.ok) {
        setGallery(g => g.filter(e => e.id !== entryId));
        // If deleted entry was active, clear selection locally
        if (selectedId === entryId) {
          setCurrentImageUrl(null);
          setSelectedId(null);
        }
        refreshGlobalAvatars();
      }
    } catch { }
  }, [selectedOracle, selectedId, refreshGlobalAvatars]);

  const handleUseSvg = useCallback(async () => {
    if (!selectedOracle) return;
    try {
      const res = await fetch(apiUrl("/api/avatar/select"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: selectedOracle, entryId: null }),
      });
      const data = await res.json() as { ok: boolean };
      if (data.ok) {
        setCurrentImageUrl(null);
        setSelectedId(null);
        refreshGlobalAvatars();
      }
    } catch { }
  }, [selectedOracle, refreshGlobalAvatars]);

  const locked = !selectedOracle;
  const leftFields = FIELDS.slice(0, 4);
  const rightFields = FIELDS.slice(4);

  return (
    <div className="max-w-lg mx-auto px-4 py-6" style={{ color: "#ccc" }}>
      <h1 className="text-lg font-mono font-bold text-white/80 mb-6">Oracle Avatar</h1>

      {/* Oracle selector — required first */}
      <OracleSelector agents={agents} selected={selectedOracle} onSelect={handleSelectOracle} />

      {/* Current avatar display */}
      <AvatarDisplay imageUrl={currentImageUrl} oracleName={selectedOracle} onExpand={() => setLightboxOpen(true)} />
      {lightboxOpen && currentImageUrl && (
        <ImageLightbox src={currentImageUrl} onClose={() => setLightboxOpen(false)} />
      )}

      {/* Gallery */}
      {selectedOracle && (
        <GalleryGrid
          gallery={gallery}
          selectedId={selectedId}
          oracleName={selectedOracle}
          onSelect={handleSelectEntry}
          onUseSvg={handleUseSvg}
          onDelete={handleDeleteEntry}
        />
      )}

      {/* Divider */}
      {selectedOracle && (
        <div className="border-t border-white/6 mb-5 pt-5">
          <div className="text-[11px] text-white/30 font-mono uppercase tracking-widest mb-3">
            Generate new avatar for {selectedOracle}
          </div>
        </div>
      )}

      {/* Field grid */}
      <div
        className="grid grid-cols-1 sm:grid-cols-2 gap-1 mb-4 rounded-xl border border-white/8 overflow-visible"
        style={{ background: "#0f0f18", opacity: locked ? 0.4 : 1 }}
      >
        <div className="flex flex-col divide-y divide-white/5">
          {leftFields.map(f => (
            <AvatarFieldRow key={f.key} fieldKey={f.key} label={f.label} presets={f.presets}
              value={form[f.key]} onChange={v => setField(f.key, v)} disabled={locked}
            />
          ))}
        </div>
        <div className="flex flex-col divide-y divide-white/5 sm:border-l border-white/5">
          {rightFields.map(f => (
            <AvatarFieldRow key={f.key} fieldKey={f.key} label={f.label} presets={f.presets}
              value={form[f.key]} onChange={v => setField(f.key, v)} disabled={locked}
            />
          ))}
        </div>
      </div>

      {/* Appearance */}
      <div className="mb-4" style={{ opacity: locked ? 0.4 : 1 }}>
        <label className="block text-[11px] text-white/40 font-mono mb-1">Appearance</label>
        <textarea
          className="w-full rounded-xl border border-white/8 px-3 py-2 text-[12px] font-mono text-white/80 resize-none outline-none focus:border-[#89b4fa]/40 transition-colors"
          style={{ background: "#0f0f18", minHeight: 72 }}
          rows={3}
          placeholder="chibi Oracle with purple hair, glowing eyes, holding a book..."
          value={form.appearance}
          onChange={e => setField("appearance", e.target.value)}
          disabled={locked}
        />
      </div>

      {/* SFW toggle */}
      <div className="mb-5 flex items-center gap-3" style={{ opacity: locked ? 0.4 : 1 }}>
        <button
          className="relative w-12 h-6 rounded-full transition-colors flex-shrink-0"
          style={{ background: form.sfw ? "#4caf50" : "#ef5350", cursor: locked ? "not-allowed" : "pointer" }}
          onClick={() => !locked && setField("sfw", !form.sfw)}
        >
          <span className="absolute left-0 top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform"
            style={{ transform: form.sfw ? "translateX(26px)" : "translateX(2px)" }}
          />
        </button>
        <span className="text-[12px] font-mono" style={{ color: form.sfw ? "#4caf50" : "#ef5350" }}>
          {form.sfw ? "SFW" : "NSFW"}
        </span>
        {!form.sfw && <span className="text-[11px] text-white/30">uses Grok model</span>}
      </div>

      {/* Status */}
      {status.phase === "failed" && status.error && (
        <div className="mb-4 px-3 py-2 rounded-lg text-[12px] font-mono" style={{ background: "#ef535015", color: "#ef9a9a", border: "1px solid #ef535030" }}>
          {status.error}
        </div>
      )}
      {status.phase === "done" && (
        <div className="mb-4 px-3 py-2 rounded-lg text-[12px] font-mono" style={{ background: "#4caf5015", color: "#a5d6a7", border: "1px solid #4caf5030" }}>
          Added to gallery — click an avatar above to use it
        </div>
      )}

      {/* Generate button */}
      <button
        className="w-full py-2.5 rounded-xl font-mono text-[13px] font-semibold transition-all"
        style={{
          background: locked || status.phase === "pending" ? "#89b4fa22" : "#89b4fa",
          color: locked || status.phase === "pending" ? "#89b4fa66" : "#0a0a0f",
          cursor: locked || status.phase === "pending" ? "not-allowed" : "pointer",
          border: "1px solid #89b4fa44",
        }}
        onClick={!locked && status.phase !== "pending" ? handleGenerate : undefined}
        disabled={locked || status.phase === "pending"}
      >
        {locked
          ? "Select an Oracle first"
          : status.phase === "pending"
            ? "Generating... (may take ~30s)"
            : `Generate Avatar for ${selectedOracle}`}
      </button>
    </div>
  );
}
