import type { ReactElement } from 'react';

import { RowActionsTrigger } from '@/components/shared/RowActionsTrigger';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from '@/components/ui/dropdown-menu';
import { type MemberChange, rolesOffered } from '@/lib/members';
import { isOneOf } from '@/lib/one-of';
import { nameOfRole, type Role } from '@/lib/role';

type MemberActionsProps = {
  name: string;
  role: Role;
  assignableRoles: readonly Role[];
  mayBeSuspended: boolean;
  mayBeUnsuspended: boolean;
  mayLeave: boolean;
  disabled: boolean;
  onChangeRole: (role: Role) => void;
  onAsk: (change: MemberChange) => void;
};

export function MemberActions({
  name,
  role,
  assignableRoles,
  mayBeSuspended,
  mayBeUnsuspended,
  mayLeave,
  disabled,
  onChangeRole,
  onAsk,
}: MemberActionsProps): ReactElement | null {
  const offered = rolesOffered(role, assignableRoles);
  const changesRole = offered.length >= 2;

  if (!(changesRole || mayBeSuspended || mayBeUnsuspended || mayLeave)) {
    return null;
  }

  return (
    <DropdownMenu>
      <RowActionsTrigger label={`Actions for ${name}`} disabled={disabled} />

      <DropdownMenuContent align="end" sideOffset={6} className="min-w-40">
        {changesRole && (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>Change role</DropdownMenuSubTrigger>

            <DropdownMenuSubContent className="min-w-36">
              <DropdownMenuRadioGroup
                value={role}
                onValueChange={(next) => {
                  if (next !== role && isOneOf(offered, next)) {
                    onChangeRole(next);
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
        )}

        {mayBeSuspended && (
          <DropdownMenuItem onClick={() => onAsk('suspend')}>
            Suspend
          </DropdownMenuItem>
        )}

        {mayBeUnsuspended && (
          <DropdownMenuItem onClick={() => onAsk('unsuspend')}>
            Unsuspend
          </DropdownMenuItem>
        )}

        {mayLeave && (
          <DropdownMenuItem onClick={() => onAsk('leave')}>
            Leave workspace
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
