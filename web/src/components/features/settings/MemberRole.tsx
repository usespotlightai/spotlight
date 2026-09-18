import { ChevronsUpDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { nameOfRole, type Role } from '@/lib/role';

type MemberRoleProps = {
  name: string;
  role: Role;
  onOffer: readonly Role[];
  onChange: (role: Role) => void;
  pending?: boolean;
};

export function MemberRole({
  name,
  role,
  onOffer,
  onChange,
  pending,
}: MemberRoleProps) {
  if (onOffer.length === 0) {
    return (
      <span className="shrink-0 px-2 text-muted-foreground text-sm">
        {nameOfRole[role]}
      </span>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Role of ${name}`}
        disabled={pending}
        className="flex h-7 shrink-0 items-center gap-1 rounded-md px-2 text-muted-foreground text-sm outline-none transition-colors hover:bg-accent hover:text-foreground data-[popup-open]:bg-accent disabled:pointer-events-none disabled:opacity-50"
      >
        {nameOfRole[role]}
        <ChevronsUpDown className="size-3 shrink-0" aria-hidden />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" sideOffset={6} className="min-w-36">
        <DropdownMenuRadioGroup
          value={role}
          onValueChange={(next) => onChange(String(next) as Role)}
        >
          {onOffer.map((each) => (
            <DropdownMenuRadioItem key={each} value={each}>
              <span className="truncate">{nameOfRole[each]}</span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
