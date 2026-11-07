import type { ChatsPort } from '@insights/application/ports/chats.port';
import type { DeletionsPort } from '@insights/application/ports/deletions.port';
import type { JudgingRepository } from '@insights/domain/repositories/judging.repository';
import type { PullRequestRecordRepository } from '@insights/domain/repositories/pull-request-record.repository';
import type { RunRecordRepository } from '@insights/domain/repositories/run-record.repository';
import type { ScopedRemoval } from '@insights/domain/repositories/scoped-removal';
import type { ScoreRepository } from '@insights/domain/repositories/score.repository';
import type { StationAlertStateRepository } from '@insights/domain/repositories/station-alert-state.repository';
import type { TaskChangeShapeRepository } from '@insights/domain/repositories/task-change-shape.repository';
import type { TaskFailuresRepository } from '@insights/domain/repositories/task-failures.repository';
import type { TaskHumanActionsRepository } from '@insights/domain/repositories/task-human-actions.repository';
import type { DeletionScope } from '@insights/domain/value-objects/deletion-scope.vo';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';

const AT_ONCE = 200;

interface ErasedAggregates<A> extends ScopedRemoval<A> {
  save?(aggregate: A): Promise<void>;
}

interface ScopedLedger {
  removeIn(scope: DeletionScope): Promise<void>;
}

export interface InsightsRepositories {
  readonly records: RunRecordRepository;
  readonly judgings: JudgingRepository;
  readonly scores: ScoreRepository;
  readonly humanActions: TaskHumanActionsRepository;
  readonly failures: TaskFailuresRepository;
  readonly shapes: TaskChangeShapeRepository;
  readonly pullRequests: PullRequestRecordRepository;
  readonly alertStates: StationAlertStateRepository;
  readonly chats: ChatsPort;
}

export class DeleteInsights {
  constructor(
    private readonly repositories: InsightsRepositories,
    private readonly deletions: DeletionsPort,
    private readonly transaction: TransactionPort,
  ) {}

  runRecords(scope: DeletionScope): Promise<void> {
    return this.erase(
      scope,
      this.repositories.records,
      () => null,
      (record) => record.erased(),
    );
  }

  judgings(scope: DeletionScope): Promise<void> {
    return this.erase(scope, this.repositories.judgings);
  }

  scores(scope: DeletionScope): Promise<void> {
    return this.erase(scope, this.repositories.scores);
  }

  humanActions(scope: DeletionScope): Promise<void> {
    return this.erase(
      scope,
      this.repositories.humanActions,
      () => null,
      (humanActions) => humanActions.erased(),
    );
  }

  failures(scope: DeletionScope): Promise<void> {
    return this.erase(scope, this.repositories.failures);
  }

  changeShapes(scope: DeletionScope): Promise<void> {
    return this.erase(
      scope,
      this.repositories.shapes,
      () => null,
      (shape) => shape.erased(),
    );
  }

  pullRequests(scope: DeletionScope): Promise<void> {
    return this.erase(
      scope,
      this.repositories.pullRequests,
      (record) => record.erasing(scope),
      (record) => record.erased(),
    );
  }

  alertStates(scope: DeletionScope): Promise<void> {
    return this.erase(scope, this.repositories.alertStates, (alertState) =>
      alertState.erasing(scope),
    );
  }

  chats(scope: DeletionScope): Promise<void> {
    return this.eraseNoted(scope, this.repositories.chats);
  }

  private erase<A>(
    scope: DeletionScope,
    aggregates: ErasedAggregates<A>,
    erasing: (aggregate: A) => A | null = () => null,
    removed: (aggregate: A) => A = (aggregate) => aggregate,
  ): Promise<void> {
    return this.transaction.inTransaction(async () => {
      await this.deletions.markDeleted(scope);

      for (;;) {
        const found = await aggregates.ofScope(scope, AT_ONCE);
        let changed = false;

        for (const aggregate of found) {
          const erased = erasing(aggregate);

          if (erased === null) {
            await aggregates.remove(removed(aggregate));
            changed = true;
          } else if (erased !== aggregate && aggregates.save) {
            await aggregates.save(erased);
            changed = true;
          }
        }

        if (found.length < AT_ONCE || !changed) {
          return;
        }
      }
    });
  }

  private eraseNoted(
    scope: DeletionScope,
    ledger: ScopedLedger,
  ): Promise<void> {
    return this.transaction.inTransaction(async () => {
      await this.deletions.markDeleted(scope);
      await ledger.removeIn(scope);
    });
  }
}
