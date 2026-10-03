import { useId } from 'react';
import { useSearchParams } from 'react-router';
import { FilterMenu } from '@/components/shared/filter/FilterMenu';
import { FilterRow } from '@/components/shared/filter/FilterRow';
import { ChoiceSelect } from '@/components/shared/form/ChoiceSelect';
import { FieldInput } from '@/components/shared/form/FieldInput';
import { useLines } from '@/hooks/api/useLines';
import {
  filterOf,
  KIND_OPTIONS,
  type MemoryFilter,
  narrowedBy,
  paramsOf,
  unnarrowed,
} from '@/lib/memory';

const CONTROL = 'h-7 w-44 rounded-lg text-sm';

type MemoryFilterMenuProps = {
  teamId: string;
};

export function MemoryFilterMenu({ teamId }: MemoryFilterMenuProps) {
  const [params, setParams] = useSearchParams();
  const lines = useLines(teamId).data ?? [];
  const pathId = useId();

  const filter = filterOf(params);
  const line = lines.find((each) => each.id === filter.lineId);
  const repositories = [
    ...new Set((line ? [line] : lines).flatMap((each) => each.repositories)),
  ];
  const show = (next: MemoryFilter) =>
    setParams(paramsOf(next), { replace: true });
  const change = (part: Partial<MemoryFilter>) => show({ ...filter, ...part });

  return (
    <FilterMenu
      label="Filter memories"
      applied={narrowedBy(filter)}
      onClear={() => show(unnarrowed(filter))}
    >
      <FilterRow label="Kind">
        <ChoiceSelect
          label="Kind"
          choices={KIND_OPTIONS}
          value={filter.kind}
          placeholder="Every kind"
          className={CONTROL}
          onChange={(kind) => change({ kind })}
        />
      </FilterRow>

      <FilterRow label="Line">
        <ChoiceSelect
          label="Line"
          choices={lines.map((each) => ({ value: each.id, label: each.name }))}
          value={filter.lineId}
          placeholder="Every line"
          className={CONTROL}
          onChange={(lineId) => change({ lineId, stationId: null })}
        />
      </FilterRow>

      <FilterRow label="Station">
        <ChoiceSelect
          label="Station"
          choices={(line?.stations ?? [])
            .filter((each) => each.kind === 'work')
            .map((each) => ({ value: each.id, label: each.name }))}
          value={filter.stationId}
          placeholder="Every station"
          disabled={!line}
          className={CONTROL}
          onChange={(stationId) => change({ stationId })}
        />
      </FilterRow>

      <FilterRow label="Repository">
        <ChoiceSelect
          label="Repository"
          choices={repositories.map((each) => ({ value: each, label: each }))}
          value={filter.repository}
          placeholder="Every repository"
          className={CONTROL}
          onChange={(repository) => change({ repository })}
        />
      </FilterRow>

      <FilterRow label="Path" htmlFor={pathId}>
        <FieldInput
          id={pathId}
          value={filter.path ?? ''}
          onChange={(event) => change({ path: event.target.value || null })}
          placeholder="Any path"
          className={`${CONTROL} border bg-card px-3`}
        />
      </FilterRow>
    </FilterMenu>
  );
}
