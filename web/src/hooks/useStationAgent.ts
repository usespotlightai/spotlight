import { useHarnesses } from '@/hooks/api/useHarnesses';
import { capitalized } from '@/lib/agent-choice';
import { nonEmpty } from '@/lib/non-empty';

type StationAgent = {
  harness: string | null | undefined;
  model: string | null | undefined;
  effort: string | null | undefined;
};

export type EffortLevel = {
  readonly name: string;
  readonly at: number;
  readonly levels: readonly string[];
};

export type StationAgentNames = {
  readonly harnessId: string | undefined;
  readonly harness: string;
  readonly model: string;
  readonly effort: EffortLevel | null;
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

  const { models, efforts } = offered;

  return {
    harnessId: offered.id,
    harness: offered.name,
    model: models.find((each) => each.id === model)?.name ?? 'Default model',
    effort:
      efforts.length > 0
        ? {
            name: nonEmpty(effort) ? capitalized(effort) : 'Default',
            at: nonEmpty(effort) ? efforts.indexOf(effort) + 1 : 0,
            levels: efforts.map(capitalized),
          }
        : null,
  };
}
