import type { ReactNode } from 'react';
import { MemberRow } from '@/components/features/members/MemberRow';
import { SettingsSection } from '@/components/features/settings/SettingsSection';
import { CouldNotLoad } from '@/components/shared/CouldNotLoad';
import { IconRowSkeleton } from '@/components/shared/skeleton/IconRowSkeleton';
import type { useWorkspaceMembers } from '@/hooks/api/useWorkspaceMembers';
import { MEMBER_SHOWS, type MemberShow, membersShown } from '@/lib/members';
import { failed, loading } from '@/lib/query';

type MembersListProps = {
  slug: string;
  members: ReturnType<typeof useWorkspaceMembers>;
  show: MemberShow | null;
  action?: ReactNode;
};

export function MembersList({ slug, members, show, action }: MembersListProps) {
  const shown = membersShown(members.data ?? [], show);
  const named = MEMBER_SHOWS.find((each) => each.value === show)?.label;

  return (
    <SettingsSection
      title={named ?? 'Members'}
      count={members.data ? shown?.length : undefined}
      action={action}
      listLabel="Members"
    >
      {loading(members) && (
        <li role="status" aria-label="Loading the members">
          <IconRowSkeleton nameWidth="w-28" aboutWidth="w-56" />
          <IconRowSkeleton nameWidth="w-24" aboutWidth="w-48" />
          <IconRowSkeleton nameWidth="w-32" aboutWidth="w-52" />
        </li>
      )}

      {failed(members) && (
        <li>
          <CouldNotLoad
            what="Members"
            retrying={members.isFetching}
            onRetry={() => void members.refetch()}
            className="px-4 py-6 text-center"
          />
        </li>
      )}

      {members.data && shown?.length === 0 && (
        <li className="px-4 py-4 text-muted-foreground text-sm">
          No {named?.toLowerCase()} match. Please clear the filter to see
          everyone.
        </li>
      )}

      {shown?.map((member) => (
        <MemberRow key={member.id} slug={slug} member={member} />
      ))}
    </SettingsSection>
  );
}
