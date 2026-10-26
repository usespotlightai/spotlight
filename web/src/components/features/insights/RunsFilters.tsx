import { X } from 'lucide-react';
import { ChoiceSelect } from '@/components/shared/form/ChoiceSelect';
import { Pill } from '@/components/shared/Pill';
import type { LineResponseDto } from '@/lib/api';
import {
  filterLabel,
  formatFilterValue,
  formatPerson,
  narrowedBy,
  type PersonName,
  RUN_ENDINGS,
  type RunFilter,
  type RunFilterKey,
  type StationNames,
} from '@/lib/insights';
import { formatDay } from '@/lib/judge';
import { formatEnding } from '@/lib/station-insights';

const PICKED: readonly RunFilterKey[] = ['stationId', 'outcome'];

type RunsFiltersProps = {
  filter: RunFilter;
  names: StationNames;
  lines: readonly LineResponseDto[];
  people: readonly PersonName[];
  onChange: (filter: RunFilter) => void;
};

export function RunsFilters({
  filter,
  names,
  lines,
  people,
  onChange,
}: RunsFiltersProps) {
  const change = (key: RunFilterKey, value: string | null) =>
    onChange({ ...filter, [key]: value ?? undefined });

  const formatValue = (key: RunFilterKey, value: string): string => {
    switch (key) {
      case 'personId':
        return formatPerson(people, value);
      case 'day':
      case 'week':
        return formatDay(value);
      case 'lineId':
        return lines.find((line) => line.id === value)?.name ?? value;
      default:
        return formatFilterValue(key, value);
    }
  };

  const others = narrowedBy(filter).filter((key) => !PICKED.includes(key));

  return (
    <fieldset
      aria-label="Narrow the runs"
      className="m-0 flex flex-wrap items-center gap-2 border-0 p-0"
    >
      <ChoiceSelect
        toolbar
        label="Station"
        choices={[...names.values()]
          .filter((station) => station.kind === 'work')
          .map((station) => ({
            value: station.stationId,
            label: station.stationName,
          }))}
        value={filter.stationId ?? null}
        placeholder="Every station"
        onChange={(stationId) => change('stationId', stationId)}
      />
      <ChoiceSelect
        toolbar
        label="Outcome"
        choices={RUN_ENDINGS.map((ending) => ({
          value: ending,
          label: formatEnding(ending),
        }))}
        value={filter.outcome ?? null}
        placeholder="Every outcome"
        onChange={(outcome) => change('outcome', outcome)}
      />

      {others.map((key) => (
        <Pill
          key={key}
          className="h-7 rounded-md bg-transparent px-2 font-normal text-foreground text-sm"
        >
          <span className="text-muted-foreground">{filterLabel(key)}</span>
          {formatValue(key, filter[key] ?? '')}
          <button
            type="button"
            aria-label={`Stop narrowing by ${filterLabel(key).toLowerCase()}`}
            onClick={() => change(key, null)}
            className="-mr-1 rounded-full p-0.5 text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            <X aria-hidden className="size-3" />
          </button>
        </Pill>
      ))}
    </fieldset>
  );
}
