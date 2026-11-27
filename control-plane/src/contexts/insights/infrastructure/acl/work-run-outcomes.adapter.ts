import type { RunOutcomeDto } from '@insights/application/dto/run-outcome.dto';
import type { RunOutcomes } from '@insights/application/services/run-outcomes.service';
import type { LabelSource } from '@insights/domain/value-objects/label-source';
import type { RunHumanAction } from '@insights/domain/value-objects/person-action.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type {
  PeopleVerdictSource,
  RunHumanActionKind,
  RunResultShape,
  RunResultsPort,
} from '@work/application/ports/run-results.port';

const HUMAN_ACTION_KINDS: Record<RunHumanAction, RunHumanActionKind> = {
  started: 'started',
  parked: 'parked',
  accepted: 'accepted',
  'sent-back': 'sent-back',
  'held-as-wrong': 'held-as-wrong',
  answered: 'answered',
};

const PEOPLE_VERDICT_SOURCES: Record<LabelSource, PeopleVerdictSource> = {
  accepted: 'accepted',
  'sent-back': 'sent-back',
  merged: 'merged',
  'held-as-wrong': 'held-as-wrong',
  'marked-right': 'marked-right',
  'marked-wrong': 'marked-wrong',
};

const shapeOf = (outcome: RunOutcomeDto): RunResultShape => ({
  runId: outcome.runId,
  fingerprint: outcome.fingerprint,
  endedAt: outcome.endedAt,
  ending: outcome.ending,
  failure: outcome.failure,
  runNumber: outcome.runNumber,
  checks: outcome.checks,
  humanAction: outcome.humanAction
    ? {
        kind: HUMAN_ACTION_KINDS[outcome.humanAction.kind],
        at: outcome.humanAction.at,
      }
    : null,
  pullRequestState: outcome.pullRequestState,
  peopleVerdict:
    outcome.labelFrom && outcome.peoplePass !== null
      ? {
          passes: outcome.peoplePass,
          from: PEOPLE_VERDICT_SOURCES[outcome.labelFrom],
        }
      : null,
});

export class WorkRunOutcomes implements RunResultsPort {
  constructor(private readonly outcomes: RunOutcomes) {}

  async of(
    runIds: readonly string[],
    asOf: Date | null,
  ): Promise<ReadonlyMap<string, RunResultShape>> {
    const outcomes = await this.outcomes.of(
      runIds.filter((each) => each.trim()).map(RunId.of),
      asOf,
    );

    return new Map(
      outcomes.map((outcome) => [outcome.runId, shapeOf(outcome)] as const),
    );
  }
}
