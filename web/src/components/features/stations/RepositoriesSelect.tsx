import { ChevronsUpDown, GitBranch } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useRepositories } from '@/hooks/api/useRepositories';
import { cn } from '@/lib/utils';

type RepositoriesSelectProps = {
  slug: string | undefined;
  value: readonly string[];
  onChange: (repositories: string[]) => void;
};

/** The line's repositories, chosen the way a station's harness is. */
export function RepositoriesSelect({
  slug,
  value,
  onChange,
}: RepositoriesSelectProps) {
  const { data: available } = useRepositories(slug);

  // What the workspace offers, plus any the line already works that it does not.
  const names = [
    ...new Set([...(available ?? []).map((each) => each.fullName), ...value]),
  ].sort();

  const toggle = (repository: string, checked: boolean) =>
    onChange(
      checked
        ? [...value, repository]
        : value.filter((each) => each !== repository),
    );

  const label =
    value.length === 0
      ? 'No repositories'
      : value.length === 1
        ? (value[0] as string)
        : `${value.length} repositories`;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Repositories"
        className="flex h-7 w-full items-center gap-2 rounded-md px-2 text-left text-sm outline-none transition-colors hover:bg-accent data-[popup-open]:bg-accent"
      >
        <GitBranch
          className="size-3.5 shrink-0 text-muted-foreground"
          aria-hidden
        />
        <span
          className={cn(
            'truncate',
            value.length > 0 ? 'text-foreground' : 'text-muted-foreground',
          )}
        >
          {label}
        </span>
        <ChevronsUpDown
          className="ml-auto size-3 shrink-0 text-muted-foreground"
          aria-hidden
        />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" sideOffset={6} className="min-w-52">
        {names.length === 0 ? (
          <div className="px-2 py-1.5 text-muted-foreground text-sm">
            No repositories to choose from
          </div>
        ) : (
          names.map((repository) => (
            <DropdownMenuCheckboxItem
              key={repository}
              checked={value.includes(repository)}
              closeOnClick={false}
              onCheckedChange={(checked) =>
                toggle(repository, Boolean(checked))
              }
            >
              <span className="truncate">{repository}</span>
            </DropdownMenuCheckboxItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
