import type { ReactElement } from 'react';

import { MemberRow } from '@/components/features/members/MemberRow';
import { SettingsSection } from '@/components/features/settings/SettingsSection';
import type { useWorkspaceMembers } from '@/hooks/api/useWorkspaceMembers';
import { suspendedMembers } from '@/lib/members';

type SuspendedMembersProps = {
  slug: string;
  members: ReturnType<typeof useWorkspaceMembers>;
};

export function SuspendedMembers({
  slug,
  members,
}: SuspendedMembersProps): ReactElement | null {
  const suspended = suspendedMembers(members.data ?? []);

  if (suspended.length === 0) {
    return null;
  }

  return (
    <SettingsSection
      title="Suspended"
      count={suspended.length}
      listLabel="Suspended"
    >
      {suspended.map((member) => (
        <MemberRow key={member.id} slug={slug} member={member} />
      ))}
    </SettingsSection>
  );
}
