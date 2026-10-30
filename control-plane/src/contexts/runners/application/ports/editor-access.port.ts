export const EDITOR_ACCESS = Symbol('EDITOR_ACCESS');

type EditorTargetKind = 'task' | 'chat';

export interface EditorTarget {
  readonly kind: EditorTargetKind;
  readonly id: string;
}

export interface EditedWorkspace {
  readonly workspaceId: string;
  readonly key: string;
}

export interface EditorAccessPort {
  editorAccessFor(
    personId: string,
    target: EditorTarget,
    workspaceSlug: string | null,
  ): Promise<EditedWorkspace | null>;
}
