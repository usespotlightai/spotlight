import { InsightsLink } from '@/components/features/insights/InsightsLink';
import { NestedCell } from '@/components/shared/nested-table/NestedCell';
import { NestedTable } from '@/components/shared/nested-table/NestedTable';
import {
  EDGE_INDENT,
  ROW_DIVIDER,
} from '@/components/shared/nested-table/nested-rows';
import { countShown, dayOf, type InsightsPeople } from '@/lib/insights';
import { dayShown } from '@/lib/judge';
import { SPREAD } from '@/lib/nested-table';
import { since } from '@/lib/since';
import { cn } from '@/lib/utils';

type PersonUse = InsightsPeople['adoption']['people'][number];

const HEADINGS = [
  { label: 'Person', indent: 'edge' as const, size: 'minmax(10rem,2fr)' },
  { label: 'Tasks opened', numeric: true, size: SPREAD },
  { label: 'Acts', numeric: true, size: SPREAD },
  { label: 'Chats', numeric: true, size: SPREAD },
  { label: 'First seen', numeric: true, size: SPREAD },
  { label: 'Last active', numeric: true, size: SPREAD },
];

export function PeopleTable({ people }: { people: readonly PersonUse[] }) {
  return (
    <NestedTable label="What each person did" headings={HEADINGS}>
      {people.map((person) => (
        <li
          key={person.personId}
          data-slot="person-use"
          className={cn(
            'col-span-full grid grid-cols-2 items-center gap-x-6 gap-y-2 py-2 pr-2 text-xs @4xl:grid-cols-subgrid',
            ROW_DIVIDER,
          )}
        >
          <span
            className={cn(
              'col-span-full flex min-w-0 items-center gap-2 @4xl:col-span-1',
              EDGE_INDENT,
            )}
          >
            <InsightsLink
              tab="runs"
              filter={{ personId: person.personId }}
              className="truncate font-medium text-foreground"
            >
              {person.name ?? 'A former member'}
            </InsightsLink>
            {person.isNew && (
              <span className="shrink-0 rounded-full bg-muted px-1.5 text-[0.7rem] text-muted-foreground">
                New
              </span>
            )}
          </span>
          <NestedCell heading="Tasks opened" strong>
            {countShown(person.tasksOpened)}
          </NestedCell>
          <NestedCell heading="Acts">{countShown(person.acts)}</NestedCell>
          <NestedCell heading="Chats">{countShown(person.chats)}</NestedCell>
          <NestedCell heading="First seen">
            {dayShown(dayOf(person.firstSeenAt))}
          </NestedCell>
          <NestedCell heading="Last active">
            {since(person.lastActiveAt)}
          </NestedCell>
        </li>
      ))}
    </NestedTable>
  );
}
