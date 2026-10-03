import { Server } from 'lucide-react';
import { AddHostLink } from '@/components/features/runners/AddHostLink';
import { EmptyState } from '@/components/shared/EmptyState';
import { Notice } from '@/components/shared/Notice';

type NoHostsYetProps = {
  slug: string;
  adds: boolean;
};

export function NoHostsYet({ slug, adds }: NoHostsYetProps) {
  return (
    <Notice>
      <EmptyState
        icon={Server}
        title="No hosts yet"
        action={adds && <AddHostLink slug={slug} label="Add the first host" />}
      >
        {adds
          ? 'A host starts a fresh runner for each run.'
          : 'A workspace owner or admin can add one.'}
      </EmptyState>
    </Notice>
  );
}
