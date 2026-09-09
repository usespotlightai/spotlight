import { HarnessSelect } from '@/components/features/stations/HarnessSelect';
import { RepositoriesSelect } from '@/components/features/stations/RepositoriesSelect';

type StationPropertiesProps = {
  slug: string | undefined;
  /** Absent where nothing runs at this station. */
  harness?: string;
  onHarness?: (harness: string) => void;
  /** Said in place of a harness, where there is nothing to run. */
  note?: string;
  /** The line's repositories, edited here for every station on it. */
  repositories: readonly string[];
  onRepositories: (repositories: string[]) => void;
};

export function StationProperties({
  slug,
  harness,
  onHarness,
  note,
  repositories,
  onRepositories,
}: StationPropertiesProps) {
  return (
    <aside className="sticky top-8 hidden w-56 shrink-0 flex-col gap-4 self-start lg:flex">
      {harness !== undefined && onHarness ? (
        <section className="flex flex-col gap-1">
          <h2 className="px-2 font-medium text-muted-foreground text-xs">
            Worked by
          </h2>

          <HarnessSelect value={harness} onChange={onHarness} />
        </section>
      ) : null}

      {note ? (
        <p className="px-2 text-muted-foreground text-xs leading-5">{note}</p>
      ) : null}

      <section className="flex flex-col gap-1">
        <h2 className="px-2 font-medium text-muted-foreground text-xs">
          Line Repositories
        </h2>

        <RepositoriesSelect
          slug={slug}
          value={repositories}
          onChange={onRepositories}
        />
      </section>
    </aside>
  );
}
