import { Lock } from 'lucide-react';
import { EmptyState } from '@/components/shared/EmptyState';

type MembersOnlyProps = {
  title: string;
};

export function MembersOnly({ title }: MembersOnlyProps) {
  return (
    <EmptyState icon={Lock} title={title}>
      Ask someone on the team to add you, or a workspace admin.
    </EmptyState>
  );
}
