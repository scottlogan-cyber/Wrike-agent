import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import { REPO_ROOT } from "./config.js";
import { broadcast } from "./ws/broadcast.js";
import { sendSlackDm } from "./tools/slack.js";
import {
  demoCreateCustomField,
  demoCreateFolder,
  demoCreateTask,
} from "./tools/wrike-rest.js";

interface DemoTemplate {
  name: string;
  description: string;
  default_scale: string;
  custom_fields: Array<{
    title: string;
    type: string;
    settings?: Record<string, unknown>;
  }>;
  spaces: Array<{
    title: string;
    folders: Array<{
      title: string;
      sample_tasks_count: number;
      custom_item_type?: string;
    }>;
  }>;
  talk_track: string;
}

let pendingDemoPlan: Parameters<typeof executeDemoPlan>[0] | null = null;

export function getPendingDemoPlan() {
  return pendingDemoPlan;
}

export function clearPendingDemoPlan() {
  pendingDemoPlan = null;
}

export async function runArchitect(
  request: string,
  demoParentFolderId: string
): Promise<void> {
  const templateMatch = request.match(/marketing\s+agency/i)
    ? "marketing-agency.yaml"
    : request.match(/prof(essional)?\s+services/i)
      ? "prof-services.yaml"
      : request.match(/creative/i)
        ? "creative-team.yaml"
        : "marketing-agency.yaml";

  const templatePath = join(
    REPO_ROOT,
    "agent/templates/demos",
    templateMatch
  );
  const template = parse(
    readFileSync(templatePath, "utf-8")
  ) as DemoTemplate;

  const prospectMatch = request.match(/for\s+([^.]+)/i);
  const prospect = prospectMatch?.[1]?.trim() ?? "Prospect";

  const plan = {
    template: template.name,
    prospect,
    custom_fields: template.custom_fields,
    spaces: template.spaces.map((s) => ({
      ...s,
      title: s.title.replace("{prospect}", prospect),
    })),
    talk_track: template.talk_track.replace(/\{prospect\}/g, prospect),
  };

  pendingDemoPlan = {
    prospect,
    custom_fields: plan.custom_fields as DemoTemplate["custom_fields"],
    spaces: plan.spaces as DemoTemplate["spaces"],
    talk_track: plan.talk_track,
  };

  broadcast({
    type: "demo_plan",
    payload: { plan },
  });
}

export async function executeDemoPlan(
  plan: {
    prospect: string;
    custom_fields: DemoTemplate["custom_fields"];
    spaces: DemoTemplate["spaces"];
    talk_track: string;
  },
  demoParentFolderId: string
): Promise<void> {
  const fieldIds: string[] = [];
  for (const f of plan.custom_fields) {
    const created = (await demoCreateCustomField(
      f.title,
      f.type,
      f.settings
    )) as { id: string };
    if (created?.id) fieldIds.push(created.id);
  }

  for (const space of plan.spaces) {
    const folder = (await demoCreateFolder(
      demoParentFolderId,
      space.title.replace("{prospect}", plan.prospect),
      { status: "Green" }
    )) as { id: string };

    for (const sub of space.folders) {
      const subFolder = (await demoCreateFolder(
        folder.id,
        sub.title,
        {}
      )) as { id: string };

      for (let i = 0; i < sub.sample_tasks_count; i++) {
        await demoCreateTask(
          subFolder.id,
          `${plan.prospect} — ${sub.title} task ${i + 1}`,
          `Sample task for demo (${sub.custom_item_type ?? "task"}).`
        );
      }
    }
  }

  await sendSlackDm(
    `Architect finished demo for ${plan.prospect}.\n\n${plan.talk_track}`
  );
}
