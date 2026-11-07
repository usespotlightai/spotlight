import type {
  StationChangeTestOutcome as ReplaysOutcome,
  StationChangeRefusal as ReplaysRefusal,
} from '@replays/application/contracts/station-change-tests.contract';
import type { StationChangeTests } from '@replays/application/services/station-change-tests.service';
import type {
  StationChangeRefusal,
  StationChangeTestOutcome,
  StationChangeTestRequest,
  StationChangeTestsPort,
} from '@work/application/ports/station-change-tests.port';

const REFUSALS: Record<ReplaysRefusal, StationChangeRefusal> = {
  'station-gone': 'station-gone',
  'not-replayable': 'not-replayable',
  'search-off': 'search-off',
  'no-replay-set': 'no-replay-set',
  'search-running': 'search-running',
  'result-pending': 'result-pending',
  'pull-request-open': 'pull-request-open',
  'monthly-ceiling': 'monthly-ceiling',
  'request-limit': 'request-limit',
  'no-scoring': 'no-scoring',
  'set-too-small': 'set-too-small',
  noisy: 'noisy',
  'judge-unstable': 'judge-unstable',
  'flaky-checks': 'flaky-checks',
  'no-headroom': 'no-headroom',
  'no-fresh-held-out': 'no-fresh-held-out',
  'ceiling-too-low': 'ceiling-too-low',
  'no-agent': 'no-agent',
};

const outcomeOf = (outcome: ReplaysOutcome): StationChangeTestOutcome => {
  switch (outcome.outcome) {
    case 'started':
      return {
        outcome: 'started',
        mode: outcome.mode,
        searchedTasks: outcome.searchedTasks,
        heldOutTasks: outcome.heldOutTasks,
        iterations: outcome.iterations,
      };
    case 'joined':
      return {
        outcome: 'joined',
        iteration: outcome.iteration,
        mode: outcome.mode,
        searchedTasks: outcome.searchedTasks,
        heldOutTasks: outcome.heldOutTasks,
        iterations: outcome.iterations,
      };
    case 'invalid':
      return {
        outcome: 'invalid',
        problems: outcome.problems.map((each) => ({
          path: each.path,
          reason: each.reason,
        })),
      };
    case 'refused':
      return {
        outcome: 'refused',
        code: REFUSALS[outcome.code],
        reason: outcome.reason,
      };
  }
};

export class WorkStationChangeTests implements StationChangeTestsPort {
  constructor(private readonly tests: StationChangeTests) {}

  async request(
    request: StationChangeTestRequest,
  ): Promise<StationChangeTestOutcome> {
    return outcomeOf(
      await this.tests.request({
        workspaceId: request.workspaceId,
        teamId: request.teamId,
        lineId: request.lineId,
        stationId: request.stationId,
        requester: request.requester,
        mode: request.mode,
        name: request.name,
        hypothesis: request.hypothesis,
        block: request.block,
      }),
    );
  }
}
