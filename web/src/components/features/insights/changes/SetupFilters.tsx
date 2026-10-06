import { FilterMenu } from '@/components/shared/filter/FilterMenu';
import { FilterRow } from '@/components/shared/filter/FilterRow';
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

const CONTROL = 'h-7 w-44 rounded-lg text-sm';

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
  const applied = [
    measure !== DEFAULT_OUTCOME,
    narrowed.stationId !== null,
    narrowed.size !== null,
  ].filter(Boolean).length;

  return (
    <FilterMenu
      label="Filter the setups"
      applied={applied}
      onClear={() => {
        onMeasure(DEFAULT_OUTCOME);
        onNarrow({ stationId: null, size: null });
      }}
    >
      <FilterRow label="Outcome">
        <ChoiceSelect
          label="Outcome"
          choices={OUTCOME_MEASURES.filter(
            (each) =>
              each.id !== DEFAULT_OUTCOME && (each.id !== 'judge' || judged),
          ).map((each) => ({ value: each.id, label: each.label }))}
          value={measure === DEFAULT_OUTCOME ? null : measure}
          placeholder={outcomeLabel(DEFAULT_OUTCOME)}
          className={CONTROL}
          onChange={(chosen) =>
            onMeasure(chosen ? asOutcome(chosen) : DEFAULT_OUTCOME)
          }
        />
      </FilterRow>

      <FilterRow label="Station">
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
          className={CONTROL}
          onChange={(stationId) => onNarrow({ ...narrowed, stationId })}
        />
      </FilterRow>

      <FilterRow label="Task size">
        <ChoiceSelect
          label="Task size"
          choices={RUN_SIZES.map((size) => ({
            value: size,
            label: sizeShown(size),
          }))}
          value={narrowed.size}
          placeholder="Every size"
          className={CONTROL}
          onChange={(size) =>
            onNarrow({ ...narrowed, size: size ? asSize(size) : null })
          }
        />
      </FilterRow>
    </FilterMenu>
  );
}
