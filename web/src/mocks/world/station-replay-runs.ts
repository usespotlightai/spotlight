import type {
  JournalStepResponseDto,
  ReplayEntryResponseDto,
  ReplayOfRunResponseDto,
  ReplayRunResponseDto,
} from '@/lib/api';
import { hoursAgo } from '@/mocks/clock';
import { world } from '@/mocks/world';
import {
  checksOfSet,
  entriesOf,
  entryTiming,
  type ReplaySpec,
  replayStore,
} from '@/mocks/world/station-replays';
import { placeOfSet, runOfStation, setSpec } from '@/mocks/world/station-sets';
import { runStationOf } from '@/mocks/world/stations';

type Found = {
  readonly replay: ReplaySpec;
  readonly entry: ReplayEntryResponseDto;
};

const findEntry = (runId: string): Found | undefined => {
  for (const replay of replayStore()) {
    const entry = entriesOf(replay).find((each) => each.runId === runId);

    if (entry) {
      return { replay, entry };
    }
  }

  return undefined;
};

const step = (
  over: Partial<JournalStepResponseDto> &
    Pick<JournalStepResponseDto, 'kind' | 'text'> & { at: number },
): JournalStepResponseDto => {
  const { at, ...rest } = over;

  return {
    status: null,
    tool: null,
    detail: null,
    ms: 600,
    startedAt: hoursAgo(at),
    locations: [],
    given: null,
    returned: null,
    change: null,
    ...rest,
  };
};

const testFailed = (path: string) =>
  [
    ` FAIL  ${path.replace(/\.ts$/, '.test.ts')}`,
    'AssertionError: expected 2 to equal 1',
    '',
    ' Test Files  1 failed | 23 passed (24)',
    '      Tests  1 failed | 211 passed (212)',
  ].join('\n');

const testCommandOf = (path: string): string => {
  const folder = path.split('/').slice(-2, -1)[0];
  return folder ? `npm test -- ${folder}` : 'npm test';
};

const TEST_PASSED = [
  ' Test Files  24 passed (24)',
  '      Tests  212 passed (212)',
].join('\n');

const readingStepsOf = (
  title: string,
  path: string,
  summary: string,
  startedHoursAgo: number,
): JournalStepResponseDto[] => [
  step({
    kind: 'thought',
    text: `Read the task “${title}” and what the earlier stations left on it.`,
    at: startedHoursAgo - 0.01,
  }),
  step({
    kind: 'tool',
    tool: 'read',
    status: 'completed',
    text: path,
    ms: 300,
    at: startedHoursAgo - 0.02,
  }),
  step({ kind: 'said', text: summary, ms: 500, at: startedHoursAgo - 0.05 }),
];

const stepsOf = (
  title: string,
  path: string,
  summary: string,
  passed: boolean,
  startedHoursAgo: number,
): JournalStepResponseDto[] => [
  step({
    kind: 'thought',
    text: `Read the spec for “${title}” and the tests next to ${path} first.`,
    at: startedHoursAgo - 0.01,
  }),
  step({
    kind: 'tool',
    tool: 'read',
    status: 'completed',
    text: path,
    ms: 300,
    at: startedHoursAgo - 0.02,
  }),
  step({
    kind: 'tool',
    tool: 'execute',
    status: 'completed',
    text: testCommandOf(path),
    detail: TEST_PASSED,
    ms: 38_000,
    at: startedHoursAgo - 0.03,
  }),
  step({
    kind: 'tool',
    tool: 'edit',
    status: 'completed',
    text: path,
    ms: 1_200,
    at: startedHoursAgo - 0.06,
  }),
  step({
    kind: 'tool',
    tool: 'execute',
    status: passed ? 'completed' : 'failed',
    text: 'npm test',
    detail: passed ? TEST_PASSED : testFailed(path),
    ms: 41_000,
    at: startedHoursAgo - 0.09,
  }),
  step({ kind: 'said', text: summary, ms: 500, at: startedHoursAgo - 0.11 }),
];

export const replayRun = (runId: string): ReplayRunResponseDto | null => {
  const found = findEntry(runId);

  if (!found) {
    return null;
  }

  const { replay, entry } = found;
  const original = runOfStation(entry.originalRunId);
  const title = original?.title ?? null;
  const { startedHoursAgo } = entryTiming(replay, entry.position);
  const ended = entry.phase === 'ended';
  const endedHoursAgo = startedHoursAgo - (entry.ms ?? 0) / 3_600_000;
  const place = placeOfSet(replay.setId);
  const stations =
    world().lines[place?.teamId ?? '']?.find(
      (line) => line.id === place?.lineId,
    )?.stations ?? [];
  const station = stations.find((each) => each.id === place?.stationId);
  const passed = entry.succeeded === true;
  const summary =
    (passed ? original?.note.pass : original?.note.fail) ??
    'Still working on it.';
  const path = original?.note.path ?? 'src/index.ts';
  const harness = station?.harness ?? 'claude-code';

  return {
    id: runId,
    state: ended ? 'completed' : 'claimed',
    attempt: 1,
    exitCode: ended ? 0 : null,
    startedAt: hoursAgo(startedHoursAgo),
    updatedAt: hoursAgo(ended ? endedHoursAgo : 0),
    harness,
    image: null,
    station: runStationOf(stations, place?.stationId ?? ''),
    review: null,
    original: { runId: entry.originalRunId, taskId: entry.taskId, title },
    briefing: [
      `## ${station?.name ?? 'Station'}`,
      '',
      `${title ?? 'The task'}. ${station?.description ?? ''}`.trim(),
      '',
      station?.agentPrompt ?? '',
    ]
      .join('\n')
      .trim(),
    agent: {
      harness,
      model: replay.agent.model,
      effort: replay.agent.effort,
    },
    repositories:
      original && original.repositories.length > 0
        ? [...original.repositories]
        : ['acme/api'],
    spend: entry.cost
      ? {
          cost: entry.cost.amount,
          currency: entry.cost.currency,
          inputTokens: entry.inputTokens,
          outputTokens: entry.outputTokens,
          cacheReadTokens: entry.cacheReadTokens,
          cacheWriteTokens: entry.cacheWriteTokens,
        }
      : null,
    journals: ended
      ? [
          {
            runId,
            attempt: 1,
            ms: entry.ms,
            spans: [],
            marks: {
              startedAt: hoursAgo(startedHoursAgo),
              readyAt: null,
              spokeFrom: null,
              spokeTo: null,
              endedAt: hoursAgo(endedHoursAgo),
            },
            spent: { used: 52_000, size: 200_000, cost: null, currency: null },
            steps: checksOfSet(replay.setId)
              ? stepsOf(
                  title ?? 'the task',
                  path,
                  summary,
                  passed,
                  startedHoursAgo,
                )
              : readingStepsOf(
                  title ?? 'the task',
                  path,
                  summary,
                  startedHoursAgo,
                ),
          },
        ]
      : [],
  };
};

export const replayOfRun = (runId: string): ReplayOfRunResponseDto | null => {
  const found = findEntry(runId);

  if (!found) {
    return null;
  }

  const { replay, entry } = found;

  return {
    replayId: replay.id,
    setId: replay.setId,
    setName: setSpec(replay.setId)?.name ?? null,
    lineId: setSpec(replay.setId)?.lineId ?? '',
    stationId: setSpec(replay.setId)?.stationId ?? '',
    candidate: replay.candidate,
    startedAsBaseline: replay.startedAsBaseline,
    isBaseline: replay.isBaseline,
    state: replay.state,
    entry,
    search: replay.search,
  };
};
