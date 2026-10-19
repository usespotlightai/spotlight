const fieldOf = (encoded: unknown, key: string): unknown =>
  typeof encoded === 'object' && encoded !== null
    ? (encoded as Record<string, unknown>)[key]
    : undefined;

const idOf = (payload: unknown, key: string): string | undefined => {
  const field = fieldOf(payload, key);
  const id = typeof field === 'string' ? field : fieldOf(field, 'value');

  return typeof id === 'string' ? id : undefined;
};

export const idsOf = (payload: unknown) => ({
  workspaceId: idOf(payload, 'workspaceId'),
  teamId: idOf(payload, 'teamId'),
  taskId: idOf(payload, 'taskId'),
  runId: idOf(payload, 'runId'),
});
