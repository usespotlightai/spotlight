import type { TaskRunResponseDto, TeamRunResponseDto } from '@/lib/api';

export type Run = TaskRunResponseDto;

export type TeamRun = TeamRunResponseDto;

export type Review = NonNullable<Run['review']>;

export const reviewInk = (review: Review): string =>
  review.state === 'owed' ? 'text-muted-foreground' : 'text-faint opacity-70';

export const working = (run: Run): boolean =>
  run.state === 'claimed' || run.state === 'queued';

export const standing = (run: Run): string | null => {
  if (run.state === 'queued') {
    return 'Queued';
  }

  return null;
};

export const runPath = (slug: string, teamId: string, runId: string): string =>
  `/w/${slug}/team/${teamId}/runs/${encodeURIComponent(runId)}`;

const DAY = 24 * 60 * 60 * 1000;

const midnight = (at: Date): number =>
  new Date(at.getFullYear(), at.getMonth(), at.getDate()).getTime();

export const aged = (at: string): string => {
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

export const RUN_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'awaiting-review', label: 'Awaiting Review' },
] as const;

export type RunFilter = (typeof RUN_FILTERS)[number]['id'];

export const FALLBACK_RUN_FILTER: RunFilter = 'all';

export const asRunFilter = (raw: string): RunFilter =>
  RUN_FILTERS.some((filter) => filter.id === raw)
    ? (raw as RunFilter)
    : FALLBACK_RUN_FILTER;

export const inRunFilter = (
  filter: RunFilter,
  run: Pick<TeamRun, 'review'>,
): boolean => filter === 'all' || run.review?.state === 'owed';
