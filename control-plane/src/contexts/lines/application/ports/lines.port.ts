import type { LineDefinition } from '@lines/application/contracts/line-definition.contract';
import type { LineView } from '@lines/application/contracts/line-view.contract';
import type { ConfigurationProblem } from '@shared-kernel/domain/value-objects/configuration-problem.vo';

export const LINES = Symbol('LINES');

export interface StationPreviewRequest {
  readonly lineId: string;
  readonly stationKey: string;
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
  find(lineId: string): Promise<LineView | null>;

  findByStation(stationId: string): Promise<LineView | null>;

  ofTeam(teamId: string): Promise<readonly LineView[]>;

  ofWorkspace(workspaceId: string): Promise<readonly LineView[]>;

  preview(request: StationPreviewRequest): Promise<StationPreview>;
}
