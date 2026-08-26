import { useState } from 'react';
import type { Station, StationDraft } from '@/lib/station';

const STORAGE_KEY = 'spotlight.station-drafts';

type Drafts = Record<string, Partial<StationDraft>>;

const readStored = (): Drafts => {
  try {
    const saved: unknown = JSON.parse(
      localStorage.getItem(STORAGE_KEY) ?? '{}',
    );
    return typeof saved === 'object' && saved !== null ? (saved as Drafts) : {};
  } catch {
    return {};
  }
};

const remember = (drafts: Drafts) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(drafts));
  } catch {
    // a browser that refuses storage still edits, it just forgets
  }
};

export function useStationDraft(station: Station | undefined) {
  const [drafts, setDrafts] = useState<Drafts>(readStored);

  const draft: StationDraft = {
    name: station?.name ?? '',
    description: '',
    pool: '',
    agentPrompt: '',
    ...(station ? drafts[station.id] : undefined),
  };

  const update = (patch: Partial<StationDraft>) => {
    if (!station) {
      return;
    }

    setDrafts((current) => {
      const next = {
        ...current,
        [station.id]: { ...current[station.id], ...patch },
      };
      remember(next);
      return next;
    });
  };

  return { draft, update };
}
