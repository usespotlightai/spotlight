import { ChevronsUpDown, GitBranch } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useRepositories } from '@/hooks/api/useRepositories';
import { cn } from '@/lib/utils';

const NONE = 'none';

type RepositorySelectProps = {
  slug: string | undefined;
  value: string;
  onChange: (repository: string) => void;
};

export function RepositorySelect({
  slug,
  value,
  onChange,
}: RepositorySelectProps) {
  const { data: repositories } = useRepositories(slug);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        type="button"
        aria-label="Repository"
        className="flex h-6 items-center gap-1.5 rounded-full border border-border bg-card px-2 text-left text-xs shadow-control outline-none transition-colors hover:bg-accent data-[popup-open]:bg-accent"
      >
        <GitBranch
          className="size-3 shrink-0 text-muted-foreground"
          aria-hidden
        />
        <span
          className={cn(
            'truncate',
            value ? 'text-foreground' : 'text-muted-foreground',
          )}
        >
          {value || 'No repository'}
        </span>
        <ChevronsUpDown
          className="size-2.5 shrink-0 text-muted-foreground"
          aria-hidden
        />
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="start"
        sideOffset={6}
        className="max-h-72 min-w-64 overflow-y-auto"
      >
        <DropdownMenuRadioGroup
          value={value || NONE}
          onValueChange={(next) =>
            onChange(String(next) === NONE ? '' : String(next))
          }
        >
          <DropdownMenuRadioItem value={NONE}>
            <span className="truncate text-muted-foreground">
              No repository
            </span>
          </DropdownMenuRadioItem>

          {(repositories ?? []).map((repository) => (
            <DropdownMenuRadioItem
              key={repository.fullName}
              value={repository.fullName}
            >
              <span className="truncate">{repository.fullName}</span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
