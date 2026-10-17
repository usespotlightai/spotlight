import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { TerminalSpinner } from '@/components/shared/TerminalSpinner';
import type { ApprovalStatus } from '@/lib/approval-status';

const SETTLED: Record<ApprovalStatus, 'filled' | 'faded' | null> = {
  waiting: null,
  approved: 'filled',
  declined: 'faded',
};

type DecisionTitleProps = {
  as?: 'h2' | 'h3';
  children: ReactNode;
} & (
  | { icon: LucideIcon; status?: never }
  | { status: ApprovalStatus; icon?: never }
);

export function DecisionTitle({
  as: Heading = 'h3',
  children,
  ...marked
}: DecisionTitleProps) {
  const Icon = marked.icon;

  return (
    <Heading className="flex min-w-0 items-center gap-2 font-medium text-foreground text-sm">
      {marked.status ? (
        <TerminalSpinner settled={SETTLED[marked.status]} />
      ) : (
        Icon && <Icon aria-hidden className="size-4 shrink-0" />
      )}
      <span className="truncate">{children}</span>
    </Heading>
  );
}
