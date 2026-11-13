type EditorTargetKind = 'task' | 'chat';

export interface EditorTarget {
  readonly kind: EditorTargetKind;
  readonly id: string;
}

export interface EditorConnectionDto {
  readonly sandboxId: string;
  readonly holder: string;
}

export interface EditorConnectionStateDto {
  readonly connected: boolean;
}
