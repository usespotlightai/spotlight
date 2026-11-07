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
import { DeletionScope } from '@insights/domain/value-objects/deletion-scope.vo';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';

const AT_ONCE = 200;

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
      (record) => record.delete(),
    );
  }

  judgings(scope: DeletionScope): Promise<void> {
    return this.erase(
      scope,
      this.repositories.judgings,
      () => null,
      (judging) => judging.delete(),
    );
  }

  scores(scope: DeletionScope): Promise<void> {
    return this.erase(
      scope,
      this.repositories.scores,
      () => null,
      (score) => score.delete(),
    );
  }

  humanActions(scope: DeletionScope): Promise<void> {
    return this.erase(
      scope,
      this.repositories.humanActions,
      () => null,
      (humanActions) => humanActions.delete(),
      (humanActions) =>
        DeletionScope.taskDeletedWith(scope, humanActions.taskId),
    );
  }

  failures(scope: DeletionScope): Promise<void> {
    return this.erase(
      scope,
      this.repositories.failures,
      () => null,
      (failures) => failures.delete(),
    );
  }

  changeShapes(scope: DeletionScope): Promise<void> {
    return this.erase(
      scope,
      this.repositories.shapes,
      () => null,
      (shape) => shape.delete(),
    );
  }

  pullRequests(scope: DeletionScope): Promise<void> {
    return this.erase(
      scope,
      this.repositories.pullRequests,
      (record) => record.erasing(scope),
      (record) => record.delete(),
    );
  }

  alertStates(scope: DeletionScope): Promise<void> {
    return this.erase(
      scope,
      this.repositories.alertStates,
      (alertState) => alertState.erasing(scope),
      (alertState) => alertState.delete(),
    );
  }

  chats(scope: DeletionScope): Promise<void> {
    return this.eraseNoted(scope, this.repositories.chats);
  }

  private async erase<A>(
    scope: DeletionScope,
    aggregates: ScopedRemoval<A>,
    erasing: (aggregate: A) => A | null,
    deleting: (aggregate: A) => A,
    deletedWith: (aggregate: A) => DeletionScope | null = () => null,
  ): Promise<void> {
    await this.transaction.inTransaction(() =>
      this.deletions.markDeleted(scope),
    );

    for (;;) {
      const found = await aggregates.ofScope(scope, AT_ONCE);
      let changed = false;

      for (const aggregate of found) {
        const erased = erasing(aggregate);

        if (erased === null) {
          const deleted = deletedWith(aggregate);

          await this.transaction.inTransaction(async () => {
            if (deleted) {
              await this.deletions.markDeleted(deleted);
            }
            await aggregates.save(deleting(aggregate));
          });
          changed = true;
        } else if (erased !== aggregate) {
          await this.transaction.inTransaction(() => aggregates.save(erased));
          changed = true;
        }
      }

      if (found.length < AT_ONCE || !changed) {
        return;
      }
    }
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
