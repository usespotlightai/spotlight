import { useSearchParams } from 'react-router';
import { FilterMenu } from '@/components/shared/filter/FilterMenu';
import { FilterRow } from '@/components/shared/filter/FilterRow';
import { ChoiceSelect } from '@/components/shared/form/ChoiceSelect';
import { useLines } from '@/hooks/api/useLines';
import { useTeamMemories } from '@/hooks/api/useTeamMemories';
import {
  filterOf,
  KIND_OPTIONS,
  type MemoryFilter,
  memoryPathsOf,
  narrowedBy,
  paramsOf,
  unnarrowed,
} from '@/lib/memory';

const CONTROL = 'w-32';

type MemoryFilterMenuProps = {
  teamId: string;
};

export function MemoryFilterMenu({ teamId }: MemoryFilterMenuProps) {
  const [params, setParams] = useSearchParams();
  const lines = useLines(teamId).data ?? [];

  const filter = filterOf(params);
  const listed = useTeamMemories(teamId, { ...filter, path: null });
  const paths = memoryPathsOf(listed.data ?? [], filter.path);
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
      compact
      button="regular"
      applied={narrowedBy(filter)}
      onClear={() => show(unnarrowed(filter))}
    >
      <FilterRow compact label="Kind">
        <ChoiceSelect
          compact
          label="Kind"
          choices={KIND_OPTIONS}
          value={filter.kind}
          placeholder="Every kind"
          className={CONTROL}
          onChange={(kind) => change({ kind })}
        />
      </FilterRow>

      <FilterRow compact label="Line">
        <ChoiceSelect
          compact
          label="Line"
          choices={lines.map((each) => ({ value: each.id, label: each.name }))}
          value={filter.lineId}
          placeholder="Every line"
          className={CONTROL}
          onChange={(lineId) => change({ lineId, stationId: null })}
        />
      </FilterRow>

      <FilterRow compact label="Station">
        <ChoiceSelect
          compact
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

      <FilterRow compact label="Repository">
        <ChoiceSelect
          compact
          label="Repository"
          choices={repositories.map((each) => ({ value: each, label: each }))}
          value={filter.repository}
          placeholder="Every repository"
          className={CONTROL}
          onChange={(repository) => change({ repository })}
        />
      </FilterRow>

      <FilterRow compact label="Path">
        <ChoiceSelect
          compact
          label="Path"
          choices={paths.map((each) => ({ value: each, label: each }))}
          value={filter.path}
          placeholder="Every path"
          disabled={paths.length === 0}
          className={CONTROL}
          onChange={(path) => change({ path })}
        />
      </FilterRow>
    </FilterMenu>
  );
}
