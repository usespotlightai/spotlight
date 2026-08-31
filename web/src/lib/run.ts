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
const WEEK = 7 * DAY;

export const aged = (at: string): string => {
  const ago = Date.now() - new Date(at).getTime();

  if (ago < DAY) {
    return 'Today';
  }
  if (ago < 2 * DAY) {
    return 'Yesterday';
  }
  if (ago < 2 * WEEK) {
    return `${Math.floor(ago / DAY)} days ago`;
  }
  if (ago < 8 * WEEK) {
    return `${Math.floor(ago / WEEK)} weeks ago`;
  }

  const months = Math.floor(ago / (30 * DAY));
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
