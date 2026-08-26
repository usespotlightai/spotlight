import { ChevronsUpDown, Server } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useRunners } from '@/hooks/api/useRunners';
import { byPool } from '@/lib/runner';
import { cn } from '@/lib/utils';

type RunnerPoolSelectProps = {
  value: string;
  onChange: (pool: string) => void;
};

export function RunnerPoolSelect({ value, onChange }: RunnerPoolSelectProps) {
  const { data: runners } = useRunners();

  const pools = byPool(runners ?? []);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Runner pool"
        className="flex h-7 w-full items-center gap-2 rounded-md px-2 text-left text-sm outline-none transition-colors hover:bg-accent data-[popup-open]:bg-accent"
      >
        <Server
          className="size-3.5 shrink-0 text-muted-foreground"
          aria-hidden
        />
        <span
          className={cn(
            'truncate',
            value ? 'text-foreground' : 'text-muted-foreground',
          )}
        >
          {value || 'Select pool'}
        </span>
        <ChevronsUpDown
          className="ml-auto size-3 shrink-0 text-muted-foreground"
          aria-hidden
        />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" sideOffset={6} className="min-w-52">
        {pools.length === 0 ? (
          <DropdownMenuLabel className="text-muted-foreground">
            No runners are enrolled yet
          </DropdownMenuLabel>
        ) : (
          <DropdownMenuRadioGroup
            value={value}
            onValueChange={(next) => onChange(String(next))}
          >
            {pools.map(([pool]) => (
              <DropdownMenuRadioItem key={pool} value={pool}>
                <span className="truncate">{pool}</span>
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
