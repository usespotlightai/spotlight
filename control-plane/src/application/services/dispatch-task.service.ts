import {
  RunSpecContract,
  type RunSpecShape,
  type SkillFileShape,
  THROUGH_SPOTLIGHT,
  type ToolManifestShape,
  TRACE_PARENT_VAR,
} from '@application/contracts/run-spec.contract';
import { skillFilesOf } from '@application/mappers/skill-files.mapper';
import { toolManifestOf } from '@application/mappers/tool-manifest.mapper';
import type { BuiltInSkillsPort } from '@application/ports/built-in-skills.port';
import type { HarnessLaunchPort } from '@application/ports/harness-launch.port';
import type { IdGeneratorPort } from '@application/ports/id-generator.port';
import type { TraceParentPort } from '@application/ports/trace-parent.port';
import { Attached } from '@application/rendering/attached';
import { TaskBriefing } from '@application/rendering/task-briefing';
import type { TaskDispatching } from '@application/services/task-dispatch';
import type { TeamIntegrations } from '@application/services/team-integrations.service';
import type { TeamSkills } from '@application/services/team-skills.service';
import type { Line } from '@domain/aggregates/line.aggregate';
import { Run } from '@domain/aggregates/run.aggregate';
import type { Task } from '@domain/aggregates/task.aggregate';
import type { HarnessRepository } from '@domain/repositories/harness.repository';
import type { RunRepository } from '@domain/repositories/run.repository';
import { describedTools } from '@domain/services/given-to-run';
import { orderFor, type RunOrder } from '@domain/services/run-order';
import type { HarnessCommand } from '@domain/value-objects/harness-command.vo';
import type { RunId } from '@domain/value-objects/run-id.vo';
import { RunId as RunIdOf } from '@domain/value-objects/run-id.vo';
import { RunSpec } from '@domain/value-objects/run-spec.vo';
import { RunSubject } from '@domain/value-objects/run-subject.vo';

// No host address may ever reach a runner; remotes are named as Spotlight serves them.
const written = (
  order: RunOrder,
  task: Task,
  command: HarnessCommand,
  briefing: string,
  naming: string,
  skills: readonly SkillFileShape[],
  manifest: readonly ToolManifestShape[],
): RunSpecShape =>
  RunSpecContract.of({
    checkouts: order.repositories.map((repository) => ({
      remote: THROUGH_SPOTLIGHT,
      path: repository.name,
      branch: order.branch,
    })),
    command: command.started({ [TRACE_PARENT_VAR]: naming }),
    briefing,
    handover: { options: order.options, noteLimit: order.noteLimit },
    continuity: order.continuity.told(),
    skills,
    manifest,
    attachments: Attached.shapes(task.allAttachments),
  });

export class DispatchTask implements TaskDispatching {
  constructor(
    private readonly runs: RunRepository,
    private readonly ids: IdGeneratorPort,
    private readonly harnesses: HarnessRepository,
    private readonly launch: HarnessLaunchPort,
    private readonly tracing: TraceParentPort,
    private readonly builtInSkills: BuiltInSkillsPort,
    private readonly teamSkills: TeamSkills,
    private readonly integrations: TeamIntegrations,
  ) {}

  async dispatch({
    task,
    line,
  }: {
    task: Task;
    line: Line;
  }): Promise<RunId | null> {
    const station = line.stationAt(task.stationId);
    const ready = station ? await this.teamSkills.readyAt(line, station) : [];
    const order = orderFor({
      task,
      line,
      harnesses: this.harnesses,
      ready: ready.map((each) => each.skill),
    });

    if (!order) {
      return null;
    }

    const command = this.launch.commandFor(order.harness.id, {
      model: order.model,
      effort: order.effort,
    });

    if (!command) {
      return null;
    }

    const home = this.launch.skillsFor(order.harness.id);

    if (!home) {
      return null;
    }

    const folders = [
      ...order.given.builtInSkills.flatMap((key) => {
        const folder = this.builtInSkills.named(key);
        return folder ? [folder] : [];
      }),
      ...order.given.teamSkills.flatMap((skill) =>
        ready.filter((each) => each.skill.equals(skill)),
      ),
    ];
    const offered = order.given.tools.some((each) => each.integration)
      ? await this.integrations.offered(line)
      : [];
    const described = describedTools(order.given.tools, offered);

    const id = RunIdOf.of(this.ids.generate());

    const briefing = TaskBriefing.brief({
      task,
      line,
      skills: folders.map((each) => each.skill),
      listedIn: home.readByHarness ? null : home.directory,
    });

    const queued = Run.enqueue({
      id,
      workspaceId: task.workspaceId,
      harness: order.harness.id,
      priority: order.priority,
      subject: RunSubject.task(task.id, order.stationId),
      targetRunner: order.pinnedTo,
      spec: RunSpec.of(
        written(
          order,
          task,
          command,
          briefing,
          this.tracing.for(task.id, id),
          skillFilesOf(folders, home),
          described.map(toolManifestOf),
        ),
      ),
    });

    await this.runs.add(queued);

    return queued.id;
  }
}
