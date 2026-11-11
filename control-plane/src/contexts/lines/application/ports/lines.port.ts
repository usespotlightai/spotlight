import type { LineDefinition } from '@lines/application/contracts/line-definition.contract';
import type { LineView } from '@lines/application/contracts/line-view.contract';
import type { ConfigurationProblem } from '@shared-kernel/domain/value-objects/configuration-problem.vo';
import type { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import type { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import type { StationKey } from '@shared-kernel/domain/value-objects/station-key.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const LINES = Symbol('LINES');

export interface StationPreviewRequest {
  readonly lineId: LineId;
  readonly stationKey: StationKey;
  readonly block: unknown;
  readonly repositories?: unknown;
}

export type StationPreview =
  | {
      readonly ok: true;
      readonly line: LineView;
      readonly definition: LineDefinition;
    }
  | {
      readonly ok: false;
      readonly problems: readonly ConfigurationProblem[];
    };

export interface LinesPort {
  find(lineId: LineId): Promise<LineView | null>;

  findByStation(stationId: StationId): Promise<LineView | null>;

  ofTeam(teamId: TeamId): Promise<readonly LineView[]>;

  ofWorkspace(workspaceId: WorkspaceId): Promise<readonly LineView[]>;

  keepingWarmSandboxes(): Promise<readonly LineView[]>;

  preview(request: StationPreviewRequest): Promise<StationPreview>;
}
