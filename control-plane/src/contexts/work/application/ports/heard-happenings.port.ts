import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const HEARD_HAPPENINGS = Symbol('HEARD_HAPPENINGS');

export interface HeardHappeningsPort {
  heard(workspaceId: WorkspaceId, key: string): Promise<boolean>;

  hearing(workspaceId: WorkspaceId, key: string, at: Date): Promise<boolean>;

  forgetBefore(before: Date, most: number): Promise<number>;
}
