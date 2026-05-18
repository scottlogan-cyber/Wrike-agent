"use client";

import { useEffect, useMemo } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { connectAgentWs, useAgentStore } from "@/lib/ws";
import { StatusBar } from "@/components/StatusBar";
import { Roster } from "@/components/Roster";
import { BattleLog } from "@/components/BattleLog";
import { ChatPanel } from "@/components/ChatPanel";
import { ApprovalCard } from "@/components/ApprovalCard";
import { VillageMap } from "@/components/VillageMap";
import { HutInterior } from "@/components/HutInterior";
import { theme } from "@/lib/theme";
import { aggregateHutsFromTasks } from "@/lib/huts";

export default function Home() {
  const {
    draftProgress,
    connected,
    focusedTaskId,
    setFocusedTask,
    tasks,
    battleLog,
    drafts,
    chatMessages,
    mood,
    stamina,
    scene,
    activeHutId,
    enterHut,
    leaveHut,
  } = useAgentStore();

  useEffect(() => {
    connectAgentWs();
  }, []);

  useEffect(() => {
    if (scene === "interior" && !activeHutId) {
      leaveHut();
    }
  }, [scene, activeHutId, leaveHut]);

  const huts = useMemo(() => aggregateHutsFromTasks(tasks), [tasks]);
  const activeHut = useMemo(
    () => huts.find((h) => h.id === activeHutId),
    [huts, activeHutId]
  );

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ backgroundColor: "#0f0d0b", color: theme.parchment }}
    >
      <nav className="flex gap-4 px-4 md:px-8 pt-4 text-sm font-mono shrink-0">
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

      <div className="flex-1 p-4 md:p-8 pb-44">
        <AnimatePresence mode="wait">
          {scene === "village" ? (
            <motion.div
              key="village"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="grid grid-cols-1 lg:grid-cols-12 gap-6"
            >
              <div className="lg:col-span-7">
                <VillageMap
                  huts={huts}
                  activeHutId={activeHutId}
                  onEnterHut={enterHut}
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
            </motion.div>
          ) : activeHut ? (
            <HutInterior
              key={activeHut.id}
              hut={activeHut}
              onLeave={leaveHut}
            />
          ) : null}
        </AnimatePresence>

        {drafts.length > 0 && (
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {drafts.map((d) => (
              <ApprovalCard key={d.id} draft={d} />
            ))}
          </div>
        )}
      </div>

      <div
        className="fixed bottom-0 left-0 right-0 z-50 border-t-2 shadow-[0_-8px_32px_rgba(0,0,0,0.65)]"
        style={{ borderColor: theme.bronze }}
      >
        <div className="max-w-6xl mx-auto">
          <ChatPanel messages={chatMessages} tasks={tasks} />
        </div>
      </div>
    </div>
  );
}
