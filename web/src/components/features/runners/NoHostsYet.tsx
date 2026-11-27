import { Server } from 'lucide-react';
import type { ReactElement } from 'react';

import { AddHostLink } from '@/components/features/runners/AddHostLink';
import { EmptyState } from '@/components/shared/EmptyState';
import { Notice } from '@/components/shared/Notice';

type NoHostsYetProps = {
  slug: string;
  adds: boolean;
};

export function NoHostsYet({ slug, adds }: NoHostsYetProps): ReactElement {
  return (
    <Notice>
      <EmptyState
        icon={Server}
        title="No hosts yet"
        action={adds && <AddHostLink slug={slug} label="Add the first host" />}
      >
        {adds
          ? 'Add a host to start runs. The host starts a fresh runner for each run.'
          : 'Only workspace owners and admins can add hosts.'}
      </EmptyState>
    </Notice>
  );
}
