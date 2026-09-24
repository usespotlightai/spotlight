export const PERMISSION_ANSWERS = ['allow', 'reject', 'asked'] as const;

export type PermissionAnswer = (typeof PERMISSION_ANSWERS)[number];

export interface PermissionAnswerDto {
  readonly decision: PermissionAnswer;
}
