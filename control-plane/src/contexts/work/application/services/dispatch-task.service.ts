import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunId as RunIdOf } from '@shared-kernel/domain/value-objects/run-id.vo';
import {
  type HarnessSetupShape,
  RunSpecContract,
  type SkillFileShape,
  THROUGH_SPOTLIGHT,
  type ToolManifestShape,
  TRACE_PARENT_VAR,
} from '@work/application/contracts/run-spec.contract';
import { ReadyProfileMapper } from '@work/application/mappers/ready-profile.mapper';
import { ReadySkillMapper } from '@work/application/mappers/ready-skill.mapper';
import { skillFilesOf } from '@work/application/mappers/skill-files.mapper';
import { toolManifestOf } from '@work/application/mappers/tool-manifest.mapper';
import type { BuiltInSkillsPort } from '@work/application/ports/built-in-skills.port';
import type {
  HarnessLaunchPort,
  PreparedHarness,
} from '@work/application/ports/harness-launch.port';
import type { StationProfilesPort } from '@work/application/ports/station-profiles.port';
import type { TaskDecisionsPort } from '@work/application/ports/task-decisions.port';
import type { TraceParentPort } from '@work/application/ports/trace-parent.port';
import { Attached } from '@work/application/rendering/attached';
import { TaskBriefing } from '@work/application/rendering/task-briefing';
import type { StationCatalog } from '@work/application/services/station-catalog.service';
import type { StationSkills } from '@work/application/services/station-skills.service';
import type { TaskDispatching } from '@work/application/services/task-dispatch';
import type { TeamIntegrations } from '@work/application/services/team-integrations.service';
import type { Line } from '@work/domain/aggregates/line.aggregate';
import { Run } from '@work/domain/aggregates/run.aggregate';
import type { Task } from '@work/domain/aggregates/task.aggregate';
import type { Station } from '@work/domain/entities/station.entity';
import type { RunRepository } from '@work/domain/repositories/run.repository';
import { describedTools } from '@work/domain/services/given-to-run';
import type { HarnessCatalog } from '@work/domain/services/harness-catalog';
import { orderFor, type RunOrder } from '@work/domain/services/run-order';
import type { HarnessCommand } from '@work/domain/value-objects/harness-command.vo';
import type { ReadyProfile } from '@work/domain/value-objects/ready-profile';
import { RunSpec } from '@work/domain/value-objects/run-spec.vo';
import { RunSubject } from '@work/domain/value-objects/run-subject.vo';

// No host address may ever reach a runner; remotes are named as Spotlight serves them.
const written = (
  order: RunOrder,
  task: Task,
  command: HarnessCommand,
  setup: HarnessSetupShape | null,
  briefing: string,
  naming: string,
  skills: readonly SkillFileShape[],
  manifest: readonly ToolManifestShape[],
  catalog: readonly string[],
): RunSpec => {
  const worn = (order.given.profile?.wears ?? []).map((each) => each.value);

  return RunSpec.of({
    checkouts: order.checkouts.map((checkout) => ({
      remote: THROUGH_SPOTLIGHT,
      path: checkout.repository.name,
      ...(checkout.branch ? { branch: checkout.branch.value } : {}),
      ...(checkout.ref ? { ref: checkout.ref } : {}),
      ...(checkout.diffOf === 'commits' ? { diffOf: checkout.diffOf } : {}),
      ...(checkout.setup ? { setup: checkout.setup.value } : {}),
    })),
    command: command.started({ [TRACE_PARENT_VAR]: naming }),
    briefing,
    handover: {
      options: order.options.map((each) => each.word),
      noteLimit: order.noteLimit,
    },
    continuity: RunSpecContract.continuityOf(order.continuity),
    skills,
    manifest,
    ...(catalog.length > 0 ? { catalog } : {}),
    attachments: Attached.shapes(task.allAttachments),
    diffs: order.diffs,
    ...(setup ? { harnessSetup: setup } : {}),
    ...(worn.length > 0 ? { wears: worn } : {}),
  });
};

export class DispatchTask implements TaskDispatching {
  constructor(
    private readonly runs: RunRepository,
    private readonly ids: IdGeneratorPort,
    private readonly harnesses: HarnessCatalog,
    private readonly launch: HarnessLaunchPort,
    private readonly tracing: TraceParentPort,
    private readonly builtInSkills: BuiltInSkillsPort,
    private readonly teamSkills: StationSkills,
    private readonly integrations: TeamIntegrations,
    private readonly decisions: TaskDecisionsPort,
    private readonly catalog: StationCatalog,
    private readonly profiles: StationProfilesPort,
  ) {}

  private async profilesAt(
    line: Line,
    station: Station | null,
  ): Promise<readonly ReadyProfile[]> {
    const shape = station?.profile
      ? await this.profiles.named(line.teamId, station.profile.value)
      : null;

    return shape ? [ReadyProfileMapper.toReady(shape)] : [];
  }

  private prepared(order: RunOrder): PreparedHarness | null {
    return this.launch.preparedFor(order.harness.id, {
      model: order.model,
      effort: order.effort,
      profile: order.given.profile,
    });
  }

  async runIdFor({
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
      ready: ready.map(ReadySkillMapper.toReady),
      profiles: await this.profilesAt(line, station ?? null),
    });

    if (!order) {
      return null;
    }

    const prepared = this.prepared(order);

    if (!prepared || !this.launch.skillsFor(order.harness.id)) {
      return null;
    }

    return RunIdOf.of(this.ids.generate());
  }

  async enqueue({
    task,
    line,
    runId,
  }: {
    task: Task;
    line: Line;
    runId: RunId;
  }): Promise<boolean> {
    const station = line.stationAt(task.stationId);
    const kept = station ? await this.teamSkills.readyAt(line, station) : [];
    const catalog = station ? await this.catalog.givenAt(line, station) : null;
    const ready = [...kept, ...(catalog?.skills ?? [])];
    const order = orderFor({
      task,
      line,
      harnesses: this.harnesses,
      ready: ready.map(ReadySkillMapper.toReady),
      profiles: await this.profilesAt(line, station ?? null),
      withheld: catalog?.withheld ?? [],
    });

    if (!order) {
      return false;
    }

    const prepared = this.prepared(order);

    if (!prepared) {
      return false;
    }

    const home = this.launch.skillsFor(order.harness.id);

    if (!home) {
      return false;
    }

    const folders = [
      ...order.given.builtInSkills.flatMap((key) => {
        const folder = this.builtInSkills.named(key.value);
        return folder ? [folder] : [];
      }),
      ...order.given.teamSkills.flatMap((skill) =>
        ready.filter((each) => each.skill.key === skill.key.value),
      ),
    ];
    const offered = order.given.tools.some(
      (each) => each.origin === 'integration',
    )
      ? await this.integrations.offered(line)
      : [];
    const described = describedTools(order.given.tools, [
      ...offered,
      ...(catalog?.tools ?? []),
    ]);

    const id = runId;

    const briefing = TaskBriefing.brief({
      task,
      line,
      skills: folders.map((each) => each.skill),
      listedIn: home.readByHarness ? null : home.directory,
      decisions: await this.decisions.ofTask(task.id),
    });

    const queued = Run.enqueue({
      id,
      workspaceId: task.workspaceId,
      harness: order.harness.id,
      priority: order.priority,
      subject: RunSubject.task(task.id, order.stationId),
      placement: order.placement,
      spec: written(
        order,
        task,
        prepared.command,
        prepared.setup,
        briefing,
        this.tracing.for(task.id, id),
        skillFilesOf(folders, home),
        described.map(toolManifestOf),
        order.given.pinned.map((each) => each.value),
      ),
    });

    await this.runs.add(order.refusal ? queued.refused(order.refusal) : queued);

    return true;
  }
}
