import { ChoiceSelect } from '@/components/shared/form/ChoiceSelect';
import { FieldInput } from '@/components/shared/form/FieldInput';
import { ViewPills } from '@/components/shared/ViewPills';
import type { LineResponseDto } from '@/lib/api';
import { KIND_OPTIONS, type MemoryFilter, STANDING_VIEWS } from '@/lib/memory';

type MemoryFiltersProps = {
  filter: MemoryFilter;
  lines: readonly LineResponseDto[];
  onChange: (filter: MemoryFilter) => void;
};

export function MemoryFilters({ filter, lines, onChange }: MemoryFiltersProps) {
  const line = lines.find((each) => each.id === filter.lineId);
  const repositories = [
    ...new Set((line ? [line] : lines).flatMap((each) => each.repositories)),
  ];
  const change = (part: Partial<MemoryFilter>) =>
    onChange({ ...filter, ...part });

  return (
    <div className="flex flex-col gap-1 pb-2">
      <ViewPills
        views={STANDING_VIEWS}
        current={filter.standing}
        onChange={(standing) => change({ standing })}
      />

      <fieldset
        aria-label="Narrow the memories"
        className="m-0 flex flex-wrap items-center gap-2 border-0 p-0 px-3"
      >
        <ChoiceSelect
          label="Kind"
          choices={KIND_OPTIONS}
          value={filter.kind}
          placeholder="Every kind"
          onChange={(kind) => change({ kind })}
        />
        <ChoiceSelect
          label="Line"
          choices={lines.map((each) => ({ value: each.id, label: each.name }))}
          value={filter.lineId}
          placeholder="Every line"
          onChange={(lineId) => change({ lineId, stationId: null })}
        />
        <ChoiceSelect
          label="Station"
          choices={(line?.stations ?? [])
            .filter((each) => each.kind === 'work')
            .map((each) => ({ value: each.id, label: each.name }))}
          value={filter.stationId}
          placeholder="Every station"
          disabled={!line}
          onChange={(stationId) => change({ stationId })}
        />
        <ChoiceSelect
          label="Repository"
          choices={repositories.map((each) => ({ value: each, label: each }))}
          value={filter.repository}
          placeholder="Every repository"
          onChange={(repository) => change({ repository })}
        />
        <FieldInput
          value={filter.path ?? ''}
          onChange={(event) => change({ path: event.target.value || null })}
          placeholder="Path"
          aria-label="Path"
          className="h-8 w-48 rounded-full border border-border bg-card px-3 text-xs"
        />
      </fieldset>
    </div>
  );
}
