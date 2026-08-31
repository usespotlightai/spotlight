import { ChevronsUpDown } from 'lucide-react';
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
  value: string;
  onChange: (repository: string) => void;
};

export function RepositorySelect({ value, onChange }: RepositorySelectProps) {
  const { data: repositories } = useRepositories();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        type="button"
        aria-label="Repository"
        className="flex h-7 items-center gap-2 rounded-md px-2 text-left text-sm outline-none transition-colors hover:bg-accent data-[popup-open]:bg-accent"
      >
        <span
          className={cn(
            'truncate',
            value ? 'text-foreground' : 'text-muted-foreground',
          )}
        >
          {value || 'No repository'}
        </span>
        <ChevronsUpDown
          className="size-3 shrink-0 text-muted-foreground"
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
