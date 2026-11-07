import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { Happened } from '@work/application/contracts/happenings.contract';

export const HAPPENING_REACTIONS = Symbol('HAPPENING_REACTIONS');

export type HappeningsReaction =
  | { readonly kind: 'reacted' }
  | {
      readonly kind: 'failed';
      readonly transient: boolean;
      readonly reason: string;
    };

export interface HappeningReactionsPort {
  react(
    workspaceId: WorkspaceId,
    teamId: TeamId | null,
    happenings: readonly Happened[],
    receivedAs: string | null,
  ): Promise<HappeningsReaction>;
}
