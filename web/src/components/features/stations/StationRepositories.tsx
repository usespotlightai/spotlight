import { GitBranch } from 'lucide-react';

type StationRepositoriesProps = {
  repositories: readonly string[];
};

/**
 * The repositories a run on this line works in. They belong to the line, not
 * the station, but every run at every station is given all of them, so they
 * are shown here as read-only. They are set in the line's configuration.
 */
export function StationRepositories({
  repositories,
}: StationRepositoriesProps) {
  return (
    <section className="flex flex-col gap-1">
      <h2 className="px-2 font-medium text-muted-foreground text-xs">
        Repositories
      </h2>

      {repositories.length > 0 ? (
        <div className="flex flex-col">
          {repositories.map((repository) => (
            <div
              key={repository}
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-foreground text-sm"
            >
              <GitBranch
                className="size-3.5 shrink-0 text-muted-foreground"
                aria-hidden
              />
              <span className="truncate">{repository}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="px-2 text-muted-foreground text-xs leading-5">
          None yet. Add them to this line’s configuration.
        </p>
      )}
    </section>
  );
}
