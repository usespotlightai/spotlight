import { useState, type Dispatch, type SetStateAction } from 'react';

import type {
  LineResponseDto,
  WriteMemoryRequestDto,
  StationResponseDto,
} from '@/lib/api';
import {
  kindOf,
  type MemoryKind,
  repositoriesOf,
  type TeamMemory,
  workStationsOf,
} from '@/lib/memory';

type Draftable = Pick<
  TeamMemory,
  'kind' | 'body' | 'lineId' | 'stationId' | 'repository' | 'paths'
>;

const pathsIn = (typed: string): string[] =>
  typed
    .split(',')
    .map((each) => each.trim())
    .filter(Boolean);

export type MemoryDraftResult = {
  kind: MemoryKind;
  setKind: (next: string | null) => void;
  body: string;
  setBody: Dispatch<SetStateAction<string>>;
  lineId: string | null;
  chooseLine: (next: string | null) => void;
  stationId: string | null;
  setStationId: Dispatch<SetStateAction<string | null>>;
  repository: string | null;
  setRepository: Dispatch<SetStateAction<string | null>>;
  paths: string;
  setPaths: Dispatch<SetStateAction<string>>;
  line: LineResponseDto | undefined;
  stations: StationResponseDto[];
  repositories: string[];
  empty: boolean;
  reset: (from: Draftable) => void;
  written: () => WriteMemoryRequestDto;
};

export function useMemoryDraft(
  initial: Draftable | null,
  lines: readonly LineResponseDto[],
): MemoryDraftResult {
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
    stations: workStationsOf(line),
    repositories: repositoriesOf(line, lines),
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
      paths: repository !== null && repository !== '' ? pathsIn(paths) : [],
    }),
  };
}

export type MemoryDraft = ReturnType<typeof useMemoryDraft>;
