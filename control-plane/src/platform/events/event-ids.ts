import { fieldOf } from '@platform/json/field-of';
const idOf = (payload: unknown, key: string): string | undefined => {
  const field = fieldOf(payload, key);
  const id = typeof field === 'string' ? field : fieldOf(field, 'value');

  return typeof id === 'string' ? id : undefined;
};

export interface EventIds {
  readonly workspaceId: string | undefined;
  readonly teamId: string | undefined;
  readonly taskId: string | undefined;
  readonly runId: string | undefined;
}

export const idsOf = (payload: unknown): EventIds => ({
  workspaceId: idOf(payload, 'workspaceId'),
  teamId: idOf(payload, 'teamId'),
  taskId: idOf(payload, 'taskId'),
  runId: idOf(payload, 'runId'),
});
