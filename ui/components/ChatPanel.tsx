"use client";

import { useMemo, useState } from "react";
import { sendChat, useAgentStore, type TaskView } from "@/lib/ws";
import { aggregateHutsFromTasks } from "@/lib/huts";
import { tryParseLocalVillageCommand } from "@/lib/village-commands";
import { theme } from "@/lib/theme";

export function ChatPanel({
  messages,
  tasks,
}: {
  messages: { role: "user" | "leonidas"; text: string }[];
  tasks: TaskView[];
}) {
  const [text, setText] = useState("");
  const enterHut = useAgentStore((s) => s.enterHut);
  const leaveHut = useAgentStore((s) => s.leaveHut);
  const addChat = useAgentStore((s) => s.addChat);
  const scene = useAgentStore((s) => s.scene);

  const huts = useMemo(() => aggregateHutsFromTasks(tasks), [tasks]);

  return (
    <div
      className="border-t-2 pt-3 px-2 pb-2"
      style={{
        borderColor: theme.bronze,
        background:
          "linear-gradient(180deg, rgba(15,13,11,0.98) 0%, rgba(26,21,16,0.99) 100%)",
      }}
    >
      <p className="text-[10px] font-mono uppercase tracking-wide opacity-60 mb-1 px-1">
        Command {scene === "interior" ? "· inside longhouse" : "· village"} ·
        enter &lt;client&gt; · leave
      </p>
      <div className="max-h-24 overflow-y-auto text-sm mb-2 space-y-1 px-1">
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
          const trimmed = text.trim();
          const local = tryParseLocalVillageCommand(trimmed, huts);
          if (local.handled) {
            if (local.kind === "leave") {
              leaveHut();
              addChat("user", trimmed);
              addChat(
                "leonidas",
                "We return to the Hot Gates — the village awaits."
              );
            } else {
              enterHut(local.hutId);
              addChat("user", trimmed);
              addChat(
                "leonidas",
                "I cross the threshold. The scroll shows your Obsidian truth for this client."
              );
            }
            setText("");
            return;
          }
          sendChat(trimmed);
          setText("");
        }}
      >
        <input
          className="flex-1 rounded px-3 py-2 text-sm bg-stone-900 border"
          style={{ borderColor: theme.bronze, color: theme.parchment }}
          placeholder="Command Leonidas…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          aria-label="Command Leonidas"
        />
        <button
          type="submit"
          className="px-4 py-2 rounded font-bold text-sm shrink-0"
          style={{ backgroundColor: theme.crimson, color: theme.parchment }}
          title="Send"
        >
          ↵
        </button>
      </form>
    </div>
  );
}
