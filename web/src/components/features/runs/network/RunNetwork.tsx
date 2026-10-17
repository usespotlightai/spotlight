import { ConnectionRow } from '@/components/features/runs/network/ConnectionRow';
import { DetailProperty } from '@/components/features/trace/view/detail/DetailProperty';
import { DetailSection } from '@/components/features/trace/view/detail/DetailSection';
import { CouldNotLoad } from '@/components/shared/CouldNotLoad';
import { SkeletonLine } from '@/components/shared/skeleton/SkeletonLine';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useRunNetwork } from '@/hooks/api/useRunNetwork';
import { notFound } from '@/lib/error';
import { failed, loading } from '@/lib/query';
import {
  connectionGroups,
  ENFORCEMENT_LABELS,
  ENFORCEMENT_TOLD,
} from '@/lib/run-network';
import { cn } from '@/lib/utils';

const ENFORCEMENT = 'Enforcement';

export function RunNetwork({
  teamId,
  runId,
}: {
  teamId: string;
  runId: string;
}) {
  const query = useRunNetwork(teamId, runId);

  if (loading(query)) {
    return (
      <DetailSection title="Egress">
        <div role="status" aria-label="Loading the egress">
          <dl>
            <DetailProperty name={ENFORCEMENT}>
              <SkeletonLine className="w-20" />
            </DetailProperty>
          </dl>
        </div>
      </DetailSection>
    );
  }

  if (failed(query) && notFound(query.error)) {
    return null;
  }

  if (failed(query)) {
    return (
      <CouldNotLoad
        what="The egress of the run"
        retrying={query.isFetching}
        onRetry={() => void query.refetch()}
        className="items-start"
      />
    );
  }

  const network = query.data;

  if (
    !network ||
    (network.egress === null && network.connections.length === 0)
  ) {
    return null;
  }

  const groups = connectionGroups(network);

  return (
    <>
      <DetailSection title="Egress">
        <dl data-slot="run-network">
          <DetailProperty name={ENFORCEMENT}>
            {network.egress ? (
              <Tooltip>
                <TooltipTrigger
                  render={
                    <button
                      type="button"
                      className="cursor-default rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/70"
                    />
                  }
                >
                  <span
                    data-slot="egress-enforcement"
                    className={cn(
                      network.egress === 'not-enforced' &&
                        'text-amber-600 dark:text-amber-400',
                    )}
                  >
                    {ENFORCEMENT_LABELS[network.egress]}
                  </span>
                </TooltipTrigger>
                <TooltipContent className="max-w-80">
                  {ENFORCEMENT_TOLD[network.egress]}
                </TooltipContent>
              </Tooltip>
            ) : (
              <span className="text-muted-foreground">Not checked</span>
            )}
          </DetailProperty>
          <DetailProperty name="Connections">
            {network.connections.length}
          </DetailProperty>
        </dl>
      </DetailSection>

      {groups.length > 0 && (
        <DetailSection title="Destinations">
          <ul aria-label="Destinations" className="flex flex-col">
            {groups.map((group) => (
              <ConnectionRow key={group.key} group={group} />
            ))}
          </ul>
        </DetailSection>
      )}
    </>
  );
}
