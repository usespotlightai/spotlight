import { MoreHorizontal } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { rolesOffered } from '@/lib/members';
import { nameOfRole, type Role } from '@/lib/role';

type MemberActionsProps = {
  name: string;
  role: Role;
  mayBeSetTo: readonly Role[];
  disabled: boolean;
  onChangeRole: (role: Role) => void;
};

export function MemberActions({
  name,
  role,
  mayBeSetTo,
  disabled,
  onChangeRole,
}: MemberActionsProps) {
  const offered = rolesOffered(role, mayBeSetTo);

  if (offered.length < 2) {
    return <span aria-hidden className="size-7 shrink-0" />;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Actions for ${name}`}
        disabled={disabled}
        className="flex size-7 shrink-0 items-center justify-center rounded-full text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 data-[popup-open]:bg-accent data-[popup-open]:text-foreground"
      >
        <MoreHorizontal aria-hidden className="size-4" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" sideOffset={6} className="min-w-40">
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>Change role</DropdownMenuSubTrigger>

          <DropdownMenuSubContent className="min-w-36">
            <DropdownMenuRadioGroup
              value={role}
              onValueChange={(next) => {
                if (next !== role) {
                  onChangeRole(next as Role);
                }
              }}
            >
              {offered.map((each) => (
                <DropdownMenuRadioItem key={each} value={each}>
                  {nameOfRole[each]}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
