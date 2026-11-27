import { Lock } from 'lucide-react';
import type { ReactElement } from 'react';

import { EmptyState } from '@/components/shared/EmptyState';

type MembersOnlyProps = {
  title: string;
};

export function MembersOnly({ title }: MembersOnlyProps): ReactElement {
  return (
    <EmptyState icon={Lock} title={title}>
      Please ask a team member or workspace admin to add you.
    </EmptyState>
  );
}
