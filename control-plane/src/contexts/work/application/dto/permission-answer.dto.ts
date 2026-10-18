export const PERMISSION_ANSWERS = ['allow', 'reject', 'pending'] as const;

export type PermissionAnswer = (typeof PERMISSION_ANSWERS)[number];

export interface PermissionAnswerDto {
  readonly decision: PermissionAnswer;
}
