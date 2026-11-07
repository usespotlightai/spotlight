import {
  HookEvent,
  type HookEventName,
} from '@integrations/domain/value-objects/hook-event.vo';
import type { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import type { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { StationKey } from '@shared-kernel/domain/value-objects/station-key.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { Tool } from '@shared-kernel/domain/value-objects/tool.vo';

type HookEventPayload = Readonly<Record<string, unknown>>;

export class HookOccurrence {
  private constructor(
    readonly event: HookEvent,
    readonly key: string,
    readonly change: string,
    readonly payload: HookEventPayload,
  ) {}

  static toolUsed(
    tool: Tool,
    occurrence: string,
    payload: HookEventPayload,
  ): HookOccurrence {
    return new HookOccurrence(
      HookEvent.of('tool.used'),
      occurrence,
      `${tool.value} ${occurrence}`,
      payload,
    );
  }

  static runEnded(run: RunId, outcome: string): HookOccurrence {
    return new HookOccurrence(
      HookEvent.of('run.ended'),
      `run-ended:${run.value}`,
      outcome,
      { outcome },
    );
  }

  static taskOpened(task: TaskId, station: StationKey): HookOccurrence {
    return new HookOccurrence(
      HookEvent.of('task.opened'),
      `task-opened:${task.value}`,
      station.value,
      {},
    );
  }

  static taskMoved(
    task: TaskId,
    move: { readonly from: string; readonly to: string; readonly at: string },
  ): HookOccurrence {
    return new HookOccurrence(
      HookEvent.of('task.moved'),
      `task-moved:${task.value}:${move.at}`,
      `${move.from} → ${move.to}`,
      { from: move.from, to: move.to },
    );
  }

  static pullRequestMerged(
    pullRequest: PullRequestUrl,
    repository: Repository,
    mergeCommit: string,
  ): HookOccurrence {
    return new HookOccurrence(
      HookEvent.of('pull-request.merged'),
      `pull-request-merged:${pullRequest.value}`,
      pullRequest.value,
      { url: pullRequest.value, repository: repository.value, mergeCommit },
    );
  }

  get on(): HookEventName {
    return this.event.name;
  }

  get matchedAfterChanges(): boolean {
    return this.event.matchedAfterChanges;
  }
}
