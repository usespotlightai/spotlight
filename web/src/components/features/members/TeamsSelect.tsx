import { ChevronsUpDown } from 'lucide-react';

import {
  FIELD_SELECT,
  SELECT_TRIGGER,
} from '@/components/shared/form/select-look';
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
        className={cn(SELECT_TRIGGER, FIELD_SELECT.trigger, className)}
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

      <DropdownMenuContent
        align="start"
        sideOffset={6}
        className={FIELD_SELECT.menu}
      >
        {teams.map((team) => (
          <DropdownMenuCheckboxItem
            key={team.id}
            checked={chosen.has(team.id)}
            closeOnClick={false}
            onCheckedChange={(checked) => toggle(team.id, checked)}
          >
            <span className="truncate">{team.name}</span>
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
