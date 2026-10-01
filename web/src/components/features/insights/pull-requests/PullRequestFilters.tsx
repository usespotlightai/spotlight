import { X } from 'lucide-react';
import { ChoiceSelect } from '@/components/shared/form/ChoiceSelect';
import { Pill } from '@/components/shared/Pill';
import {
  authorShown,
  PULL_REQUEST_AUTHORS,
  PULL_REQUEST_STATES,
  PULL_REQUEST_TYPES,
  type PullRequestFilter,
  type PullRequestFilterKey,
  pullRequestFilterLabel,
  pullRequestFilterValueShown,
  pullRequestsNarrowedBy,
  stateShown,
  typeShown,
} from '@/lib/insights-pull-requests';
import { dayShown } from '@/lib/judge';

const PICKED: readonly PullRequestFilterKey[] = [
  'repository',
  'author',
  'type',
  'state',
];

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

  return (
    <fieldset
      aria-label="Narrow the pull requests"
      className="m-0 flex flex-wrap items-center gap-2 border-0 p-0"
    >
      {oneRepository && (
        <ChoiceSelect
          label="Repository"
          choices={repositories.map((repository) => ({
            value: repository,
            label: repository,
          }))}
          value={filter.repository ?? null}
          placeholder="Every repository"
          onChange={(repository) => change('repository', repository)}
        />
      )}
      <ChoiceSelect
        label="Written by"
        choices={PULL_REQUEST_AUTHORS.map((author) => ({
          value: author,
          label: authorShown(author),
        }))}
        value={filter.author ?? null}
        placeholder="Anyone"
        onChange={(author) => change('author', author)}
      />
      <ChoiceSelect
        label="Type"
        choices={PULL_REQUEST_TYPES.map((type) => ({
          value: type,
          label: typeShown(type),
        }))}
        value={filter.type ?? null}
        placeholder="Every type"
        onChange={(type) => change('type', type)}
      />
      <ChoiceSelect
        label="State"
        choices={PULL_REQUEST_STATES.map((state) => ({
          value: state,
          label: stateShown(state),
        }))}
        value={filter.state ?? null}
        placeholder="Every state"
        onChange={(state) => change('state', state)}
      />

      {others.map((key) => (
        <Pill key={key} className="h-8 text-foreground">
          <span className="text-muted-foreground">
            {pullRequestFilterLabel(key)}
          </span>
          {key === 'week'
            ? dayShown(filter.week ?? '')
            : pullRequestFilterValueShown(key, filter[key] ?? '')}
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
    </fieldset>
  );
}
