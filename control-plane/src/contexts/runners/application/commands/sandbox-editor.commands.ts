import type { EditorTarget } from '@runners/application/ports/editor-access.port';

export class ConnectEditorCommand {
  constructor(
    readonly viewerId: string,
    readonly target: EditorTarget,
    readonly workspaceSlug: string | null,
  ) {}
}
