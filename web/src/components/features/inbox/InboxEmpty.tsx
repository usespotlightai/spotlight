import { InboxIcon } from 'lucide-react';
import { CreateTaskLink } from '@/components/features/team/CreateTaskLink';
import { EmptyState } from '@/components/shared/EmptyState';
import { useWorkspace } from '@/hooks/api/useWorkspace';

export function InboxEmpty({ slug }: { slug: string }) {
  const { data: workspace } = useWorkspace(slug);

  return (
    <EmptyState
      icon={InboxIcon}
      title="No messages"
      action={<CreateTaskLink slug={slug} teamId={workspace?.teams[0]?.id} />}
    >
      When a station needs an answer from you, it asks here. Create a task to
      put a line to work.
    </EmptyState>
  );
}
