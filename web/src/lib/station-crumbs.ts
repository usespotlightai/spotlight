import type { BreadcrumbSegment } from '@/components/shell/layout/Breadcrumbs';
import {
  formatCandidate,
  type Replay,
  type ReplayedStation,
  type ReplaySet,
  replayPath,
  replaySetPath,
  replaysAnchorPath,
} from '@/lib/replay';
import { REPLAY_SET_TITLE } from '@/lib/replay-words';
import { searchesAnchorPath, searchLabel, searchPath } from '@/lib/search';

const setCrumb = (
  at: ReplayedStation,
  set: ReplaySet | undefined,
): BreadcrumbSegment => ({
  label: REPLAY_SET_TITLE,
  to: set ? replaySetPath(at, set.id) : replaysAnchorPath(at),
});

export const setCrumbs = (
  at: ReplayedStation | null,
  set: ReplaySet | undefined,
): BreadcrumbSegment[] => (at && set ? [setCrumb(at, set)] : []);

export const replayCrumbs = (
  at: ReplayedStation | null,
  set: ReplaySet | undefined,
  replay: Replay | undefined,
): BreadcrumbSegment[] => {
  if (!at) {
    return [];
  }

  return [
    setCrumb(at, set),
    ...(replay
      ? [
          {
            label: formatCandidate(replay.candidate),
            to: replayPath(at, replay.id),
          },
        ]
      : []),
  ];
};

export const searchCrumbs = (
  at: ReplayedStation | null,
  search: { readonly id: string } | undefined,
  number: number | null,
): BreadcrumbSegment[] =>
  at && search
    ? [
        { label: 'Searches', to: searchesAnchorPath(at) },
        { label: searchLabel(number), to: searchPath(at, search.id) },
      ]
    : [];
