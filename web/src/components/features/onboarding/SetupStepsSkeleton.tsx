import {
  SetupAbout,
  type SetupAboutProps,
} from '@/components/features/onboarding/SetupAbout';
import { Skeleton } from '@/components/shared/skeleton/Skeleton';
import { SkeletonLine } from '@/components/shared/skeleton/SkeletonLine';

const TITLES = ['w-28', 'w-40', 'w-36', 'w-32'];

type SetupStepsSkeletonProps = {
  about: SetupAboutProps | undefined;
};

export function SetupStepsSkeleton({ about }: SetupStepsSkeletonProps) {
  return (
    <div
      role="status"
      aria-label="Loading the setup steps"
      className="flex flex-col gap-6"
    >
      {about && (
        <SetupAbout title={about.title} description={about.description} />
      )}

      <ul className="flex flex-col gap-5">
        {TITLES.map((width) => (
          <li key={width} className="flex items-start gap-3">
            <Skeleton className="mt-1 size-4 rounded-full" />

            <div className="flex min-w-0 flex-1 flex-col text-sm leading-6">
              <SkeletonLine className={width} />
              <SkeletonLine className="w-11/12" />
              <SkeletonLine className="w-3/5" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
