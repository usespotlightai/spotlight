import { MousePointer2 } from 'lucide-react';
import { PillLink } from '@/components/shared/PillLink';
import type { ImprovedStation } from '@/lib/chat';
import type { PillVariant } from '@/lib/pill';
import { teamSectionPath } from '@/lib/team';

type ImproveStationLinkProps = {
  slug: string;
  teamId: string;
  improving: ImprovedStation;
  label?: string;
  prompt?: string;
  variant?: PillVariant;
  className?: string;
};

export function ImproveStationLink({
  slug,
  teamId,
  improving,
  label = 'Improve',
  prompt,
  variant,
  className,
}: ImproveStationLinkProps) {
  return (
    <PillLink
      to={teamSectionPath(slug, teamId, 'agent')}
      state={{ improving, ...(prompt ? { prompt } : {}) }}
      variant={variant}
      className={className}
    >
      <MousePointer2 aria-hidden />
      {label}
    </PillLink>
  );
}
