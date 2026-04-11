import { useState, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import { useHookStore } from "../stores/hookStore";
import { useChatStore } from "../stores/chatStore";
import { useUIStore } from "../stores/uiStore";
import { useSessionStore } from "../stores/sessionStore";
import type { HookResultPayload } from "../types";

// ── Branch Options renderer ──────────────────────────────────────────────────

interface BranchOption {
  label?: string;
  prompt?: string;
  [key: string]: unknown;
}

function BranchOptionsResult({
  payload,
  onDismiss,
}: {
  payload: HookResultPayload;
  onDismiss: () => void;
}) {
  const sendBranchMessage = useChatStore((s) => s.sendBranchMessage);
  const messages = useChatStore((s) => s.messages);
  const isStreaming = useChatStore((s) => s.isStreaming);

  // result should be an array of {label, prompt}
  const raw = payload.result;
  const options: BranchOption[] = Array.isArray(raw) ? raw : [];

  const handleSend = useCallback(
    (promptText: string) => {
      const content = promptText.trim();
      if (!content || isStreaming) return;
      // Branch from last assistant message
      const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
      if (lastAssistant) {
        sendBranchMessage(content, lastAssistant.id);
      } else {
        // Fallback: send as normal message via chatStore sendMessage
        useChatStore.getState().sendMessage(content);
      }
      onDismiss();
    },
    [isStreaming, messages, sendBranchMessage, onDismiss]
  );

  if (options.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5 bg-[var(--bg-secondary)] px-2.5 py-1.5 rounded-xl border border-[var(--border)] shadow-inner">
      <span className="text-xs text-indigo-400/80 mr-1 whitespace-nowrap font-medium tracking-wide">⚡ 选项</span>
      {options.map((opt, i) => {
        const promptText = String(opt.prompt ?? opt);
        return (
          <button
            key={i}
            className="px-2.5 py-1 text-[13px] rounded-lg border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 flex items-center gap-1.5 hover:bg-indigo-500/20 hover:border-indigo-500/50 hover:shadow-md hover:-translate-y-px transition-all disabled:opacity-40 disabled:cursor-not-allowed max-w-full text-left"
            onClick={() => handleSend(promptText)}
            title={promptText}
            disabled={isStreaming}
          >
            {opt.label && (
              <span className="text-[10px] font-medium opacity-80 shrink-0 uppercase tracking-wider bg-indigo-500/20 px-1 rounded">
                {opt.label}
              </span>
            )}
            <span className="truncate min-w-0 max-w-[240px] leading-tight">{promptText}</span>
          </button>
        );
      })}
    </div>
  );
}

// ── Show Panel renderer ──────────────────────────────────────────────────────

function ShowPanelResult({ payload }: { payload: HookResultPayload }) {
  const [collapsed, setCollapsed] = useState(false);
  const title = payload.action.panel_title || payload.hook_name;
  const content = typeof payload.result === "string" ? payload.result : JSON.stringify(payload.result, null, 2);

  return (
    <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium text-gray-300 hover:text-gray-100 hover:bg-[var(--bg-tertiary)] transition-colors"
        onClick={() => setCollapsed((c) => !c)}
      >
        <span>{title}</span>
        <span className="text-gray-500 text-xs">{collapsed ? "▶" : "▼"}</span>
      </button>
      {!collapsed && (
        <div className="px-4 py-3 text-[13px] text-gray-300 border-t border-[var(--border)] prose prose-invert prose-sm max-w-none">
          <ReactMarkdown>{content}</ReactMarkdown>
        </div>
      )}
    </div>
  );
}

// ── Custom Script runner ─────────────────────────────────────────────────────

function CustomScriptResult({ payload }: { payload: HookResultPayload }) {
  const addToast = useUIStore((s) => s.addToast);
  const currentSessionId = useSessionStore((s) => s.currentSessionId);
  const stateData = useChatStore((s) => s.stateData);
  const [ran, setRan] = useState(false);
  const [error, setError] = useState("");

  const runScript = useCallback(() => {
    try {
      const context = {
        result: payload.result,
        sessionId: currentSessionId,
        state: stateData,
        sendMessage: (msg: string) => useChatStore.getState().sendMessage(msg),
        sendBranchMessage: (msg: string, fromId: string) =>
          useChatStore.getState().sendBranchMessage(msg, fromId),
        showToast: (msg: string, type?: string) => addToast(msg, (type as "success" | "error" | "info") ?? "info"),
        renderHTML: (html: string) => {
          // Insert HTML into a temporary floating container
          const el = document.createElement("div");
          el.innerHTML = html;
          document.body.appendChild(el);
          setTimeout(() => document.body.removeChild(el), 8000);
        },
      };
      // eslint-disable-next-line no-new-func
      new Function("context", payload.action.script)(context);
      setRan(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [payload, currentSessionId, stateData, addToast]);

  if (!payload.action.script) return null;

  return (
    <div className="flex items-center gap-2 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl px-3 py-2 text-[13px]">
      <span className="text-gray-400 flex-1">{payload.hook_name}</span>
      {error && <span className="text-red-400 text-xs truncate max-w-[200px]">{error}</span>}
      {ran ? (
        <span className="text-emerald-400 text-xs">已执行</span>
      ) : (
        <button
          className="px-2.5 py-1 rounded-lg bg-amber-600/80 hover:bg-amber-500 text-white text-xs font-medium transition-all"
          onClick={runScript}
        >
          执行脚本
        </button>
      )}
    </div>
  );
}

// ── Dispatch by action type ──────────────────────────────────────────────────

function HookResultItem({
  payload,
  onDismiss,
}: {
  payload: HookResultPayload;
  onDismiss: () => void;
}) {
  const addToast = useUIStore((s) => s.addToast);

  switch (payload.action.type) {
    case "render_branch_options":
      return <BranchOptionsResult payload={payload} onDismiss={onDismiss} />;

    case "show_panel":
      return <ShowPanelResult payload={payload} />;

    case "inject_to_input": {
      const text = typeof payload.result === "string" ? payload.result : JSON.stringify(payload.result);
      // Inject into textarea via DOM event (MessageInput listens to value state, so we use a custom event)
      const textarea = document.querySelector<HTMLTextAreaElement>("textarea[placeholder*='创作']");
      if (textarea) {
        // Simulate React-compatible input change
        const nativeInputSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")?.set;
        nativeInputSetter?.call(textarea, text);
        textarea.dispatchEvent(new Event("input", { bubbles: true }));
      }
      onDismiss();
      return null;
    }

    case "send_message": {
      const text = typeof payload.result === "string" ? payload.result : JSON.stringify(payload.result);
      useChatStore.getState().sendMessage(text);
      onDismiss();
      return null;
    }

    case "show_toast": {
      const text = typeof payload.result === "string" ? payload.result : JSON.stringify(payload.result);
      addToast(text, "info");
      onDismiss();
      return null;
    }

    case "custom_script":
      return <CustomScriptResult payload={payload} />;

    default:
      return null;
  }
}

// ── Main Panel ───────────────────────────────────────────────────────────────

export default function HookResultPanel() {
  const activeResults = useHookStore((s) => s.activeResults);
  const clearResults = useHookStore((s) => s.clearResults);
  const isStreaming = useChatStore((s) => s.isStreaming);
  const hooks = useHookStore((s) => s.hooks);

  const entries = Object.entries(activeResults);
  if (entries.length === 0 || isStreaming) return null;

  // Sort by hook order in hooks list
  const sorted = entries.sort(([a], [b]) => {
    const idxA = hooks.findIndex((h) => h.id === a);
    const idxB = hooks.findIndex((h) => h.id === b);
    return idxA - idxB;
  });

  return (
    <div className="w-full bg-[var(--bg-primary)] border-t border-[var(--border)] px-4 py-3 md:px-8 shrink-0">
      <div className="max-w-4xl mx-auto flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-gray-500 font-medium tracking-wide uppercase">
            🔗 Hook 结果
          </span>
          <button
            className="text-xs text-gray-500 hover:text-gray-300 transition-colors px-1.5"
            onClick={clearResults}
          >
            ✕ 关闭
          </button>
        </div>
        {sorted.map(([hookId, payload]) => (
          <HookResultItem
            key={hookId}
            payload={payload}
            onDismiss={() => {
              useHookStore.getState().setResult(hookId, { ...payload, result: null });
            }}
          />
        ))}
      </div>
    </div>
  );
}
