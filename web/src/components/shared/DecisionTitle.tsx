import {
  CircleCheck,
  CircleSlash,
  type LucideIcon,
  RotateCwFadingClock,
} from 'lucide-react';
import type { ReactNode } from 'react';
import type { DecisionStanding } from '@/lib/decision-standing';

const STANDING_ICONS: Record<DecisionStanding, LucideIcon> = {
  waiting: RotateCwFadingClock,
  approved: CircleCheck,
  declined: CircleSlash,
};

type DecisionTitleProps = {
  as?: 'h2' | 'h3';
  children: ReactNode;
} & (
  | { icon: LucideIcon; standing?: never }
  | { standing: DecisionStanding; icon?: never }
);

export function DecisionTitle({
  as: Heading = 'h3',
  children,
  ...marked
}: DecisionTitleProps) {
  const Icon = marked.standing ? STANDING_ICONS[marked.standing] : marked.icon;

  return (
    <Heading className="flex min-w-0 items-center gap-2 font-medium text-foreground text-sm">
      <Icon aria-hidden className="size-4 shrink-0" />
      <span className="truncate">{children}</span>
    </Heading>
  );
}
