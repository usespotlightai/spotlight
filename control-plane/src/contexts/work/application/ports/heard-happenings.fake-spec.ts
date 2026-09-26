import type { HeardHappeningsPort } from '@work/application/ports/heard-happenings.port';

export const heardInMemory = (): HeardHappeningsPort => {
  const heard = new Set<string>();

  return {
    heard: async (workspaceId, key) => heard.has(`${workspaceId.value}/${key}`),
    hearing: async (workspaceId, key) => {
      const first = !heard.has(`${workspaceId.value}/${key}`);
      heard.add(`${workspaceId.value}/${key}`);
      return first;
    },
    forgetBefore: async () => 0,
  };
};
