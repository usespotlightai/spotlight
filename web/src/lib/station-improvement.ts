import type { StationImprovementResponseDto } from '@/lib/api';
import { type ReplayedStation, replaySetPath } from '@/lib/replay';
import { searchesPath, searchPath } from '@/lib/search';
import {
  formatSkip,
  NO_SEARCHES_YET,
  type SearchSkip,
} from '@/lib/search-words';
import { since } from '@/lib/since';
import type { TooltipNote, TooltipRow } from '@/lib/tooltip-note';
import { startedOn } from '@/lib/trace-list';

export type StationImprovement = StationImprovementResponseDto;

export type ImprovementStatus = StationImprovement['status'];

type SkipReason = SearchSkip['reason'];

const TRANSIENT_SKIP_REASONS = [
  'cooldown',
  'pull-request-open',
  'set-too-small',
  'no-fresh-held-out',
  'monthly-ceiling',
  'no-headroom',
] as const satisfies readonly SkipReason[];

export const isTransientSkip = (reason: SkipReason): boolean =>
  (TRANSIENT_SKIP_REASONS as readonly SkipReason[]).includes(reason);

type ImprovementLink =
  | { readonly kind: 'page'; readonly to: string }
  | { readonly kind: 'external'; readonly href: string };

export type ImprovementFact = {
  readonly label: string;
  readonly link: ImprovementLink | null;
};

const OPENING_PULL_REQUEST = 'Opening a pull request';

const LABELS: Record<ImprovementStatus, string> = {
  searching: 'Searching',
  picking: 'Choosing a config',
  'pull-request-open': 'Pull request open',
  improved: 'Improved',
  'not-improving': 'Not improving',
  waiting: 'Waiting for next check',
  off: 'Not searching',
  'not-started': 'No runs yet',
};

const labelOf = (improvement: StationImprovement): string => {
  if (
    (improvement.status === 'picking' && improvement.pickPhase === 'opening') ||
    (improvement.status === 'pull-request-open' && !improvement.pullRequestUrl)
  ) {
    return OPENING_PULL_REQUEST;
  }

  return LABELS[improvement.status];
};

const page = (to: string): ImprovementLink => ({ kind: 'page', to });

const linkOf = (
  at: ReplayedStation,
  improvement: StationImprovement,
): ImprovementLink | null => {
  const { status, searchId, pullRequestUrl, setId } = improvement;

  if ((status === 'searching' || status === 'picking') && searchId) {
    return page(searchPath(at, searchId));
  }
  if (
    (status === 'pull-request-open' || status === 'improved') &&
    pullRequestUrl
  ) {
    return { kind: 'external', href: pullRequestUrl };
  }
  if ((status === 'not-improving' || status === 'waiting') && setId) {
    return page(replaySetPath(at, setId));
  }

  return null;
};

export const improvementFact = (
  at: ReplayedStation,
  improvement: StationImprovement,
): ImprovementFact => ({
  label: labelOf(improvement),
  link: linkOf(at, improvement),
});

const BODIES: Record<
  Exclude<ImprovementStatus, 'not-improving' | 'pull-request-open' | 'picking'>,
  string
> = {
  searching: 'Spotlight searches for a better config of the station.',
  improved: 'A merged config pull request improved the station.',
  waiting: NO_SEARCHES_YET,
  off: 'The search policy of the station is off. Spotlight does not search the station.',
  'not-started':
    'Spotlight keeps a replay set from the runs of the station. The set has no runs yet.',
};

const bodyOf = (improvement: StationImprovement): string => {
  switch (improvement.status) {
    case 'not-improving':
      return improvement.pullRequestFailure
        ? 'Spotlight could not open the config pull request of the station.'
        : formatSkip(improvement.skip, improvement.minimumTasks);
    case 'pull-request-open':
      return improvement.pullRequestUrl
        ? 'Spotlight opened a config pull request. Please review it on GitHub.'
        : 'Spotlight opens a config pull request on GitHub.';
    case 'picking':
      return improvement.pickPhase === 'opening'
        ? 'Spotlight picked a config of the last search. It opens a pull request for it.'
        : 'The last search finished. Spotlight picks its best config.';
    default:
      return BODIES[improvement.status];
  }
};

const formatNextCheck = (checkAfter: string, now = Date.now()): string =>
  Date.parse(checkAfter) <= now ? 'due' : startedOn(checkAfter);

const rowsOf = (improvement: StationImprovement): TooltipRow[] => {
  const rows: TooltipRow[] = [];

  if (improvement.pullRequestFailure) {
    rows.push(['Reason', improvement.pullRequestFailure.message]);
  }
  if (improvement.improvedAt) {
    rows.push(['Improved', since(improvement.improvedAt)]);
  }
  if (improvement.lastStartedAt) {
    rows.push(['Last search', since(improvement.lastStartedAt)]);
  }
  if (improvement.checkAfter && improvement.status !== 'off') {
    rows.push(['Next check', formatNextCheck(improvement.checkAfter)]);
  }

  return rows;
};

export const improvementNote = (
  improvement: StationImprovement,
): TooltipNote => ({
  body: bodyOf(improvement),
  rows: rowsOf(improvement),
});

export const improvementLinks = (
  at: ReplayedStation,
  improvement: StationImprovement,
): { readonly label: string; readonly to: string }[] => {
  const { setId } = improvement;

  if (!setId) {
    return [];
  }

  const set = replaySetPath(at, setId);
  const shown = linkOf(at, improvement);

  return [
    ...(shown?.kind === 'page' && shown.to === set
      ? []
      : [{ label: 'Replay set', to: set }]),
    { label: 'Searches', to: searchesPath(at, setId) },
  ];
};

export const improving = (improvement: StationImprovement): boolean =>
  improvement.status === 'searching' ||
  improvement.status === 'picking' ||
  improvement.status === 'pull-request-open';
