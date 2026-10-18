import { MousePointer2 } from 'lucide-react';
import { PillLink } from '@/components/shared/PillLink';
import type { TargetStation } from '@/lib/chat';
import type { PillSize, PillVariant } from '@/lib/pill';
import { teamSectionPath } from '@/lib/team';

type ImproveStationLinkProps = {
  slug: string;
  teamId: string;
  targetStation: TargetStation;
  label?: string;
  prompt?: string;
  variant?: PillVariant;
  size?: PillSize;
  className?: string;
};

export function ImproveStationLink({
  slug,
  teamId,
  targetStation,
  label = 'Improve',
  prompt,
  variant,
  size,
  className,
}: ImproveStationLinkProps) {
  return (
    <PillLink
      to={teamSectionPath(slug, teamId, 'agent')}
      state={{ targetStation, ...(prompt ? { prompt } : {}) }}
      variant={variant}
      size={size}
      className={className}
    >
      <MousePointer2 aria-hidden />
      {label}
    </PillLink>
  );
}
