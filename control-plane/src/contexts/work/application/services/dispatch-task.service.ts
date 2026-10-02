import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import type { IsolationPort } from '@shared-kernel/application/ports/isolation.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunId as RunIdOf } from '@shared-kernel/domain/value-objects/run-id.vo';
import { ReadySkillMapper } from '@work/application/mappers/ready-skill.mapper';
import { toolManifestOf } from '@work/application/mappers/tool-manifest.mapper';
import type { BuiltInSkillsPort } from '@work/application/ports/built-in-skills.port';
import type { ContentDigestPort } from '@work/application/ports/content-digest.port';
import type { HarnessLaunchPort } from '@work/application/ports/harness-launch.port';
import type { StationProfilesPort } from '@work/application/ports/station-profiles.port';
import type { TaskDecisionsPort } from '@work/application/ports/task-decisions.port';
import {
  NOTHING_REMEMBERED,
  type TeamMemoriesPort,
} from '@work/application/ports/team-memories.port';
import type { TraceParentPort } from '@work/application/ports/trace-parent.port';
import { TaskBriefing } from '@work/application/rendering/task-briefing';
import { taskWords } from '@work/application/services/remembering-words';
import type { StationCatalog } from '@work/application/services/station-catalog.service';
import { StationOrdering } from '@work/application/services/station-ordering';
import type { StationSkills } from '@work/application/services/station-skills.service';
import type { TaskDispatching } from '@work/application/services/task-dispatch';
import type { TeamIntegrations } from '@work/application/services/team-integrations.service';
import type { TouchedFiles } from '@work/application/services/touched-files';
import type { Line } from '@work/domain/aggregates/line.aggregate';
import { Run } from '@work/domain/aggregates/run.aggregate';
import type { Task } from '@work/domain/aggregates/task.aggregate';
import type { RunRepository } from '@work/domain/repositories/run.repository';
import { describedTools } from '@work/domain/services/given-to-run';
import type { HarnessCatalog } from '@work/domain/services/harness-catalog';
import { orderFor, taskOrderedAt } from '@work/domain/services/run-order';
import { repositoriesWorkedOn } from '@work/domain/services/task-checkouts';
import { BriefedMemories } from '@work/domain/value-objects/briefed-memories.vo';
import { RunSpec } from '@work/domain/value-objects/run-spec.vo';
import { RunSubject } from '@work/domain/value-objects/run-subject.vo';

export class DispatchTask implements TaskDispatching {
  private readonly ordering: StationOrdering;

  constructor(
    private readonly runs: RunRepository,
    private readonly ids: IdGeneratorPort,
    private readonly harnesses: HarnessCatalog,
    private readonly launch: HarnessLaunchPort,
    private readonly tracing: TraceParentPort,
    builtInSkills: BuiltInSkillsPort,
    private readonly teamSkills: StationSkills,
    private readonly integrations: TeamIntegrations,
    private readonly decisions: TaskDecisionsPort,
    catalog: StationCatalog,
    profiles: StationProfilesPort,
    private readonly memories: TeamMemoriesPort,
    private readonly touched: TouchedFiles,
    private readonly logger: LoggerPort,
    private readonly isolation: IsolationPort,
    digest: ContentDigestPort,
  ) {
    this.ordering = new StationOrdering(
      harnesses,
      launch,
      builtInSkills,
      teamSkills,
      catalog,
      profiles,
      digest,
    );
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
      profiles: await this.ordering.profilesAt(line, station ?? null),
    });

    if (!order) {
      return null;
    }

    const prepared = this.ordering.prepared(order);

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
    const ordered = await this.ordering.ordered(
      line,
      taskOrderedAt(task, line),
    );

    if (!ordered) {
      return false;
    }

    const { order, folders, home } = ordered;
    const offered = order.given.tools.some(
      (each) => each.origin === 'integration',
    )
      ? await this.integrations.offered(line)
      : [];
    const described = describedTools(order.given.tools, [
      ...offered,
      ...ordered.catalogTools,
    ]);

    const id = runId;

    const memories = await this.isolation
      .isolated(() =>
        this.memories.forBriefing({
          teamId: line.teamId,
          lineId: line.id.value,
          stationId: task.stationId.value,
          repositories: repositoriesWorkedOn(task, line),
          about: taskWords(task),
          touched: () => this.touched.onTask(task, line),
        }),
      )
      .catch((error: unknown) => {
        this.logger.warn(
          { err: error, taskId: task.id.value },
          'Briefing the run without what the team remembers, which could not be read',
        );
        return NOTHING_REMEMBERED;
      });
    const briefed = task.briefed.withDecisions(
      await this.decisions.ofTask(task.id),
    );
    const briefing = TaskBriefing.brief({
      task: briefed,
      line,
      skills: folders.map((each) => each.skill),
      listedIn: home.readByHarness ? null : home.directory,
      memories: memories.briefed,
      memoryFolder: memories.folder,
    });
    const worn = (order.given.profile?.wears ?? []).map((each) => each.value);
    const catalog = order.given.pinned.map((each) => each.value);

    const queued = Run.enqueue({
      id,
      workspaceId: task.workspaceId,
      harness: order.harness.id,
      priority: order.priority,
      subject: RunSubject.task(task.id, order.stationId, task.revision),
      placement: order.placement,
      briefedWith: BriefedMemories.of({
        briefed: memories.briefed,
        cut: memories.cut,
      }),
      briefedTask: briefed,
      configuredAs: this.ordering.configuredAs(ordered, line),
      spec: RunSpec.of({
        ...this.ordering.laid(ordered, {
          briefing,
          naming: this.tracing.for(task.id, id),
          attachments: briefed.allAttachments,
        }),
        manifest: described.map(toolManifestOf),
        ...(catalog.length > 0 ? { catalog } : {}),
        startingPoint: true,
        ...(worn.length > 0 ? { wears: worn } : {}),
      }),
    });

    await this.runs.add(
      order.refusal ? queued.refused(order.refusal) : queued,
      { briefed },
    );

    return true;
  }
}
