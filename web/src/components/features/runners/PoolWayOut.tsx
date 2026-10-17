import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useRunnerPools } from '@/hooks/api/useRunnerPools';
import { useWorkspace } from '@/hooks/api/useWorkspace';
import { PUSH_POOL } from '@/lib/runner';

const PLATFORM = 'spotlight';

export function PoolWayOut({
  slug,
  poolKey,
}: {
  slug: string;
  poolKey: string | null;
}) {
  const { data: workspace } = useWorkspace(slug);
  const { data: pools } = useRunnerPools(workspace?.id);
  const egress = pools?.find((each) => each.key === poolKey)?.provision?.egress;

  if (!egress) {
    return (
      <span className="min-w-0 truncate text-muted-foreground text-xs">
        {PUSH_POOL}
      </span>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            className="min-w-0 cursor-default truncate rounded-sm text-left text-muted-foreground text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring/70"
          />
        }
      >
        {PUSH_POOL} · egress
      </TooltipTrigger>
      <TooltipContent className="max-w-80">
        {egress === PLATFORM
          ? 'The runs of this pool go out through the Spotlight egress. Runs that use secrets can run here.'
          : 'The runs of this pool go out through an egress that your team operates. Runs that use secrets can run here.'}
      </TooltipContent>
    </Tooltip>
  );
}
