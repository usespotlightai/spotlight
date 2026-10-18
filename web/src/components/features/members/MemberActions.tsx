import { RowActionsTrigger } from '@/components/shared/RowActionsTrigger';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from '@/components/ui/dropdown-menu';
import { rolesOffered } from '@/lib/members';
import { nameOfRole, type Role } from '@/lib/role';

type MemberActionsProps = {
  name: string;
  role: Role;
  assignableRoles: readonly Role[];
  disabled: boolean;
  onChangeRole: (role: Role) => void;
};

export function MemberActions({
  name,
  role,
  assignableRoles,
  disabled,
  onChangeRole,
}: MemberActionsProps) {
  const offered = rolesOffered(role, assignableRoles);

  if (offered.length < 2) {
    return <span aria-hidden className="size-7 shrink-0" />;
  }

  return (
    <DropdownMenu>
      <RowActionsTrigger label={`Actions for ${name}`} disabled={disabled} />

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
