import type {
  RequestRefusal,
  SetSkipReason,
} from '@replays/domain/services/search-schedule';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export type StationChangeTestMode = 'test' | 'search';

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

export type StationChangeRefusal =
  | 'station-gone'
  | 'not-replayable'
  | 'search-off'
  | 'no-replay-set'
  | 'search-running'
  | RequestRefusal
  | SetSkipReason;

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
