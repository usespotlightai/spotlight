import { useState } from 'react';

import { CreatePoolForm } from '@/components/features/runners/CreatePoolForm';
import { HostConnection } from '@/components/features/runners/HostConnection';
import { CopyBlock } from '@/components/shared/CopyBlock';
import { Skeleton } from '@/components/shared/skeleton/Skeleton';
import { Step } from '@/components/shared/steps/Step';
import { Steps } from '@/components/shared/steps/Steps';
import { useCreateRunnerPool } from '@/hooks/api/useCreateRunnerPool';
import { useRunnerPools } from '@/hooks/api/useRunnerPools';
import { useTimeout } from '@/hooks/useTimeout';
import { messageOf } from '@/lib/error';
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
  const [movedOn, setMovedOn] = useState(false);
  const later = useTimeout();

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
        description="Pool: hosts that share one token. The name is permanent."
        open={shown === 1}
        onOpen={created ? pick(1) : undefined}
      >
        {pools.isPending ? (
          <div role="status" aria-label="Loading the pools">
            <Skeleton className="block h-[3.25rem] w-full max-w-md rounded-md" />
          </div>
        ) : (
          <CreatePoolForm
            suggestedName={suggested}
            creating={creating.isPending || Boolean(created)}
            refusal={creating.error ? messageOf(creating.error) : null}
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
        description="Run this command on the machine while Docker or another container runtime is running. When it asks for the pool token, paste the token. The token stays out of your shell history. The command then asks how many sandboxes run at once and which runner image to use. Spotlight shows the pool token only once."
        open={shown === 2}
        onOpen={created ? pick(2) : undefined}
      >
        {created && (
          <div className="flex flex-col gap-2">
            <CopyBlock
              text={installCommand()}
              label="Copy command"
              focused
              onCopy={() => later(() => setMovedOn(true), MOVE_ON_MS)}
            />
            <CopyBlock text={created.token} label="Copy pool token" />
          </div>
        )}
      </Step>

      <Step
        title="Wait for the host to connect"
        description="The agent image download takes a few minutes. The host appears here when it connects."
        open={shown === 3}
        onOpen={created ? pick(3) : undefined}
      >
        {created && <HostConnection slug={slug} pool={created.key} />}
      </Step>
    </Steps>
  );
}
