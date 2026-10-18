import { FilterMenu } from '@/components/shared/filter/FilterMenu';
import { FilterRow } from '@/components/shared/filter/FilterRow';
import { ChoiceSelect } from '@/components/shared/form/ChoiceSelect';
import type { StationNames } from '@/lib/insights';
import type { AgentConfigsNarrowed } from '@/lib/insights-changes';
import {
  asOutcome,
  asSize,
  DEFAULT_OUTCOME,
  formatSize,
  OUTCOME_MEASURES,
  type OutcomeMeasure,
  outcomeLabel,
  RUN_SIZES,
} from '@/lib/insights-changes';

const CONTROL = 'w-32';

type AgentConfigFiltersProps = {
  narrowed: AgentConfigsNarrowed;
  measure: OutcomeMeasure;
  judged: boolean;
  names: StationNames;
  onNarrow: (narrowed: AgentConfigsNarrowed) => void;
  onMeasure: (measure: OutcomeMeasure) => void;
};

export function AgentConfigFilters({
  narrowed,
  measure,
  judged,
  names,
  onNarrow,
  onMeasure,
}: AgentConfigFiltersProps) {
  const applied = [
    measure !== DEFAULT_OUTCOME,
    narrowed.stationId !== null,
    narrowed.size !== null,
  ].filter(Boolean).length;

  return (
    <FilterMenu
      label="Filter the agent configs"
      compact
      applied={applied}
      onClear={() => {
        onMeasure(DEFAULT_OUTCOME);
        onNarrow({ stationId: null, size: null });
      }}
    >
      <FilterRow compact label="Outcome">
        <ChoiceSelect
          compact
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

      <FilterRow compact label="Station">
        <ChoiceSelect
          compact
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

      <FilterRow compact label="Task size">
        <ChoiceSelect
          compact
          label="Task size"
          choices={RUN_SIZES.map((size) => ({
            value: size,
            label: formatSize(size),
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
