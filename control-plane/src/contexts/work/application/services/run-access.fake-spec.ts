import { partial } from '@shared-kernel/domain/partial.fake-spec';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { ChatReaderPort } from '@work/application/ports/chat-reader.port';
import type { LineMapsPort } from '@work/application/ports/line-maps.port';
import type { RunAudience } from '@work/application/ports/run-reader.port';
import { RunAccess } from '@work/application/services/run-access.service';
import type { WorkAccess } from '@work/application/services/work-access.service';
import type { LineMap } from '@work/domain/value-objects/line-map.vo';
import type { Station } from '@work/domain/value-objects/station.vo';
import { TeamStanding } from '@work/domain/value-objects/team-standing.vo';

const WORKSPACE = WorkspaceId.of('ws_1');

export const MEMBER = TeamStanding.of({
  seesTeam: true,
  actsOnTeam: true,
  memberOfTeam: true,
});

export const ADMIN_OFF_THE_TEAM = TeamStanding.of({
  seesTeam: true,
  actsOnTeam: true,
  memberOfTeam: false,
});

export const SEES_ONLY = TeamStanding.of({
  seesTeam: true,
  actsOnTeam: false,
  memberOfTeam: false,
});

export const OUTSIDE = TeamStanding.outside();

export const runAccessWhere = (
  sees: boolean,
  standing: TeamStanding = MEMBER,
): RunAccess =>
  new RunAccess(
    partial<ChatReaderPort>({ ownershipOf: async () => null }),
    partial<WorkAccess>({
      seesWorkspace: async () => sees,
      seesWorkspaceOfTeam: async () => false,
      opensChat: async () => false,
      standingOn: async () => standing,
    }),
  );

export const inWorkspace = <T>(
  found: T,
): { readonly workspaceId: WorkspaceId; readonly found: T } => ({
  workspaceId: WORKSPACE,
  found,
});

export const HARNESSED = 'station_3';
const COMPLETED = 'station_completed';

export const linesWhere = (
  harnessed: readonly string[] = [HARNESSED],
): LineMapsPort =>
  partial<LineMapsPort>({
    ofTeam: async () => [
      partial<LineMap>({
        stationAt: (id: StationId) =>
          partial<Station>({
            harness: harnessed.includes(id.value)
              ? HarnessId.of('claude-code')
              : null,
          }),
        completed: partial<Station>({ id: StationId.of(COMPLETED) }),
      }),
    ],
  });

export const audienceOf = (
  over: {
    readonly waits?: boolean;
    readonly task?: Partial<RunAudience['task']>;
    readonly to?: Partial<RunAudience['to']>;
  } = {},
): RunAudience => ({
  teamId: TeamId.of('team_1'),
  taskStationId: HARNESSED,
  waits: over.waits ?? false,
  task: {
    running: false,
    finished: false,
    hold: null,
    pending: null,
    ...over.task,
  },
  to: { toRun: true, currentRun: false, atTaskStation: false, ...over.to },
  run: { stationId: StationId.of(HARNESSED), taskId: TaskId.of('task_1') },
});
