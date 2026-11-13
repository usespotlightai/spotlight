import type { OpenedSandbox } from '@runners/application/ports/sandboxes.port';

export const EDITOR_SANDBOXES = Symbol('EDITOR_SANDBOXES');

export interface EditorSandbox {
  readonly open: boolean;
  readonly ready: boolean;
}

export interface EditorSandboxesPort {
  open(workspaceId: string, key: string, at: Date): Promise<OpenedSandbox>;

  holdForEditor(
    sandboxId: string,
    holder: string,
    at: Date,
  ): Promise<EditorSandbox | null>;

  heldByEditor(sandboxId: string, holder: string, at: Date): Promise<boolean>;

  heldByAnEditor(workspaceId: string, key: string, at: Date): Promise<boolean>;

  releaseEditor(sandboxId: string, holder: string, at: Date): Promise<void>;

  stateOf(sandboxId: string): Promise<EditorSandbox | null>;

  readyOn(sandboxId: string): Promise<string | null>;

  renewEvery(): number;
}
