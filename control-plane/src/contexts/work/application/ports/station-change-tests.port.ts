import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const STATION_CHANGE_TESTS = Symbol('STATION_CHANGE_TESTS');

export const STATION_CHANGE_TEST_MODES = ['test', 'search'] as const;

export type StationChangeTestMode = (typeof STATION_CHANGE_TEST_MODES)[number];

export interface StationChangeTestRequest {
  readonly workspaceId: WorkspaceId;
  readonly teamId: TeamId;
  readonly lineId: string;
  readonly stationId: string;
  readonly requester: UserId;
  readonly mode: StationChangeTestMode;
  readonly name: string;
  readonly hypothesis: string;
  readonly block: unknown;
}

export const STATION_CHANGE_REFUSALS = [
  'station-gone',
  'not-replayable',
  'search-off',
  'no-replay-set',
  'result-pending',
  'search-running',
  'request-limit',
  'pull-request-open',
  'monthly-ceiling',
  'no-scoring',
  'no-agent',
  'set-too-small',
  'no-fresh-held-out',
  'ceiling-too-low',
  'noisy',
  'judge-unstable',
  'flaky-checks',
  'no-headroom',
] as const;

export type StationChangeRefusal = (typeof STATION_CHANGE_REFUSALS)[number];

const STATION_CHANGE_TOOL_REFUSALS = [
  'not-improving',
  'other-station',
  'invalid-mode',
  'invalid-change',
] as const;

export type StationChangeToolRefusal =
  | StationChangeRefusal
  | (typeof STATION_CHANGE_TOOL_REFUSALS)[number];

export interface StationChangeTestScope {
  readonly mode: StationChangeTestMode;
  readonly searchedTasks: number;
  readonly heldOutTasks: number;
  readonly iterations: number;
}

export type StationChangeTestOutcome =
  | ({ readonly outcome: 'started' } & StationChangeTestScope)
  | ({
      readonly outcome: 'joined';
      readonly iteration: number;
    } & StationChangeTestScope)
  | {
      readonly outcome: 'invalid';
      readonly problems: readonly {
        readonly path: string;
        readonly reason: string;
      }[];
    }
  | {
      readonly outcome: 'refused';
      readonly code: StationChangeRefusal;
      readonly reason: string;
    };

export interface StationChangeTestsPort {
  request(request: StationChangeTestRequest): Promise<StationChangeTestOutcome>;
}
