import { useQuery } from '@tanstack/react-query';

import { readEditorConnection } from '@/lib/api';
import type { SandboxTarget } from '@/lib/editor';

const POLL_MS = 2_000;

const editorConnectionKeys = {
  since: (target: SandboxTarget, slug: string, since: number | null) =>
    ['editor-connection', slug, target.kind, target.id, since] as const,
};

export function useEditorConnection(
  target: SandboxTarget,
  slug: string,
  since: number | null,
) {
  return useQuery({
    queryKey: editorConnectionKeys.since(target, slug, since),
    enabled: since !== null,
    refetchInterval: (query) =>
      query.state.data || query.state.status === 'error' ? false : POLL_MS,
    refetchIntervalInBackground: true,
    retry: false,
    gcTime: 0,
    meta: { persist: false },
    queryFn: async () => {
      const { data } = await readEditorConnection({
        query: { [target.kind]: target.id, workspace: slug },
        throwOnError: true,
      });
      return data.connected;
    },
  });
}
