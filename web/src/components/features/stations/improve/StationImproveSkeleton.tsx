import { SkeletonLine } from '@/components/shared/skeleton/SkeletonLine';
import { Step } from '@/components/shared/steps/Step';
import { Steps } from '@/components/shared/steps/Steps';

const STEPS = [
  'Talk it through with the agent',
  'Pick past runs to replay',
  'Propose candidates',
  'Or let a search find one',
] as const;

export function StationImproveSkeleton() {
  return (
    <Steps>
      {STEPS.map((title) => (
        <Step key={title} title={title}>
          <SkeletonLine className="w-2/3" />
        </Step>
      ))}
    </Steps>
  );
}
