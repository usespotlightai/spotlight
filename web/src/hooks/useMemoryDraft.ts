import { useState } from 'react';
import type { LineResponseDto, WriteMemoryRequestDto } from '@/lib/api';
import { kindOf, type MemoryKind, type TeamMemory } from '@/lib/memory';

type Draftable = Pick<
  TeamMemory,
  'kind' | 'body' | 'lineId' | 'stationId' | 'repository' | 'paths'
>;

const pathsIn = (typed: string): string[] =>
  typed
    .split(',')
    .map((each) => each.trim())
    .filter(Boolean);

export function useMemoryDraft(
  initial: Draftable | null,
  lines: readonly LineResponseDto[],
) {
  const [kind, setKind] = useState<MemoryKind>(() =>
    kindOf(initial?.kind ?? null),
  );
  const [body, setBody] = useState(initial?.body ?? '');
  const [lineId, setLineId] = useState(initial?.lineId ?? null);
  const [stationId, setStationId] = useState(initial?.stationId ?? null);
  const [repository, setRepository] = useState(initial?.repository ?? null);
  const [paths, setPaths] = useState(() => initial?.paths.join(', ') ?? '');

  const line = lines.find((each) => each.id === lineId);

  return {
    kind,
    setKind: (next: string | null) => setKind(kindOf(next)),
    body,
    setBody,
    lineId,
    chooseLine: (next: string | null) => {
      setLineId(next);
      setStationId(null);
      setRepository(null);
    },
    stationId,
    setStationId,
    repository,
    setRepository,
    paths,
    setPaths,
    line,
    stations: (line?.stations ?? []).filter((each) => each.kind === 'work'),
    repositories: [
      ...new Set((line ? [line] : lines).flatMap((each) => each.repositories)),
    ],
    empty: !body.trim(),
    reset: (from: Draftable) => {
      setKind(kindOf(from.kind));
      setBody(from.body);
      setLineId(from.lineId);
      setStationId(from.stationId);
      setRepository(from.repository);
      setPaths(from.paths.join(', '));
    },
    written: (): WriteMemoryRequestDto => ({
      kind,
      body: body.trim(),
      lineId,
      stationId,
      repository,
      paths: repository ? pathsIn(paths) : [],
    }),
  };
}

export type MemoryDraft = ReturnType<typeof useMemoryDraft>;
