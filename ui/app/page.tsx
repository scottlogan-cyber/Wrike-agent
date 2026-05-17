"use client";

import { useEffect } from "react";
import Link from "next/link";
import { connectAgentWs, useAgentStore } from "@/lib/ws";
import { Stage } from "@/components/Stage";
import { StatusBar } from "@/components/StatusBar";
import { Roster } from "@/components/Roster";
import { BattleLog } from "@/components/BattleLog";
import { ChatPanel } from "@/components/ChatPanel";
import { ApprovalCard } from "@/components/ApprovalCard";
import { theme } from "@/lib/theme";
import type { KratosState } from "@/components/Kratos";

export default function Home() {
  const {
    petState,
    tasks,
    battleLog,
    drafts,
    chatMessages,
    mood,
    stamina,
    draftProgress,
    connected,
    focusedTaskId,
    setFocusedTask,
  } = useAgentStore();

  useEffect(() => {
    connectAgentWs();
  }, []);

  const kratosState: KratosState =
    petState === "confused"
      ? "sniffing"
      : petState === "thinking"
        ? "alert"
        : "sleeping";

  return (
    <div
      className="min-h-screen p-4 md:p-8"
      style={{ backgroundColor: "#0f0d0b", color: theme.parchment }}
    >
      <nav className="flex gap-4 mb-4 text-sm font-mono">
        <Link href="/" className="text-amber-600">
          Leonidas
        </Link>
        <Link href="/notebook" className="opacity-70 hover:opacity-100">
          Kratos&apos;s Notebook
        </Link>
        <Link href="/trace" className="opacity-70 hover:opacity-100">
          Battle Log (full)
        </Link>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7">
          <Stage
            petState={petState}
            kratosState={kratosState}
            draftCount={drafts.length}
          />
        </div>
        <div className="lg:col-span-5 space-y-4">
          <StatusBar
            mood={mood}
            focusedTask={focusedTaskId}
            draftProgress={draftProgress}
            stamina={stamina}
            connected={connected}
          />
          <Roster
            tasks={tasks}
            focusedId={focusedTaskId}
            onSelect={setFocusedTask}
          />
          <BattleLog entries={battleLog} />
        </div>
      </div>

      {drafts.length > 0 && (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {drafts.map((d) => (
            <ApprovalCard key={d.id} draft={d} />
          ))}
        </div>
      )}

      <div className="mt-6 max-w-4xl">
        <ChatPanel messages={chatMessages} />
      </div>
    </div>
  );
}
