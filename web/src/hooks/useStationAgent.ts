import { useHarnesses } from '@/hooks/api/useHarnesses';

type StationAgent = {
  harness: string | null | undefined;
  model: string | null | undefined;
  effort: string | null | undefined;
};

export type StationAgentNames = {
  readonly harnessId: string | undefined;
  readonly harness: string;
  readonly model: string;
  readonly effort: string | null;
};

export function useStationAgent({
  harness,
  model,
  effort,
}: StationAgent): StationAgentNames | null {
  const { data: harnesses } = useHarnesses();
  const offered = harnesses?.find((each) => each.id === harness);

  if (!offered) {
    return null;
  }

  const models = offered.models ?? [];
  const efforts = offered.efforts ?? [];

  return {
    harnessId: offered.id,
    harness: offered.name,
    model: models.find((each) => each.id === model)?.name ?? 'Default model',
    effort:
      efforts.length > 0
        ? effort
          ? `${effort.charAt(0).toUpperCase()}${effort.slice(1)} effort`
          : 'Default effort'
        : null,
  };
}
