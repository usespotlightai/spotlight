import { MenuPicker, type PickerOption } from '@/components/shared/MenuPicker';
import type { StationNames } from '@/lib/insights';
import {
  type AgentConfigsNarrowed,
  asOutcome,
  asSize,
  formatSize,
  OUTCOME_MEASURES,
  type OutcomeMeasure,
  RUN_SIZES,
  type SizeBound,
  sizeHintOf,
} from '@/lib/insights-changes';

const ALL = 'all';

type AgentConfigFiltersProps = {
  narrowed: AgentConfigsNarrowed;
  measure: OutcomeMeasure;
  judged: boolean;
  names: StationNames;
  sizes: readonly SizeBound[];
  onNarrow: (narrowed: AgentConfigsNarrowed) => void;
  onMeasure: (measure: OutcomeMeasure) => void;
};

const picked = (options: readonly PickerOption[], value: string) =>
  options.find((each) => each.id === value) ?? options[0];

export function AgentConfigFilters({
  narrowed,
  measure,
  judged,
  names,
  sizes,
  onNarrow,
  onMeasure,
}: AgentConfigFiltersProps) {
  const measures = OUTCOME_MEASURES.filter(
    (each) => each.id !== 'judge' || judged,
  ).map((each) => ({ id: each.id, label: each.label }));
  const stations = [
    { id: ALL, label: 'All stations' },
    ...[...names.values()]
      .filter((station) => station.kind === 'work')
      .map((station) => ({
        id: station.stationId,
        label: station.stationName,
      })),
  ];
  const sizeOptions = [
    { id: ALL, label: 'All sizes' },
    ...RUN_SIZES.map((size) => {
      const bound = sizes.find((each) => each.size === size);

      return {
        id: size,
        label: formatSize(size),
        ...(bound ? { hint: sizeHintOf(bound) } : {}),
      };
    }),
  ];
  const station = narrowed.stationId ?? ALL;
  const size = narrowed.size ?? ALL;
  const narrowedAny = narrowed.stationId !== null || narrowed.size !== null;

  return (
    <div
      data-slot="agent-config-filters"
      className="flex flex-wrap items-center gap-2"
    >
      <MenuPicker
        label="Measure"
        value={measure}
        options={measures}
        selected={picked(measures, measure)}
        onChange={(next) => onMeasure(asOutcome(next))}
      />
      <MenuPicker
        label="Station"
        value={station}
        options={stations}
        selected={picked(stations, station)}
        onChange={(next) =>
          onNarrow({ ...narrowed, stationId: next === ALL ? null : next })
        }
      />
      <MenuPicker
        label="Task size"
        value={size}
        options={sizeOptions}
        selected={picked(sizeOptions, size)}
        onChange={(next) =>
          onNarrow({ ...narrowed, size: next === ALL ? null : asSize(next) })
        }
      />
      {narrowedAny && (
        <button
          type="button"
          onClick={() => onNarrow({ stationId: null, size: null })}
          className="rounded-sm px-1 text-muted-foreground text-sm outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          Clear
        </button>
      )}
    </div>
  );
}
