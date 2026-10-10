import { useId, useRef, useState } from 'react';
import { IntegrationDetails } from '@/components/features/integrations/IntegrationDetails';
import { IntegrationLogo } from '@/components/features/integrations/IntegrationLogo';
import { IntegrationNeed } from '@/components/features/integrations/IntegrationNeed';
import { IntegrationReadProblem } from '@/components/features/integrations/IntegrationReadProblem';
import { FoldChevron } from '@/components/shared/FoldChevron';
import { Unfold } from '@/components/shared/Unfold';
import { useRowClick } from '@/hooks/useRowClick';
import {
  type Integration,
  type Joined,
  type MyConnection,
  usedForShown,
} from '@/lib/integration';

type IntegrationRowProps = {
  integration: Integration;
  teamId: string;
  admin: boolean;
  mine: MyConnection | null;
  joined: Joined | null;
};

export function IntegrationRow({
  integration,
  teamId,
  admin,
  mine,
  joined,
}: IntegrationRowProps) {
  const [open, setOpen] = useState(false);
  const details = useId();
  const detailsRegion = useRef<HTMLDivElement>(null);
  const flip = () => setOpen((was) => !was);
  const onRow = useRowClick(flip, {
    ignore: (target) => detailsRegion.current?.contains(target) ?? false,
  });

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: the integration's own button is the keyboard path; this widens the click to the whole row
    <li
      data-slot="integration"
      data-open={open || undefined}
      onClick={onRow}
      className="cursor-pointer"
    >
      <div
        data-slot="integration-head"
        className="flex min-h-12 items-center justify-between gap-4 px-4 py-2"
      >
        <div className="flex min-w-0 items-center gap-3">
          <IntegrationLogo source={integration.source} />

          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="flex items-center gap-1.5">
              <button
                type="button"
                aria-expanded={open}
                aria-controls={details}
                onClick={flip}
                className="truncate rounded-sm text-left font-medium text-foreground text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {integration.name}
              </button>
              {integration.described && (
                <IntegrationReadProblem described={integration.described} />
              )}
            </span>
            <span className="text-muted-foreground text-xs">
              {usedForShown(integration)}
            </span>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          {!open && (
            <IntegrationNeed
              integration={integration}
              teamId={teamId}
              admin={admin}
              mine={mine}
            />
          )}
          <FoldChevron open={open} className="size-4 text-muted-foreground" />
        </div>
      </div>

      <div id={details} ref={detailsRegion} className="cursor-auto">
        <Unfold open={open} appear={false}>
          <IntegrationDetails
            integration={integration}
            teamId={teamId}
            admin={admin}
            mine={mine}
            joined={joined}
          />
        </Unfold>
      </div>
    </li>
  );
}
