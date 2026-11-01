import type { OpenedSandbox } from '@runners/application/ports/sandboxes.port';
import type { SandboxState } from '@runners/domain/aggregates/sandbox.aggregate';

export const EDITOR_SANDBOXES = Symbol('EDITOR_SANDBOXES');

export interface EditorSandboxesPort {
  open(workspaceId: string, key: string, at: Date): Promise<OpenedSandbox>;

  holdForEditor(
    sandboxId: string,
    holder: string,
    at: Date,
  ): Promise<SandboxState | null>;

  heldByEditor(sandboxId: string, holder: string, at: Date): Promise<boolean>;

  releaseEditor(sandboxId: string, holder: string, at: Date): Promise<void>;

  stateOf(sandboxId: string): Promise<SandboxState | null>;

  readyOn(sandboxId: string): Promise<string | null>;
}
