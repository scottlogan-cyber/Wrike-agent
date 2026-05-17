import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { REPO_ROOT } from "../config.js";
import { dispatchSubagent } from "../dispatch.js";
import { upsertTask, getTask } from "../state/tasks.js";

const goldenPath = join(REPO_ROOT, "eval/golden-tasks.json");

interface GoldenTask {
  task_id: string;
  title: string;
  expected_topic?: string;
}

async function main(): Promise<void> {
  if (!existsSync(goldenPath)) {
    console.log("No eval/golden-tasks.json — create 3 historical task fixtures.");
    process.exit(0);
  }
  const tasks = JSON.parse(readFileSync(goldenPath, "utf-8")) as GoldenTask[];
  let passed = 0;
  for (const g of tasks) {
    upsertTask(g.task_id, { title: g.title, state: "discovered" });
    const intake = await dispatchSubagent("intake", g.task_id);
    const topic = String(intake.topic_guess ?? "");
    if (g.expected_topic && topic.includes(g.expected_topic)) {
      passed++;
      console.log(`✓ ${g.task_id}`);
    } else {
      console.log(`? ${g.task_id} topic=${topic}`);
    }
  }
  console.log(`Eval: ${passed}/${tasks.length} matched expected topics`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
