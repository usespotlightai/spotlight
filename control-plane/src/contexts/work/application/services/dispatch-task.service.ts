import type { HarnessLaunchPort } from '@runs/application/ports/harness-launch.port';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunId as RunIdOf } from '@shared-kernel/domain/value-objects/run-id.vo';
import { ReadySkillMapper } from '@work/application/mappers/ready-skill.mapper';
import { toolManifestOf } from '@work/application/mappers/tool-manifest.mapper';
import type { BuiltInSkillsPort } from '@work/application/ports/built-in-skills.port';
import type { ContentHashPort } from '@work/application/ports/content-hash.port';
import type { HarnessCataloguePort } from '@work/application/ports/harness-catalogue.port';
import type { SavepointPort } from '@work/application/ports/savepoint.port';
import type { StationProfilesPort } from '@work/application/ports/station-profiles.port';
import type { TaskDecisionsPort } from '@work/application/ports/task-decisions.port';
import {
  NOTHING_REMEMBERED,
  type TeamMemoriesPort,
} from '@work/application/ports/team-memories.port';
import type { TraceParentPort } from '@work/application/ports/trace-parent.port';
import { TaskBriefing } from '@work/application/rendering/task-briefing';
import {
  type OrderedRun,
  runOrderOf,
} from '@work/application/services/ordered-run';
import { taskWords } from '@work/application/services/remembering-words';
import type { RunCatalog } from '@work/application/services/run-catalog.service';
import { StationOrdering } from '@work/application/services/station-ordering';
import type { StationSkills } from '@work/application/services/station-skills.service';
import type { TeamIntegrations } from '@work/application/services/team-integrations.service';
import type { TouchedFiles } from '@work/application/services/touched-files';
import { WorkRequesters } from '@work/application/services/work-requesters';
import type { Task } from '@work/domain/aggregates/task.aggregate';
import { describedTools } from '@work/domain/services/enabled-for-run';
import { orderFor, taskOrderedAt } from '@work/domain/services/run-order';
import { repositoriesForTask } from '@work/domain/services/task-checkouts';
import { BriefedMemories } from '@work/domain/value-objects/briefed-memories.vo';
import type { LineMap } from '@work/domain/value-objects/line-map.vo';

export interface TaskDispatching {
  runIdFor(input: { task: Task; line: LineMap }): Promise<RunId | null>;
}

export class DispatchTask implements TaskDispatching {
  private readonly ordering: StationOrdering;

  constructor(
    private readonly ids: IdGeneratorPort,
    private readonly harnesses: HarnessCataloguePort,
    private readonly launch: HarnessLaunchPort,
    private readonly tracing: TraceParentPort,
    builtInSkills: BuiltInSkillsPort,
    private readonly teamSkills: StationSkills,
    private readonly integrations: TeamIntegrations,
    private readonly decisions: TaskDecisionsPort,
    catalog: RunCatalog,
    profiles: StationProfilesPort,
    private readonly memories: TeamMemoriesPort,
    private readonly touched: TouchedFiles,
    private readonly logger: LoggerPort,
    private readonly savepoint: SavepointPort,
    hash: ContentHashPort,
  ) {
    this.ordering = new StationOrdering(
      harnesses,
      launch,
      builtInSkills,
      teamSkills,
      catalog,
      profiles,
      hash,
    );
  }

  async runIdFor({
    task,
    line,
  }: {
    task: Task;
    line: LineMap;
  }): Promise<RunId | null> {
    const station = line.stationAt(task.stationId);
    const ready = station ? await this.teamSkills.readyAt(line, station) : [];
    const order = orderFor({
      task,
      line,
      harnesses: this.harnesses.current(),
      ready: ready.map(ReadySkillMapper.toReady),
      profiles: await this.ordering.profilesAt(line, station ?? null),
    });

    if (!order) {
      this.notDispatched(task, line, 'station-has-no-harness');
      return null;
    }

    const prepared = this.ordering.prepared(order);

    if (!prepared || !this.launch.skillsFor(order.harness)) {
      this.notDispatched(task, line, 'harness-not-prepared');
      return null;
    }

    return RunIdOf.of(this.ids.generate());
  }

  async ordered({
    task,
    line,
    runId,
  }: {
    task: Task;
    line: LineMap;
    runId: RunId;
  }): Promise<OrderedRun | null> {
    const found = await this.ordering.ordered(line, taskOrderedAt(task, line));

    if (!found) {
      this.notDispatched(task, line, 'station-has-no-order', runId);
      return null;
    }

    const provided = await this.integrations.provided(
      line,
      found.order.enabled.tools,
    );
    const described = describedTools(found.order.enabled.tools, [
      ...provided,
      ...found.catalogTools,
    ]);
    const ordered = this.ordering.equipped(found, described);
    const { order, folders, home } = ordered;

    const id = runId;

    const memories = await this.savepoint
      .inSavepoint(() =>
        this.memories.forBriefing({
          teamId: line.teamId,
          lineId: line.id.value,
          stationId: task.stationId.value,
          repositories: repositoriesForTask(task, line),
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
    const briefed = task
      .briefedOn(line)
      .withDecisions(await this.decisions.ofTask(task.id));
    const briefing = TaskBriefing.brief({
      task: briefed,
      line,
      skills: folders.map((each) => each.skill),
      listedIn: home.readByHarness ? null : home.directory,
      memories: memories.briefed,
      memoryFolder: memories.folder,
      tools: described,
    });
    const injected = (order.enabled.profile?.injectedSecrets ?? []).map(
      (each) => each.value,
    );
    const catalog = order.enabled.pinned.map((each) => each.value);

    return {
      order: runOrderOf({
        id,
        workspaceId: task.workspaceId,
        harness: order.harness,
        priority: order.priority,
        requester: WorkRequesters.task(task.id, task.revision, line.teamId),
        policy: WorkRequesters.taskPolicy,
        workingCopy: WorkRequesters.taskWorkingCopy(task.id),
        apiGrant: null,
        tags: { taskId: task.id.value },
        line: line.id,
        placement: order.placement,
        spec: {
          ...this.ordering.laid(ordered, {
            briefing,
            naming: this.tracing.for(task.id, id),
            attachments: briefed.allAttachments,
          }),
          manifest: described.map(toolManifestOf),
          ...(catalog.length > 0 ? { catalog } : {}),
          startingPoint: true,
          ...(injected.length > 0 ? { injectedSecrets: injected } : {}),
        },
        refusals: order.refusals,
      }),
      briefedTask: briefed,
      briefedMemories: BriefedMemories.of({
        briefed: memories.briefed,
        omitted: memories.omitted,
      }),
      configuredAs: this.ordering.configuredAs(ordered, line),
    };
  }

  private notDispatched(
    task: Task,
    line: LineMap,
    reason: string,
    runId?: RunId,
  ): void {
    this.logger.info(
      {
        workspaceId: task.workspaceId.value,
        teamId: line.teamId.value,
        taskId: task.id.value,
        runId: runId?.value,
        stationId: task.stationId.value,
        reason,
      },
      'Did not dispatch a run',
    );
  }
}
