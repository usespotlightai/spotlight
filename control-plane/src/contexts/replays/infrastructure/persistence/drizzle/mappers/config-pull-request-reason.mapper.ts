import { ConfigPullRequestReason } from '@replays/domain/value-objects/config-pull-request-reason.vo';
import type { configPullRequest } from '@replays/infrastructure/persistence/drizzle/schemas/replays.schema';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';

type PullRequestRow = typeof configPullRequest.$inferSelect;

export const reasonOf = (
  row: PullRequestRow,
): ConfigPullRequestReason | null => {
  if (row.errorCode === null) {
    return null;
  }
  if (row.errorMessage === null) {
    throw new InconsistentStateError(
      'config pull request',
      'failed without a message',
    );
  }

  return ConfigPullRequestReason.of({
    code: row.errorCode,
    message: row.errorMessage,
    attribute: row.errorAttribute,
    expression: row.errorExpression,
    wanted: row.errorWanted,
  });
};

export const closeFailureOf = (
  row: PullRequestRow,
): ConfigPullRequestReason | null =>
  row.closeFailureCode === null
    ? null
    : ConfigPullRequestReason.of({
        code: row.closeFailureCode,
        message: row.closeFailureMessage ?? '',
      });
