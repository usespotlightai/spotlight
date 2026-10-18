import { ChevronsUpDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { describeTeams } from '@/lib/members';
import type { Team } from '@/lib/team';
import { cn } from '@/lib/utils';

type TeamsSelectProps = {
  teams: readonly Team[];
  value: readonly string[];
  onChange: (teamIds: string[]) => void;
  disabled?: boolean;
  className?: string;
};

export function TeamsSelect({
  teams,
  value,
  onChange,
  disabled = false,
  className,
}: TeamsSelectProps) {
  const chosen = new Set(value);
  const shown = describeTeams(teams.filter((each) => chosen.has(each.id)));

  const toggle = (teamId: string, checked: boolean) =>
    onChange(
      teams
        .map((each) => each.id)
        .filter((id) => (id === teamId ? checked : chosen.has(id))),
    );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Teams: ${shown}`}
        disabled={disabled}
        className={cn(
          'flex h-8 min-w-0 items-center gap-2 rounded-full border border-border bg-card px-3 text-left text-xs outline-none transition-colors hover:bg-accent disabled:opacity-50 data-[popup-open]:bg-accent',
          className,
        )}
      >
        <span
          className={cn(
            'truncate',
            chosen.size > 0 ? 'text-foreground' : 'text-muted-foreground',
          )}
        >
          {shown}
        </span>
        <ChevronsUpDown
          aria-hidden
          className="ml-auto size-3 shrink-0 text-muted-foreground"
        />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" sideOffset={6} className="min-w-48">
        {teams.map((team) => (
          <DropdownMenuCheckboxItem
            key={team.id}
            checked={chosen.has(team.id)}
            closeOnClick={false}
            onCheckedChange={(checked) => toggle(team.id, Boolean(checked))}
          >
            <span className="truncate">{team.name}</span>
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
