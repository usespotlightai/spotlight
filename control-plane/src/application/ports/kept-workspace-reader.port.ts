import type { RunnerId } from '@domain/value-objects/runner-id.vo';

export type KeptWorkspace =
  | { readonly taskId: string; readonly stationId: string }
  | { readonly chatId: string };

export const KEPT_WORKSPACE_READER = Symbol('KEPT_WORKSPACE_READER');

export interface KeptWorkspaceReaderPort {
  listFor(runnerId: RunnerId): Promise<KeptWorkspace[]>;
}
