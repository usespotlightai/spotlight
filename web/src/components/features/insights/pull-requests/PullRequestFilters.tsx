import { X } from 'lucide-react';
import { FilterMenu } from '@/components/shared/filter/FilterMenu';
import { FilterRow } from '@/components/shared/filter/FilterRow';
import { ChoiceSelect } from '@/components/shared/form/ChoiceSelect';
import { Pill } from '@/components/shared/Pill';
import {
  formatAuthor,
  formatPullRequestFilterValue,
  formatState,
  formatType,
  PULL_REQUEST_AUTHORS,
  PULL_REQUEST_STATES,
  PULL_REQUEST_TYPES,
  type PullRequestFilter,
  type PullRequestFilterKey,
  pullRequestFilterLabel,
  pullRequestsNarrowedBy,
} from '@/lib/insights-pull-requests';
import { formatDay } from '@/lib/judge';

const PICKED: readonly PullRequestFilterKey[] = [
  'repository',
  'author',
  'type',
  'state',
];

const CONTROL = 'w-32';

type PullRequestFiltersProps = {
  filter: PullRequestFilter;
  repositories: readonly string[];
  onChange: (filter: PullRequestFilter) => void;
};

export function PullRequestFilters({
  filter,
  repositories,
  onChange,
}: PullRequestFiltersProps) {
  const change = (key: PullRequestFilterKey, value: string | null) =>
    onChange({ ...filter, [key]: value ?? undefined });

  const oneRepository =
    !filter.repository || repositories.includes(filter.repository);
  const others = pullRequestsNarrowedBy(filter).filter(
    (key) => !PICKED.includes(key) || (key === 'repository' && !oneRepository),
  );

  const picked = PICKED.filter(
    (key) => filter[key] && (key !== 'repository' || oneRepository),
  );
  const pickedKeys = new Set(picked);

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {others.map((key) => (
        <Pill key={key} className="h-6 text-[0.7rem] text-foreground">
          <span className="text-muted-foreground">
            {pullRequestFilterLabel(key)}
          </span>
          {key === 'week'
            ? formatDay(filter.week ?? '')
            : formatPullRequestFilterValue(key, filter[key] ?? '')}
          <button
            type="button"
            aria-label={`Stop narrowing by ${pullRequestFilterLabel(key).toLowerCase()}`}
            onClick={() => change(key, null)}
            className="-mr-1 rounded-full p-0.5 text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            <X aria-hidden className="size-3" />
          </button>
        </Pill>
      ))}

      <FilterMenu
        label="Filter the pull requests"
        compact
        applied={picked.length}
        onClear={() =>
          onChange(
            Object.fromEntries(
              Object.entries(filter).filter(
                ([key]) => !pickedKeys.has(key as PullRequestFilterKey),
              ),
            ),
          )
        }
      >
        {oneRepository && (
          <FilterRow compact label="Repository">
            <ChoiceSelect
              compact
              label="Repository"
              choices={repositories.map((repository) => ({
                value: repository,
                label: repository,
              }))}
              value={filter.repository ?? null}
              placeholder="Every repository"
              className={CONTROL}
              onChange={(repository) => change('repository', repository)}
            />
          </FilterRow>
        )}
        <FilterRow compact label="Written by">
          <ChoiceSelect
            compact
            label="Written by"
            choices={PULL_REQUEST_AUTHORS.map((author) => ({
              value: author,
              label: formatAuthor(author),
            }))}
            value={filter.author ?? null}
            placeholder="Anyone"
            className={CONTROL}
            onChange={(author) => change('author', author)}
          />
        </FilterRow>
        <FilterRow compact label="Type">
          <ChoiceSelect
            compact
            label="Type"
            choices={PULL_REQUEST_TYPES.map((type) => ({
              value: type,
              label: formatType(type),
            }))}
            value={filter.type ?? null}
            placeholder="Every type"
            className={CONTROL}
            onChange={(type) => change('type', type)}
          />
        </FilterRow>
        <FilterRow compact label="State">
          <ChoiceSelect
            compact
            label="State"
            choices={PULL_REQUEST_STATES.map((state) => ({
              value: state,
              label: formatState(state),
            }))}
            value={filter.state ?? null}
            placeholder="Every state"
            className={CONTROL}
            onChange={(state) => change('state', state)}
          />
        </FilterRow>
      </FilterMenu>
    </div>
  );
}
