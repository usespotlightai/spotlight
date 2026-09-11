import { useState } from 'react';
import type { Station } from '@/lib/station';

export type StationEdits = {
  readonly name: string;
  readonly color: string;
  readonly description: string;
  readonly harness: string;
  readonly model: string;
  readonly effort: string;
  readonly agentPrompt: string;
};

const asEdits = (station?: Station): StationEdits => ({
  name: station?.name ?? '',
  color: station?.color ?? '',
  description: station?.description ?? '',
  harness: station?.harness ?? '',
  model: station?.model ?? '',
  effort: station?.effort ?? '',
  agentPrompt: station?.agentPrompt ?? '',
});

export function useStationEdits(station: Station | undefined) {
  const [standing, setStanding] = useState(station?.id);
  const [edits, setEdits] = useState(() => asEdits(station));

  if (station && station.id !== standing) {
    setStanding(station.id);
    setEdits(asEdits(station));
  }

  return {
    edits,
    change: (patch: Partial<StationEdits>) =>
      setEdits((current) => ({ ...current, ...patch })),
  };
}
