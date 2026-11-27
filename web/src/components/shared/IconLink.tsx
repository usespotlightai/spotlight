import type { ReactNode } from 'react';

import { ICON_ACTION } from '@/components/shared/icon-action';
import { TrailLink } from '@/components/shell/layout/TrailLink';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

type IconLinkProps = {
  label: string;
  tip?: ReactNode;
  to: string;
  children: ReactNode;
};

export function IconLink({ label, tip, to, children }: IconLinkProps) {
  return (
    <Tooltip>
      <TooltipTrigger
        iconOnly
        render={
          <TrailLink to={to} aria-label={label} className={ICON_ACTION}>
            {children}
          </TrailLink>
        }
      />
      <TooltipContent side="bottom" align="center">
        {tip ?? label}
      </TooltipContent>
    </Tooltip>
  );
}
