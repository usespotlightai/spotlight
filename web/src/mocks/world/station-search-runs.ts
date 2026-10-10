import type { JournalStepResponseDto, SearchRunResponseDto } from '@/lib/api';
import { hoursAgo } from '@/mocks/clock';
import { DELIVERY_ID, PLATFORM_ID, world } from '@/mocks/world';
import { IMPLEMENTATION_ID } from '@/mocks/world/station-history';
import { searchStore } from '@/mocks/world/station-searches';
import { runStationOf } from '@/mocks/world/stations';

const NOTES: Record<number, readonly string[]> = {
  1: [
    'Three of five searched tasks failed after editing billing code before reading its tests.',
    'Proposed tests-first; replaying it on 5 tasks',
  ],
  2: [
    'tests-first leads. The refund task still fails on every candidate, so try a larger model and a review pass.',
    'Proposed opus and review-skill; replaying each on 5 tasks',
  ],
};

const briefingOf = (iteration: number, perIteration: number): string =>
  [
    '# Searching for a better station',
    '',
    `You are improving the Implementation station of the Delivery line. Propose up to ${perIteration} candidate configs in iteration ${iteration}; each is replayed on the searched tasks.`,
    '',
    '## What you may change',
    '',
    '- agent_prompt, model, effort, skills',
    '',
    '## How to go about it',
    '',
    '1. Read how earlier candidates did: `spotlight history --station implementation --line delivery`',
    '2. Propose: `spotlight candidate --name … --hypothesis …`',
    '3. End the run once you have proposed.',
  ].join('\n');

const stepsOf = (
  iteration: number,
  proposed: readonly string[],
  startedHoursAgo: number,
): JournalStepResponseDto[] => {
  const [thought, said] = NOTES[iteration] ?? [
    'Reading how the earlier candidates did.',
    `Proposed ${proposed.length} candidate${proposed.length === 1 ? '' : 's'}`,
  ];
  const base = {
    status: null,
    tool: null,
    detail: null,
    locations: [],
    given: null,
    returned: null,
    change: null,
  };

  return [
    {
      ...base,
      kind: 'tool',
      status: 'completed',
      tool: 'execute',
      text: 'spotlight history --station implementation --line delivery',
      ms: 1_400,
      startedAt: hoursAgo(startedHoursAgo - 0.02),
    },
    {
      ...base,
      kind: 'thought',
      text: thought ?? '',
      ms: 1_200,
      startedAt: hoursAgo(startedHoursAgo - 0.05),
    },
    ...proposed.map((candidateId, place) => ({
      ...base,
      kind: 'tool' as const,
      status: 'completed',
      tool: 'execute',
      text: `spotlight candidate --name ${candidateId.replace(/^candidate_/, '').replaceAll('_', '-')} --hypothesis "…" station.json`,
      ms: 2_100,
      startedAt: hoursAgo(startedHoursAgo - 0.1 - place * 0.05),
    })),
    {
      ...base,
      kind: 'said',
      text: said ?? '',
      ms: 400,
      startedAt: hoursAgo(startedHoursAgo - 0.25),
    },
  ];
};

export const searchRun = (runId: string): SearchRunResponseDto | null => {
  for (const search of searchStore()) {
    const iteration = search.iterations.find((each) => each.runId === runId);

    if (!iteration) {
      continue;
    }

    const startedHoursAgo =
      search.startedHoursAgo - 0.5 - (iteration.number - 1) * 2;
    const endedHoursAgo = startedHoursAgo - 0.3;
    const failed = iteration.state === 'failed';
    const cost = iteration.agentSpent?.spends[0]?.amount ?? null;
    const stations =
      world().lines[PLATFORM_ID]?.find((line) => line.id === DELIVERY_ID)
        ?.stations ?? [];

    return {
      id: runId,
      briefing: briefingOf(iteration.number, search.budget.perIteration),
      state: failed ? 'failed' : 'completed',
      attempt: 1,
      exitCode: failed ? 1 : 0,
      startedAt: hoursAgo(startedHoursAgo),
      updatedAt: hoursAgo(endedHoursAgo),
      harness: search.agent.harness,
      image: null,
      station: runStationOf(stations, IMPLEMENTATION_ID),
      review: null,
      searchId: search.id,
      iteration: iteration.number,
      agent: search.agent,
      failure: failed ? 'runner-lost' : null,
      endedAt: hoursAgo(endedHoursAgo),
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
                spokeFrom: null,
                spokeTo: null,
                endedAt: hoursAgo(endedHoursAgo),
              },
              spent: {
                used: 61_000,
                size: 200_000,
                cost: null,
                currency: null,
              },
              steps: stepsOf(
                iteration.number,
                iteration.proposed,
                startedHoursAgo,
              ),
            },
          ],
    };
  }

  return null;
};
