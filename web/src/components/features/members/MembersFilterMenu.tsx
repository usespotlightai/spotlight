import { useSearchParams } from 'react-router';
import { FilterMenu } from '@/components/shared/filter/FilterMenu';
import { FilterRow } from '@/components/shared/filter/FilterRow';
import { ChoiceSelect } from '@/components/shared/form/ChoiceSelect';
import { MEMBER_SHOWS, SHOW_PARAM, showOf } from '@/lib/members';

export function MembersFilterMenu() {
  const [params, setParams] = useSearchParams();
  const show = showOf(params);

  const change = (next: string | null) =>
    setParams(next ? { [SHOW_PARAM]: next } : {}, { replace: true });

  return (
    <FilterMenu
      label="Filter members"
      compact
      triggerSize="regular"
      applied={show ? 1 : 0}
      onClear={() => change(null)}
    >
      <FilterRow compact label="Show">
        <ChoiceSelect
          compact
          label="Show"
          choices={MEMBER_SHOWS}
          value={show}
          placeholder="Everyone"
          className="w-36"
          onChange={change}
        />
      </FilterRow>
    </FilterMenu>
  );
}
