import { CircleDashed, Layers, TriangleAlert } from 'lucide-react';

import { EmptyState } from '@/components/shared/EmptyState';
import { InferenceSetupLink } from '@/components/shared/InferenceSetupLink';
import { Notice } from '@/components/shared/Notice';
import { TrailLink } from '@/components/shell/layout/TrailLink';
import { buttonVariants } from '@/components/ui/button-variants';
import { useInferenceUnset } from '@/hooks/useInferenceUnset';
import type { ChangeStack } from '@/lib/change-stack';
import { NO_INFERENCE_ENDPOINT } from '@/lib/inference';
import { cn } from '@/lib/utils';

type ChangeStackNoticeProps = {
  slug: string;
  stack: ChangeStack | null;
  runTo: string;
};

export function ChangeStackNotice({
  slug,
  stack,
  runTo,
}: ChangeStackNoticeProps) {
  const unset = useInferenceUnset(slug);
  const back = (
    <TrailLink
      to={runTo}
      className={cn(
        buttonVariants({ variant: 'outline', size: 'sm' }),
        'rounded-full bg-card shadow-none',
      )}
    >
      Back to the run
    </TrailLink>
  );

  if (stack?.state === 'generating') {
    const hunks = stack.files.reduce(
      (total, file) => total + file.hunks.length,
      0,
    );

    return (
      <Notice>
        <EmptyState icon={CircleDashed} title="Generating the change stack">
          Grouping {hunks} {hunks === 1 ? 'hunk' : 'hunks'} across{' '}
          {stack.files.length} {stack.files.length === 1 ? 'file' : 'files'}{' '}
          into review order.
        </EmptyState>
      </Notice>
    );
  }

  if (stack?.state === 'failed') {
    return (
      <Notice>
        <EmptyState
          icon={TriangleAlert}
          title="Sorry, the change stack couldn’t be generated"
          action={back}
        >
          {stack.failure ?? 'Generation stopped before it finished.'}
        </EmptyState>
      </Notice>
    );
  }

  if (!stack && unset) {
    return (
      <Notice>
        <EmptyState
          icon={Layers}
          title="Change stacks are off"
          action={<InferenceSetupLink slug={slug} size="regular" />}
        >
          {NO_INFERENCE_ENDPOINT}
        </EmptyState>
      </Notice>
    );
  }

  return (
    <Notice>
      <EmptyState icon={Layers} title="No change stack yet" action={back}>
        A stack appears here when a run finishes at a station that generates
        change stacks.
      </EmptyState>
    </Notice>
  );
}
