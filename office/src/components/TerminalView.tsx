import { memo, useState, useEffect, useRef, useCallback } from "react";
import { ansiToHtml } from "../lib/ansi";
import { roomStyle } from "../lib/constants";
import { wsUrl } from "../lib/api";
import type { Session, AgentState } from "../lib/types";
import { CommandAwareInput } from "./CommandAwareInput";

interface TerminalViewProps {
  sessions: Session[];
  agents: AgentState[];
  connected: boolean;
  onSelectAgent: (agent: AgentState) => void;
}

export const TerminalView = memo(function TerminalView({ sessions, agents, connected, onSelectAgent }: TerminalViewProps) {
  const [selectedTarget, setSelectedTarget] = useState<string | null>(null);
  const [captureHtml, setCaptureHtml] = useState("");
  const [inputBuf, setInputBuf] = useState("");
  const [sendQueue, setSendQueue] = useState<string[]>([]);
  const [listening, setListening] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const outputRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const sendingRef = useRef(false);
  const recognitionRef = useRef<any>(null);

  // Own WebSocket for capture stream (separate from main fleet WS)
  useEffect(() => {
    const ws = new WebSocket(wsUrl("/ws"));
    wsRef.current = ws;

    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.type === "capture") {
          const out = outputRef.current;
          const atBottom = out ? out.scrollHeight - out.scrollTop - out.clientHeight < 60 : true;
          setCaptureHtml(ansiToHtml(data.content || "(empty)"));
          if (atBottom) requestAnimationFrame(() => out?.scrollTo(0, out.scrollHeight));
        }
      } catch {}
    };

    ws.onclose = () => { wsRef.current = null; };
    ws.onerror = () => ws.close();

    return () => { ws.close(); wsRef.current = null; };
  }, []);

  // Subscribe when target changes
  useEffect(() => {
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN && selectedTarget) {
      ws.send(JSON.stringify({ type: "subscribe", target: selectedTarget }));
      ws.send(JSON.stringify({ type: "select", target: selectedTarget }));
    }
  }, [selectedTarget]);

  // Re-subscribe when WS reconnects
  useEffect(() => {
    const ws = wsRef.current;
    if (!ws) return;
    const handler = () => {
      if (selectedTarget) ws.send(JSON.stringify({ type: "subscribe", target: selectedTarget }));
    };
    ws.addEventListener("open", handler);
    return () => ws.removeEventListener("open", handler);
  }, [selectedTarget]);

  const selectWindow = useCallback((target: string) => {
    setSelectedTarget(target);
    setCaptureHtml("");
    setInputBuf("");
    setSendQueue([]);
    setSidebarOpen(false);
    inputRef.current?.focus();
  }, []);

  // Flush send queue
  useEffect(() => {
    if (sendingRef.current || sendQueue.length === 0) return;
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN || !selectedTarget) return;

    sendingRef.current = true;
    const text = sendQueue[0];
    ws.send(JSON.stringify({ type: "send", target: selectedTarget, text, force: true }));
    setTimeout(() => {
      setSendQueue(q => q.slice(1));
      sendingRef.current = false;
    }, 100);
  }, [sendQueue, selectedTarget]);

  const queueSend = useCallback((text: string) => {
    if (!text || !selectedTarget) return;
    setSendQueue(q => [...q, text]);
  }, [selectedTarget]);

  // Voice input — Web Speech API
  const toggleVoice = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    if (listening) {
      recognitionRef.current?.stop();
      return;
    }

    const rec = new SpeechRecognition();
    rec.lang = "th-TH";
    rec.interimResults = true;
    rec.continuous = false;
    recognitionRef.current = rec;

    let interimStart = 0;

    rec.onstart = () => setListening(true);

    rec.onresult = (e: any) => {
      const results = Array.from(e.results as SpeechRecognitionResultList);
      // Replace interim text: remove previous interim, append new
      const interim = results
        .filter((r: any) => !r.isFinal)
        .map((r: any) => r[0].transcript)
        .join("");
      const finals = results
        .filter((r: any) => r.isFinal)
        .map((r: any) => r[0].transcript)
        .join("");

      setInputBuf(b => {
        const base = b.slice(0, interimStart);
        if (finals) {
          interimStart = base.length + finals.length;
          return base + finals + interim;
        }
        return base + interim;
      });
    };

    rec.onerror = () => { setListening(false); recognitionRef.current = null; };
    rec.onend = () => { setListening(false); recognitionRef.current = null; inputRef.current?.focus(); };

    rec.start();
  }, [listening]);

  // Cleanup on unmount
  useEffect(() => () => { recognitionRef.current?.stop(); }, []);

  // Keyboard handler for the textarea composer
  const handleTextareaKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Alt+Arrow to navigate between windows
    if (e.altKey && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
      e.preventDefault();
      if (!selectedTarget) return;
      const allWindows = sessions.flatMap(s => s.windows.map(w => ({ target: `${s.name}:${w.index}`, name: w.name })));
      const idx = allWindows.findIndex(w => w.target === selectedTarget);
      if (idx < 0) return;
      const dir = e.key === "ArrowLeft" ? -1 : 1;
      const next = allWindows[(idx + dir + allWindows.length) % allWindows.length];
      selectWindow(next.target);
      return;
    }

    if (!selectedTarget) return;

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      // Use e.currentTarget.value instead of inputBuf closure to avoid stale state
      const text = e.currentTarget.value;
      if (text.trim()) { queueSend(text); setInputBuf(""); }
    } else if (e.key === "Escape") {
      e.preventDefault();
      setInputBuf(""); setSendQueue([]);
    } else if (e.key === "c" && e.ctrlKey) {
      e.preventDefault();
      setInputBuf(""); setSendQueue([]);
    } else if (e.key === "Tab") {
      e.preventDefault();
      const text = e.currentTarget.value;
      queueSend(text + "\t");
      setInputBuf("");
    }
  }, [selectedTarget, queueSend, selectWindow, sessions]);

  // Get display name for selected target
  const selectedName = selectedTarget
    ? sessions.flatMap(s => s.windows.map(w => ({ target: `${s.name}:${w.index}`, name: w.name }))).find(w => w.target === selectedTarget)?.name || ""
    : "";

  // Sidebar content — shared between desktop and mobile drawer
  const sidebarContent = (
    <div className="flex flex-col h-full overflow-y-auto" style={{ background: "#08080e" }}>
      {sessions.map(session => {
        const style = roomStyle(session.name);
        return (
          <div key={session.name} className="py-1">
            <div className="px-4 py-1 text-[10px] uppercase tracking-[1px]" style={{ color: style.accent + "80" }}>
              {session.name}
            </div>
            {session.windows.map(w => {
              const target = `${session.name}:${w.index}`;
              const isSelected = target === selectedTarget;
              const agent = agents.find(a => a.target === target);
              const statusColor = agent?.status === "busy" ? "#ffa726" : agent?.status === "ready" ? "#4caf50" : "#333";
              return (
                <div
                  key={target}
                  className="flex items-center gap-2 py-1.5 cursor-pointer transition-colors"
                  style={{
                    paddingLeft: 12, paddingRight: 12,
                    background: isSelected ? `${style.accent}12` : "transparent",
                    borderLeft: isSelected ? `3px solid ${style.accent}` : "3px solid transparent",
                  }}
                  onClick={() => selectWindow(target)}
                >
                  <span className="text-[11px] font-mono text-white/30 w-4 text-right shrink-0">{w.index}</span>
                  <span className="text-[12px] font-mono truncate" style={{ color: isSelected ? style.accent : "#999" }}>
                    {w.name}
                  </span>
                  <span
                    className="w-1.5 h-1.5 rounded-full ml-auto shrink-0"
                    style={{ background: statusColor, boxShadow: w.active ? `0 0 4px ${statusColor}` : undefined }}
                  />
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="flex mx-2 sm:mx-6 mb-3 rounded-2xl overflow-hidden border border-white/ relative h-full">
      {/* Sidebar — desktop: permanent, mobile: hidden */}
      <div className="hidden sm:flex w-55 shrink-0 flex-col border-r border-white/">
        {sidebarContent}
      </div>

      {/* Mobile drawer overlay */}
      {sidebarOpen && (
        <div className="sm:hidden absolute inset-0 z-20 flex">
          {/* Backdrop */}
          <div
            className="absolute inset-0"
            style={{ background: "rgba(0,0,0,0.6)" }}
            onClick={() => setSidebarOpen(false)}
          />
          {/* Drawer */}
          <div className="relative z-10 w-65 shrink-0 flex flex-col border-r border-white/">
            {sidebarContent}
          </div>
        </div>
      )}

      {/* Terminal pane */}
      <div
        ref={termRef}
        className="flex-1 flex flex-col min-w-0 outline-none"
        onClick={() => inputRef.current?.focus()}
      >
        {/* Header — tap on mobile to open drawer */}
        <div
          className="flex items-center gap-3 px-4 py-2 border-b border-white/ shrink-0"
          style={{ background: "#0a0a12" }}
        >
          {/* Hamburger — mobile only */}
          <button
            className="sm:hidden shrink-0 text-white/40 hover:text-white/80 mr-1"
            onClick={(e) => { e.stopPropagation(); setSidebarOpen(o => !o); }}
            aria-label="toggle window list"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <rect y="2" width="16" height="2" rx="1"/>
              <rect y="7" width="16" height="2" rx="1"/>
              <rect y="12" width="16" height="2" rx="1"/>
            </svg>
          </button>
          <span
            className="text-xs font-mono text-white/40 cursor-pointer sm:cursor-default truncate"
            onClick={() => setSidebarOpen(o => !o)}
          >
            {selectedName || "select a window"}
          </span>
          {selectedTarget && <span className="hidden sm:inline text-[10px] font-mono text-white/20">{selectedTarget}</span>}
          <span className="ml-auto text-[10px] font-mono shrink-0" style={{ color: connected ? "#4caf50" : "#ef5350" }}>
            {connected ? "live" : "reconnecting"}
          </span>
        </div>

        {/* Output */}
        <div
          ref={outputRef}
          className="flex-1 overflow-y-auto px-3 py-2 font-mono text-[11px] sm:text-[13px] leading-[1.35]"
          style={{ background: "#0a0a0f", whiteSpace: "pre", wordBreak: "normal", overflowX: "auto", color: "#aaa" }}
        >
          {captureHtml ? (
            <div dangerouslySetInnerHTML={{ __html: captureHtml }} />
          ) : (
            <div className="text-white/15 text-center mt-[30vh] text-sm">
              {selectedTarget ? "connecting..." : "select a window \u2190"}
            </div>
          )}
        </div>

        {/* Composer */}
        <div
          className="flex items-center gap-2 px-3 py-2 border-t border-white/6"
          style={{ background: "#0d0d14" }}
        >
          {/* Voice button — left */}
          {((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition) && (
            <button
              title={listening ? "stop listening" : "voice input (th)"}
              className="shrink-0 text-[18px] select-none transition-opacity pb-1"
              style={{ opacity: selectedTarget ? 1 : 0.3, cursor: selectedTarget ? "pointer" : "default" }}
              onClick={selectedTarget ? toggleVoice : undefined}
            >
              {listening ? "🔴" : "🎙️"}
            </button>
          )}

          {/* CommandAwareInput — center */}
          <div className="flex-1 min-w-0 flex flex-row items-center justify-start">
            <CommandAwareInput
              ref={inputRef}
              value={inputBuf}
              onChange={(e) => setInputBuf(e.target.value)}
              onKeyDown={handleTextareaKeyDown}
              placeholder={selectedTarget ? "type a command..." : "select a window first"}
              disabled={!selectedTarget}
              minRows={1}
              maxRows={6}
            />
            {selectedTarget && !inputBuf && (
              <span className="hidden sm:inline text-[10px] font-mono text-white/20 px-3 pb-0.5">
                Enter ↵ send · Shift+Enter newline
              </span>
            )}
          </div>

          {/* Queue indicator */}
          {sendQueue.length > 0 && (
            <span className="shrink-0 text-[11px] font-mono text-white/30 pb-1.5">
              {sendQueue.length}q
            </span>
          )}

          {/* Clear button */}
          {(inputBuf || sendQueue.length > 0) && (
            <button
              title="clear"
              className="text-white bg-red-500 hover:bg-red-400 mr-2 transition-colors text-sm p-2 rounded-full h-6 w-6 flex items-center justify-center"
              onClick={() => { setInputBuf(""); setSendQueue([]); inputRef.current?.focus(); }}
            >
              ✕
            </button>
          )}

          {/* Send button */}
          {inputBuf.trim() && selectedTarget && (
            <button
              title="send (Enter)"
              className="px-2 py-0.5 rounded font-mono text-lg sm:text-2xl select-none h-10 w-10 flex items-center justify-center"
              style={{ background: "#89b4fa22", color: "#89b4fa" }}
              onClick={() => { queueSend(inputBuf); setInputBuf(""); inputRef.current?.focus(); }}
            >
              <span className="-translate-y-0.5">↵</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
});
