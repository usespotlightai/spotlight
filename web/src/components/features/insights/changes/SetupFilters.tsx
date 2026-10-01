import { ChoiceSelect } from '@/components/shared/form/ChoiceSelect';
import type { SetupsNarrowed } from '@/hooks/api/useInsightsSetups';
import type { StationNames } from '@/lib/insights';
import {
  asOutcome,
  asSize,
  DEFAULT_OUTCOME,
  OUTCOME_MEASURES,
  type OutcomeMeasure,
  outcomeLabel,
  RUN_SIZES,
  sizeShown,
} from '@/lib/insights-changes';

type SetupFiltersProps = {
  narrowed: SetupsNarrowed;
  measure: OutcomeMeasure;
  judged: boolean;
  names: StationNames;
  onNarrow: (narrowed: SetupsNarrowed) => void;
  onMeasure: (measure: OutcomeMeasure) => void;
};

export function SetupFilters({
  narrowed,
  measure,
  judged,
  names,
  onNarrow,
  onMeasure,
}: SetupFiltersProps) {
  return (
    <fieldset
      aria-label="Narrow the setups"
      className="m-0 flex flex-wrap items-center gap-2 border-0 p-0"
    >
      <ChoiceSelect
        label="Outcome"
        choices={OUTCOME_MEASURES.filter(
          (each) =>
            each.id !== DEFAULT_OUTCOME && (each.id !== 'judge' || judged),
        ).map((each) => ({ value: each.id, label: each.label }))}
        value={measure === DEFAULT_OUTCOME ? null : measure}
        placeholder={outcomeLabel(DEFAULT_OUTCOME)}
        onChange={(chosen) =>
          onMeasure(chosen ? asOutcome(chosen) : DEFAULT_OUTCOME)
        }
      />
      <ChoiceSelect
        label="Station"
        choices={[...names.values()]
          .filter((station) => station.kind === 'work')
          .map((station) => ({
            value: station.stationId,
            label: station.stationName,
          }))}
        value={narrowed.stationId}
        placeholder="Every station"
        onChange={(stationId) => onNarrow({ ...narrowed, stationId })}
      />
      <ChoiceSelect
        label="Task size"
        choices={RUN_SIZES.map((size) => ({
          value: size,
          label: sizeShown(size),
        }))}
        value={narrowed.size}
        placeholder="Every size"
        onChange={(size) =>
          onNarrow({ ...narrowed, size: size ? asSize(size) : null })
        }
      />
    </fieldset>
  );
}
