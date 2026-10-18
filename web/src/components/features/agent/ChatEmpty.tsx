import { MousePointer2 } from 'lucide-react';
import { EmptyState } from '@/components/shared/EmptyState';

export function ChatEmpty() {
  return (
    <EmptyState
      icon={MousePointer2}
      title="No messages yet"
      className="flex-1 justify-center self-center py-16"
    >
      Say what you want to plan below. The agent helps shape it into tasks.
    </EmptyState>
  );
}
