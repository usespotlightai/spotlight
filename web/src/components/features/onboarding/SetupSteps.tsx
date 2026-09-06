import { Check } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link, useLocation, useParams } from 'react-router';
import { ChooseRepository } from '@/components/features/onboarding/ChooseRepository';
import { buttonVariants } from '@/components/ui/button';
import { useOnboarding } from '@/hooks/api/useOnboarding';
import type { SetupStepResponseDto } from '@/lib/api/types.gen';
import { installUrlFor } from '@/lib/github';
import { cn } from '@/lib/utils';

type About = {
  readonly title: string;
  readonly description: string | null;
};

type SetupStepsProps = {
  teamId: string;
  body: string;
  about: About | undefined;
};

/** Squarer than a control standing alone, and merged so one radius wins. */
const CONTROL = 'rounded-[5px]';

/** Named by the step, so one renamed on the way here stops compiling. */
const CALLS: Partial<Record<SetupStepResponseDto['key'], string>> = {
  runner: 'Enrol one',
  tools: 'Choose them',
};

type StepProps = {
  step: SetupStepResponseDto;
  action: ReactNode;
};

function Step({ step, action }: StepProps) {
  return (
    <li className="flex items-start gap-3">
      <span
        aria-hidden
        className={
          step.done
            ? 'mt-1 flex size-4 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white dark:bg-emerald-500'
            : 'mt-1 size-4 shrink-0 rounded-full border border-muted-foreground/40'
        }
      >
        {step.done && <Check className="size-3" />}
      </span>

      <div className="flex min-w-0 flex-1 flex-col items-start gap-2">
        <div>
          <p className="font-medium text-foreground text-sm leading-6">
            {step.title}
          </p>
          <p className="text-muted-foreground text-sm leading-6">
            {step.description}
          </p>
        </div>

        {!step.done && action}
      </div>
    </li>
  );
}

/**
 * The standing list a team opens with, shown as the things it names. What
 * each step is and whether it is done come from the list itself; what is
 * left here is how to go and take one. The note's own words are the fallback.
 */
export function SetupSteps({ teamId, body, about }: SetupStepsProps) {
  const { slug } = useParams();
  const here = useLocation();
  const { data: onboarding } = useOnboarding(teamId);

  if (!onboarding || !slug) {
    return (
      <p className="whitespace-pre-wrap text-muted-foreground text-sm leading-6">
        {body}
      </p>
    );
  }

  const goAndDoIt = (step: SetupStepResponseDto): ReactNode => {
    if (step.key === 'github') {
      return (
        onboarding.installUrl && (
          <a
            href={installUrlFor(onboarding.installUrl, {
              slug,
              teamId,
              from: `${here.pathname}${here.search}`,
            })}
            className={cn(buttonVariants({ size: 'sm' }), CONTROL)}
          >
            Install on GitHub
          </a>
        )
      );
    }

    if (step.key === 'repository') {
      return (
        onboarding.connectedToGitHub && (
          <ChooseRepository
            slug={slug}
            teamId={teamId}
            chosen={onboarding.configRepository}
            controlClassName={CONTROL}
          />
        )
      );
    }

    return (
      step.where && (
        <Link
          to={step.where}
          className={cn(
            buttonVariants({ variant: 'outline', size: 'sm' }),
            CONTROL,
          )}
        >
          {CALLS[step.key] ?? 'Take me there'}
        </Link>
      )
    );
  };

  return (
    <div className="flex flex-col gap-4">
      {about && (
        <div>
          <h1 className="font-medium text-foreground text-sm leading-6">
            {about.title}
          </h1>

          {about.description && (
            <p className="text-muted-foreground text-sm leading-6">
              {about.description}
            </p>
          )}
        </div>
      )}

      <ul className="flex flex-col gap-3">
        {onboarding.steps.map((step) => (
          <Step key={step.key} step={step} action={goAndDoIt(step)} />
        ))}
      </ul>
    </div>
  );
}
