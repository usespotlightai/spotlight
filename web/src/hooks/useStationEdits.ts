import { useReseeded } from '@/hooks/useReseeded';
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
  const [edits, setEdits] = useReseeded(station?.id, () => asEdits(station));

  return {
    edits,
    change: (patch: Partial<StationEdits>) =>
      setEdits((current) => ({ ...current, ...patch })),
  };
}
