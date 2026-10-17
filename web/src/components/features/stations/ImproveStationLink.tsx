import { MousePointer2 } from 'lucide-react';
import { PillLink } from '@/components/shared/PillLink';
import type { ImprovedStation } from '@/lib/chat';
import type { PillSize, PillVariant } from '@/lib/pill';
import { teamSectionPath } from '@/lib/team';

type ImproveStationLinkProps = {
  slug: string;
  teamId: string;
  improving: ImprovedStation;
  label?: string;
  ask?: string;
  variant?: PillVariant;
  size?: PillSize;
  className?: string;
};

export function ImproveStationLink({
  slug,
  teamId,
  improving,
  label = 'Improve',
  ask,
  variant,
  size,
  className,
}: ImproveStationLinkProps) {
  return (
    <PillLink
      to={teamSectionPath(slug, teamId, 'agent')}
      state={{ improving, ...(ask ? { ask } : {}) }}
      variant={variant}
      size={size}
      className={className}
    >
      <MousePointer2 aria-hidden />
      {label}
    </PillLink>
  );
}
