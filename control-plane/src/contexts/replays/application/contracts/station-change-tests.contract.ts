import type {
  RequestRefusal,
  SetSkipReason,
} from '@replays/domain/services/search-schedule';
import type { StationChangeTestMode } from '@replays/domain/services/station-change-test';
import type { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import type { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface StationChangeTestRequest {
  readonly workspaceId: WorkspaceId;
  readonly teamId: TeamId;
  readonly lineId: LineId;
  readonly stationId: StationId;
  readonly requester: UserId;
  readonly mode: StationChangeTestMode;
  readonly name: string;
  readonly hypothesis: string;
  readonly fields: unknown;
}

export type StationChangeRefusal =
  | 'station-gone'
  | 'not-replayable'
  | 'search-off'
  | 'no-replay-set'
  | 'search-running'
  | RequestRefusal
  | SetSkipReason;

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
] as const satisfies readonly StationChangeRefusal[];

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
