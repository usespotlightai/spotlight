type EditorTargetKind = 'task' | 'chat';

export interface EditorTarget {
  readonly kind: EditorTargetKind;
  readonly id: string;
}

export class ConnectEditorCommand {
  constructor(
    readonly viewerId: string,
    readonly target: EditorTarget,
    readonly workspaceSlug: string | null,
  ) {}
}
