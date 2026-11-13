import type { EditorTarget } from '@work/application/dto/editor-connection.dto';

export class ConnectEditorCommand {
  constructor(
    readonly viewerId: string,
    readonly target: EditorTarget,
    readonly workspaceSlug: string | null,
  ) {}
}
