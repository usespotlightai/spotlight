import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useRunnerPools } from '@/hooks/api/useRunnerPools';
import { useWorkspace } from '@/hooks/api/useWorkspace';
import { nonEmpty } from '@/lib/non-empty';
import { PUSH_POOL, SPOTLIGHT_EGRESS_TIP } from '@/lib/runner';

const PLATFORM = 'spotlight';

const WITH_EGRESS = `${PUSH_POOL} with egress`;

export function PoolEgress({
  slug,
  poolKey,
}: {
  slug: string;
  poolKey: string | null;
}) {
  const { data: workspace } = useWorkspace(slug);
  const { data: pools } = useRunnerPools(workspace?.id);
  const egress = pools?.find((each) => each.key === poolKey)?.provision?.egress;

  if (!nonEmpty(egress)) {
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
          // oxlint-disable-next-line jsx-a11y/control-has-associated-label -- the trigger renders this button around its children
          <button
            type="button"
            title={WITH_EGRESS}
            className="min-w-0 cursor-default truncate rounded-sm text-left text-muted-foreground text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring/70"
          />
        }
      >
        {WITH_EGRESS}
      </TooltipTrigger>
      <TooltipContent className="max-w-80">
        {egress === PLATFORM
          ? SPOTLIGHT_EGRESS_TIP
          : 'The runs of this pool go out through an egress that your team operates. Runs whose secrets egress injects can run here.'}
      </TooltipContent>
    </Tooltip>
  );
}
