import { MousePointer2 } from 'lucide-react';
import { EmptyState } from '@/components/shared/EmptyState';

export function ChatEmpty() {
  return (
    <EmptyState
      icon={MousePointer2}
      title="Nothing said yet"
      className="flex-1 justify-center self-center py-16"
    >
      Say what you want to plan below, and the agent will help shape it into
      tasks.
    </EmptyState>
  );
}
