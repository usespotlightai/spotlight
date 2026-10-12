import type { BreadcrumbSegment } from '@/components/shell/layout/Breadcrumbs';
import {
  candidateShown,
  type Replay,
  type ReplayedStation,
  type ReplaySet,
  replayPath,
  replaySetPath,
  replaysAnchorPath,
} from '@/lib/replay';
import { searchesAnchorPath, searchLabel, searchPath } from '@/lib/search';

const setsCrumb = (at: ReplayedStation): BreadcrumbSegment => ({
  label: 'Replay sets',
  to: replaysAnchorPath(at),
});

export const setCrumbs = (
  at: ReplayedStation | null,
  set: ReplaySet | undefined,
): BreadcrumbSegment[] =>
  at && set
    ? [setsCrumb(at), { label: set.name, to: replaySetPath(at, set.id) }]
    : [];

export const replayCrumbs = (
  at: ReplayedStation | null,
  set: ReplaySet | undefined,
  replay: Replay | undefined,
): BreadcrumbSegment[] => {
  if (!at) {
    return [];
  }

  return [
    setsCrumb(at),
    ...(set ? [{ label: set.name, to: replaySetPath(at, set.id) }] : []),
    ...(replay
      ? [
          {
            label: candidateShown(replay.candidate),
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
