import type { JournalStepResponseDto, SearchRunResponseDto } from '@/lib/api';
import { hoursAgo } from '@/mocks/clock';
import { world } from '@/mocks/world';
import { activityOfState } from '@/mocks/world/run-activity';
import { searchStore } from '@/mocks/world/station-searches';
import { SEARCH_NOTES } from '@/mocks/world/station-seeds';
import { placeOfSet, type StationLocation } from '@/mocks/world/station-sets';
import { runStationOf } from '@/mocks/world/stations';

const stateOf = (failed: boolean, running: boolean) =>
  failed
    ? ('failed' as const)
    : running
      ? ('claimed' as const)
      : ('completed' as const);

const historyCommandOf = (place: StationLocation | undefined): string =>
  `spotlight history --station ${place?.stationKey ?? ''} --line ${place?.lineKey ?? ''}`;

const briefingOf = (
  place: StationLocation | undefined,
  iteration: number,
  perIteration: number,
): string =>
  [
    '# Searching for a better station',
    '',
    `You are improving the ${place?.stationName ?? 'agent'} station of the ${place?.lineName ?? 'its'} line. Propose up to ${perIteration} candidate configs in iteration ${iteration}; each is replayed on the searched tasks.`,
    '',
    '## What you may change',
    '',
    '- agent_prompt, model, effort, skills',
    '',
    '## How to go about it',
    '',
    `1. Read how earlier candidates did: \`${historyCommandOf(place)}\``,
    '2. Propose: `spotlight candidate --name … --hypothesis …`',
    '3. End the run once you have proposed.',
  ].join('\n');

const stepsOf = (
  runId: string,
  place: StationLocation | undefined,
  proposed: readonly string[],
  startedHoursAgo: number,
  running: boolean,
): JournalStepResponseDto[] => {
  const [thought, message] = SEARCH_NOTES[runId] ?? [
    'Reading how the earlier candidates did.',
    `Proposed ${proposed.length} candidate${proposed.length === 1 ? '' : 's'}`,
  ];
  const base = {
    status: null,
    tool: null,
    detail: null,
    locations: [],
    input: null,
    output: null,
    change: null,
  };

  return [
    {
      ...base,
      kind: 'tool',
      status: 'completed',
      tool: 'execute',
      text: historyCommandOf(place),
      ms: 1_400,
      startedAt: hoursAgo(startedHoursAgo - 0.02),
    },
    {
      ...base,
      kind: 'thought',
      text: thought,
      ms: 1_200,
      startedAt: hoursAgo(startedHoursAgo - 0.05),
    },
    ...(running ? [] : proposed).map((candidateId, place) => ({
      ...base,
      kind: 'tool' as const,
      status: 'completed',
      tool: 'execute',
      text: `spotlight candidate --name ${candidateId.replace(/^candidate_/, '').replaceAll('_', '-')} --hypothesis "…" station.json`,
      ms: 2_100,
      startedAt: hoursAgo(startedHoursAgo - 0.1 - place * 0.05),
    })),
    ...(running
      ? []
      : [
          {
            ...base,
            kind: 'message' as const,
            text: message,
            ms: 400,
            startedAt: hoursAgo(startedHoursAgo - 0.25),
          },
        ]),
  ];
};

export const searchRun = (runId: string): SearchRunResponseDto | null => {
  for (const search of searchStore()) {
    const iteration = search.iterations.find((each) => each.runId === runId);

    if (!iteration) {
      continue;
    }

    const span =
      (search.startedHoursAgo - (search.endedHoursAgo ?? 0)) /
      search.iterations.length;
    const startedHoursAgo =
      search.startedHoursAgo - 0.3 - (iteration.number - 1) * span;
    const running = iteration.state === 'running';
    const endedHoursAgo = running ? 0 : startedHoursAgo - 0.3;
    const failed = iteration.state === 'failed';
    const cost = iteration.agentSpent?.spends[0]?.amount ?? null;
    const place = placeOfSet(search.setId);
    const stations =
      world().lines[place?.teamId ?? '']?.find(
        (line) => line.id === place?.lineId,
      )?.stations ?? [];

    return {
      id: runId,
      briefing: briefingOf(place, iteration.number, search.budget.perIteration),
      state: stateOf(failed, running),
      activity: activityOfState(stateOf(failed, running)),
      attempt: 1,
      exitCode: failed ? 1 : running ? null : 0,
      startedAt: hoursAgo(startedHoursAgo),
      updatedAt: hoursAgo(endedHoursAgo),
      harness: search.agent.harness,
      image: null,
      station: runStationOf(stations, place?.stationId ?? ''),
      review: null,
      searchId: search.id,
      iteration: iteration.number,
      agent: search.agent,
      failure: failed ? 'runner-lost' : null,
      endedAt: running ? null : hoursAgo(endedHoursAgo),
      spent: {
        spentCosts: cost === null ? [] : [{ amount: cost, currency: 'USD' }],
        unpricedCalls: 0,
      },
      spend:
        cost === null
          ? null
          : {
              cost,
              currency: 'USD',
              inputTokens: Math.round(cost * 3_900),
              outputTokens: Math.round(cost * 15_800),
              cacheReadTokens: Math.round(cost * 660_000),
              cacheWriteTokens: Math.round(cost * 35_000),
            },
      journals: failed
        ? []
        : [
            {
              runId,
              attempt: 1,
              ms: 1_080_000,
              spans: [],
              marks: {
                startedAt: hoursAgo(startedHoursAgo),
                readyAt: null,
                firstAgentUpdateAt: null,
                lastAgentUpdateAt: null,
                agentStoppedAt: null,
                endedAt: running ? null : hoursAgo(endedHoursAgo),
              },
              spent: {
                used: 61_000,
                size: 200_000,
                cost: null,
                currency: null,
              },
              steps: stepsOf(
                runId,
                place,
                iteration.proposed,
                startedHoursAgo,
                running,
              ),
            },
          ],
    };
  }

  return null;
};
