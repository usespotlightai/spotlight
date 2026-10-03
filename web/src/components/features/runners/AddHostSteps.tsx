import { useEffect, useState } from 'react';
import { CreatePoolForm } from '@/components/features/runners/CreatePoolForm';
import { HostConnection } from '@/components/features/runners/HostConnection';
import { CopyBlock } from '@/components/shared/CopyBlock';
import { Skeleton } from '@/components/shared/skeleton/Skeleton';
import { Step } from '@/components/shared/steps/Step';
import { Steps } from '@/components/shared/steps/Steps';
import { useCreateRunnerPool } from '@/hooks/api/useCreateRunnerPool';
import { useRunnerPools } from '@/hooks/api/useRunnerPools';
import { installCommand, suggestedPoolName } from '@/lib/runner';

const MOVE_ON_MS = 2_000;

type AddHostStepsProps = {
  slug: string;
  workspaceId: string;
};

export function AddHostSteps({ slug, workspaceId }: AddHostStepsProps) {
  const creating = useCreateRunnerPool(workspaceId);
  const created = creating.data;
  const pools = useRunnerPools(workspaceId);
  const [copied, setCopied] = useState(false);
  const [movedOn, setMovedOn] = useState(false);

  useEffect(() => {
    if (!copied) {
      return;
    }

    const timer = setTimeout(() => setMovedOn(true), MOVE_ON_MS);
    return () => clearTimeout(timer);
  }, [copied]);

  const at = !created ? 1 : movedOn ? 3 : 2;

  const [picked, setPicked] = useState<{ step: number; at: number } | null>(
    null,
  );
  const shown = picked?.at === at ? picked.step : at;
  const suggested = suggestedPoolName(
    (pools.data ?? []).map((pool) => pool.key),
  );
  const pick = (step: number) => () => setPicked({ step, at });

  return (
    <Steps>
      <Step
        title="Create a pool"
        description="A pool is a group of hosts that authenticate with the same token. Its name cannot be changed later."
        open={shown === 1}
        onOpen={created ? pick(1) : undefined}
      >
        {pools.isPending ? (
          <div role="status" aria-label="Loading the pools">
            <Skeleton className="block h-[3.25rem] w-full max-w-md rounded-md" />
          </div>
        ) : (
          <CreatePoolForm
            key={suggested}
            defaultName={suggested}
            creating={creating.isPending || Boolean(created)}
            error={creating.error}
            onCreate={(name) => creating.mutate(name)}
            onEdit={() => creating.error && creating.reset()}
          />
        )}
      </Step>

      <Step
        title={
          created
            ? `Add the machine to the ${created.key} pool`
            : 'Add the machine to the pool'
        }
        description="Run this on the machine that should run agents, with Docker or another container runtime running. The command holds the pool token, which is shown only this once."
        open={shown === 2}
        onOpen={created ? pick(2) : undefined}
      >
        {created && (
          <CopyBlock
            text={installCommand(created.token)}
            label="Copy command"
            focused
            onCopy={() => setCopied(true)}
          />
        )}
      </Step>

      <Step
        title="Wait for the host to connect"
        description="The command downloads the agent image first, which takes a few minutes. The host shows here as soon as it reports to Spotlight."
        open={shown === 3}
        onOpen={created ? pick(3) : undefined}
      >
        {created && <HostConnection slug={slug} pool={created.key} />}
      </Step>
    </Steps>
  );
}
