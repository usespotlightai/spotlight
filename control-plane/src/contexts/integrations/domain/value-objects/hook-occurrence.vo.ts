import {
  HookEventFacts,
  type ToolUsedFields,
} from '@integrations/domain/value-objects/hook-event-facts.vo';
import {
  HookEvent,
  type HookEventName,
} from '@integrations/domain/value-objects/hook-event.vo';
import { HookOccurrenceKey } from '@integrations/domain/value-objects/hook-occurrence-key.vo';
import type { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import type { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { StationKey } from '@shared-kernel/domain/value-objects/station-key.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';

export class HookOccurrence {
  private constructor(
    readonly event: HookEvent,
    readonly key: HookOccurrenceKey,
    readonly change: string,
    readonly facts: HookEventFacts,
  ) {}

  static toolUsed(
    used: ToolUsedFields,
    occurrence: HookOccurrenceKey,
  ): HookOccurrence {
    return new HookOccurrence(
      HookEvent.of('tool.used'),
      occurrence,
      `${used.tool.value} ${occurrence.value}`,
      HookEventFacts.of(used),
    );
  }

  static runEnded(run: RunId, outcome: string): HookOccurrence {
    return new HookOccurrence(
      HookEvent.of('run.ended'),
      HookOccurrenceKey.of(`run-ended:${run.value}`),
      outcome,
      HookEventFacts.of({ on: 'run.ended', outcome }),
    );
  }

  static taskOpened(task: TaskId, station: StationKey): HookOccurrence {
    return new HookOccurrence(
      HookEvent.of('task.opened'),
      HookOccurrenceKey.of(`task-opened:${task.value}`),
      station.value,
      HookEventFacts.of({ on: 'task.opened' }),
    );
  }

  static taskMoved(
    task: TaskId,
    move: { readonly from: string; readonly to: string; readonly at: string },
  ): HookOccurrence {
    return new HookOccurrence(
      HookEvent.of('task.moved'),
      HookOccurrenceKey.of(`task-moved:${task.value}:${move.at}`),
      `${move.from} → ${move.to}`,
      HookEventFacts.of({ on: 'task.moved', from: move.from, to: move.to }),
    );
  }

  static pullRequestMerged(
    pullRequest: PullRequestUrl,
    repository: Repository,
    mergeCommit: string,
  ): HookOccurrence {
    return new HookOccurrence(
      HookEvent.of('pull-request.merged'),
      HookOccurrenceKey.of(`pull-request-merged:${pullRequest.value}`),
      pullRequest.value,
      HookEventFacts.of({
        on: 'pull-request.merged',
        pullRequest,
        repository,
        mergeCommit,
        changed: null,
      }),
    );
  }

  get on(): HookEventName {
    return this.event.name;
  }

  get matchedAfterChanges(): boolean {
    return this.event.matchedAfterChanges;
  }
}
