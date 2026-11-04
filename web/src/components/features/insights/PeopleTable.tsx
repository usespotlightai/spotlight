import { InsightsLink } from '@/components/features/insights/InsightsLink';
import { NestedCell } from '@/components/shared/nested-table/NestedCell';
import { NestedTable } from '@/components/shared/nested-table/NestedTable';
import {
  EDGE_INDENT,
  LEAD_CELL,
  ROW_DIVIDER,
  TABLE_ROW,
} from '@/components/shared/nested-table/nested-rows';
import { WithTooltip } from '@/components/shared/WithTooltip';
import {
  dayOf,
  formatCount,
  type InsightsPeople,
  PEOPLE_HEADINGS,
} from '@/lib/insights';
import { formatDay } from '@/lib/judge';
import { since } from '@/lib/since';
import { cn } from '@/lib/utils';

type PersonUse = InsightsPeople['adoption']['people'][number];

export function PeopleTable({ people }: { people: readonly PersonUse[] }) {
  return (
    <NestedTable
      label="What each person did"
      headings={PEOPLE_HEADINGS}
      compact
    >
      {people.map((person) => (
        <li
          key={person.personId}
          data-slot="person-use"
          className={cn(TABLE_ROW, ROW_DIVIDER)}
        >
          <span className={cn(LEAD_CELL, EDGE_INDENT)}>
            <WithTooltip
              tooltip={`First seen ${formatDay(dayOf(person.firstSeenAt))}`}
            >
              <InsightsLink
                tab="traces"
                filter={{ personId: person.personId }}
                className="truncate text-foreground"
              >
                {person.name ?? 'A former member'}
              </InsightsLink>
            </WithTooltip>
            {person.isNew && (
              <span className="shrink-0 rounded-full bg-muted px-1.5 text-muted-foreground text-xs">
                New
              </span>
            )}
          </span>
          <NestedCell heading="Actions">
            <span className="text-foreground">
              {formatCount(person.actions)}
            </span>
          </NestedCell>
          <NestedCell heading="Tasks opened">
            <span className="text-foreground">
              {formatCount(person.tasksOpened)}
            </span>
          </NestedCell>
          <NestedCell heading="Chats">
            <span className="text-foreground">{formatCount(person.chats)}</span>
          </NestedCell>
          <NestedCell heading="Last active">
            {since(person.lastActiveAt)}
          </NestedCell>
        </li>
      ))}
    </NestedTable>
  );
}
