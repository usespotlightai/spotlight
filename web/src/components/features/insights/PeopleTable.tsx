import { InsightsLink } from '@/components/features/insights/InsightsLink';
import {
  type InsightsColumn,
  InsightsTable,
} from '@/components/features/insights/InsightsTable';
import { countShown, dayOf, type InsightsPeople } from '@/lib/insights';
import { dayShown } from '@/lib/judge';
import { since } from '@/lib/since';

type PersonUse = InsightsPeople['adoption']['people'][number];

const COLUMNS: InsightsColumn<PersonUse>[] = [
  {
    id: 'person',
    header: 'Person',
    cell: (person) => (
      <span className="flex items-center gap-2">
        <InsightsLink tab="runs" filter={{ personId: person.personId }}>
          {person.name ?? 'A former member'}
        </InsightsLink>
        {person.isNew && (
          <span className="rounded-full bg-muted px-1.5 text-[0.7rem] text-muted-foreground">
            New
          </span>
        )}
      </span>
    ),
  },
  {
    id: 'tasks',
    header: 'Tasks opened',
    numeric: true,
    cell: (person) => countShown(person.tasksOpened),
  },
  {
    id: 'acts',
    header: 'Acts',
    numeric: true,
    cell: (person) => countShown(person.acts),
  },
  {
    id: 'chats',
    header: 'Chats',
    numeric: true,
    cell: (person) => countShown(person.chats),
  },
  {
    id: 'first',
    header: 'First seen',
    numeric: true,
    cell: (person) => dayShown(dayOf(person.firstSeenAt)),
  },
  {
    id: 'last',
    header: 'Last active',
    numeric: true,
    cell: (person) => since(person.lastActiveAt),
  },
];

export function PeopleTable({ people }: { people: readonly PersonUse[] }) {
  return (
    <InsightsTable
      label="What each person did"
      columns={COLUMNS}
      rows={people}
      rowKey={(person) => person.personId}
    />
  );
}
