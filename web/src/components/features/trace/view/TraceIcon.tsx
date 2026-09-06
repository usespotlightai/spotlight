import {
  Activity,
  FileCodeCorner,
  ListTodo,
  MessageSquare,
  Package,
  Play,
  Sparkle,
  Terminal,
} from 'lucide-react';
import type { ComponentType } from 'react';
import type { TraceNode } from '@/lib/trace';
import { cn } from '@/lib/utils';

const icons: Record<string, ComponentType<{ className?: string }>> = {
  execute: Terminal,
  read: FileCodeCorner,
  edit: FileCodeCorner,
};

const iconFor = (node: TraceNode): ComponentType<{ className?: string }> => {
  if (node.kind === 'run') {
    return Play;
  }
  if (node.kind === 'phase') {
    return Package;
  }
  if (node.span && !node.step) {
    return Activity;
  }

  switch (node.step?.kind) {
    case 'said':
      return MessageSquare;
    case 'thought':
      return Sparkle;
    case 'planned':
      return ListTodo;
    case 'hook':
      return Package;
    default:
      return icons[node.step?.tool ?? ''] ?? Terminal;
  }
};

export function TraceIcon({ node }: { node: TraceNode }) {
  const Icon = iconFor(node);

  return (
    <Icon
      className={cn(
        'size-3.5 shrink-0',
        node.tone === 'failed' ? 'text-destructive' : 'text-muted-foreground',
      )}
      aria-hidden
    />
  );
}
