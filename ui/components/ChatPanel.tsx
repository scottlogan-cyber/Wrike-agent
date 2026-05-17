"use client";

import { useState } from "react";
import { sendChat } from "@/lib/ws";
import { theme } from "@/lib/theme";

export function ChatPanel({
  messages,
}: {
  messages: { role: "user" | "leonidas"; text: string }[];
}) {
  const [text, setText] = useState("");

  return (
    <div className="border-t-2 pt-3" style={{ borderColor: theme.bronze }}>
      <div className="max-h-24 overflow-y-auto text-sm mb-2 space-y-1">
        {messages.slice(-6).map((m, i) => (
          <p
            key={i}
            style={{
              color: m.role === "leonidas" ? theme.bronze : theme.parchment,
            }}
          >
            {m.role === "leonidas" ? "Leonidas: " : "You: "}
            {m.text}
          </p>
        ))}
      </div>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!text.trim()) return;
          sendChat(text.trim());
          setText("");
        }}
      >
        <input
          className="flex-1 rounded px-3 py-2 text-sm bg-stone-900 border"
          style={{ borderColor: theme.bronze, color: theme.parchment }}
          placeholder="Speak, citizen…"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button
          type="submit"
          className="px-4 py-2 rounded font-bold text-sm"
          style={{ backgroundColor: theme.crimson, color: theme.parchment }}
          title="Send"
        >
          ↵
        </button>
      </form>
    </div>
  );
}
