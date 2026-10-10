import { RotateCw, UserPlus } from 'lucide-react';
import { ActionWithAlert } from '@/components/shared/ActionWithAlert';
import { PersonAvatar } from '@/components/shared/avatar/PersonAvatar';
import { SectionButton } from '@/components/shared/SectionButton';
import { SkeletonLine } from '@/components/shared/skeleton/SkeletonLine';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAddTeamMember } from '@/hooks/api/useAddTeamMember';
import { useWorkspaceMembers } from '@/hooks/api/useWorkspaceMembers';
import { messageOf } from '@/lib/error';
import { failed, loading } from '@/lib/query';

type AddTeamMemberProps = {
  slug: string | undefined;
  teamId: string | undefined;
  onInvite: () => void;
};

export function AddTeamMember({ slug, teamId, onInvite }: AddTeamMemberProps) {
  const members = useWorkspaceMembers(slug);
  const add = useAddTeamMember(slug, teamId);
  const addable = (members.data ?? []).filter(
    (member) => !member.teams.some((team) => team.id === teamId),
  );

  return (
    <ActionWithAlert
      alert={
        add.isError
          ? messageOf(add.error, 'Sorry, the member couldn’t be added.')
          : null
      }
    >
      <DropdownMenu>
        <DropdownMenuTrigger
          disabled={!teamId || add.isPending}
          render={<SectionButton />}
        >
          {add.isPending ? 'Adding…' : 'Add a member'}
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" sideOffset={6} className="min-w-60">
          <DropdownMenuGroup>
            <DropdownMenuLabel className="text-muted-foreground">
              In the workspace
            </DropdownMenuLabel>

            {loading(members) && (
              <div
                role="status"
                aria-label="Loading the workspace’s members"
                className="flex flex-col gap-2 px-1.5 py-1.5"
              >
                <SkeletonLine className="w-36 text-sm" />
                <SkeletonLine className="w-28 text-sm" />
              </div>
            )}

            {failed(members) && (
              <>
                <p
                  role="alert"
                  className="px-1.5 py-1 text-muted-foreground text-sm"
                >
                  Workspace members could not be loaded.
                </p>
                <DropdownMenuItem
                  closeOnClick={false}
                  disabled={members.isFetching}
                  onClick={() => void members.refetch()}
                >
                  <RotateCw aria-hidden />
                  Try again
                </DropdownMenuItem>
              </>
            )}

            {members.data && addable.length === 0 && (
              <p className="px-1.5 py-1 text-muted-foreground text-sm">
                Everyone in the workspace is on this team.
              </p>
            )}

            {addable.map((member) => (
              <DropdownMenuItem
                key={member.id}
                onClick={() => {
                  add.reset();
                  add.mutate(member.id);
                }}
              >
                <span aria-hidden className="flex">
                  <PersonAvatar person={member} />
                </span>
                <span className="flex min-w-0 flex-col">
                  <span className="truncate">{member.name}</span>{' '}
                  <span className="truncate text-muted-foreground text-xs">
                    {member.email}
                  </span>
                </span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>

          <DropdownMenuSeparator />

          <DropdownMenuItem onClick={onInvite}>
            <UserPlus aria-hidden />
            Invite someone new
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </ActionWithAlert>
  );
}
