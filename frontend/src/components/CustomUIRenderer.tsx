import { useRef, useEffect, useCallback } from "react";
import { useChatStore } from "../stores/chatStore";
import { useSessionStore } from "../stores/sessionStore";
import { getCustomUI } from "../services/api";

export default function CustomUIRenderer() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const messages = useChatStore((s) => s.messages);
  const currentSessionId = useSessionStore((s) => s.currentSessionId);

  // Load custom UI HTML into iframe
  useEffect(() => {
    if (!currentSessionId) return;
    let cancelled = false;

    (async () => {
      try {
        const { html } = await getCustomUI(currentSessionId);
        if (!cancelled && iframeRef.current) {
          iframeRef.current.srcdoc = html;
        }
      } catch {
        // No custom UI yet
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [currentSessionId]);

  // Push messages into iframe via postMessage
  useEffect(() => {
    if (!iframeRef.current?.contentWindow) return;
    const data = messages.map((m) => ({
      role: m.role,
      content: m.content,
      timestamp: m.timestamp,
    }));
    iframeRef.current.contentWindow.postMessage(
      { type: "messages", data },
      "*"
    );
  }, [messages]);

  return (
    <div className="flex-1 bg-white rounded-lg m-3 overflow-hidden">
      <iframe
        ref={iframeRef}
        sandbox="allow-scripts"
        title="Custom Chat UI"
      />
    </div>
  );
}
