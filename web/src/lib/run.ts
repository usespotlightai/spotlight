import type { TaskRunResponseDto, TeamRunResponseDto } from '@/lib/api';

export type Run = TaskRunResponseDto;

export type TeamRun = TeamRunResponseDto;

export type Review = NonNullable<Run['review']>;

/** One a person has answered is done with, and recedes further than the rest. */
export const reviewInk = (review: Review): string =>
  review.state === 'owed' ? 'text-muted-foreground' : 'text-faint';

export const working = (run: Run): boolean =>
  run.state === 'claimed' || run.state === 'queued';

/** Finishing is the ordinary case and says nothing. */
export const standing = (run: Run): string | null => {
  if (run.state === 'claimed') {
    return 'Running';
  }
  if (run.state === 'queued') {
    return 'Queued';
  }

  return null;
};

export const runPath = (slug: string, teamId: string, runId: string): string =>
  `/w/${slug}/team/${teamId}/runs/${encodeURIComponent(runId)}`;

const DAY = 24 * 60 * 60 * 1000;

/** Local midnight, so an age counts the days a person reads off a calendar. */
const midnight = (at: Date): number =>
  new Date(at.getFullYear(), at.getMonth(), at.getDate()).getTime();

export const aged = (at: string): string => {
  // Rounded because a day either side of a clock change is not 24 hours long.
  const days = Math.round(
    (midnight(new Date()) - midnight(new Date(at))) / DAY,
  );

  if (days <= 0) {
    return 'Today';
  }
  if (days === 1) {
    return 'Yesterday';
  }
  if (days < 14) {
    return `${days} days ago`;
  }
  if (days < 56) {
    return `${Math.floor(days / 7)} weeks ago`;
  }

  const months = Math.floor(days / 30);
  return months <= 1 ? 'A month ago' : `${months} months ago`;
};

/** Grouped by neighbour, so the order the reader gave them is kept. */
export const byAge = <T extends { startedAt: string }>(
  runs: readonly T[],
): [string, T[]][] => {
  const grouped: [string, T[]][] = [];

  for (const run of runs) {
    const label = aged(run.startedAt);
    const last = grouped[grouped.length - 1];

    if (last && last[0] === label) {
      last[1].push(run);
    } else {
      grouped.push([label, [run]]);
    }
  }

  return grouped;
};
