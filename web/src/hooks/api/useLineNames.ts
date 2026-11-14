import { useQueries } from '@tanstack/react-query';

import { linesQuery } from '@/hooks/api/useLines';
import { useWorkspace } from '@/hooks/api/useWorkspace';

export function useLineNames(
  slug: string,
  enabled: boolean,
): ReadonlyMap<string, string> {
  const { data: workspace } = useWorkspace(slug);
  const lines = useQueries({
    queries: (workspace?.teams ?? []).map((team) => ({
      ...linesQuery(team.id),
      enabled,
    })),
  });

  return new Map(
    lines.flatMap((each) =>
      (each.data ?? []).map((line) => [line.id, line.name] as const),
    ),
  );
}
