import { Check, ChevronDown } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { Link, useParams } from 'react-router';
import { InstallGitHubLink } from '@/components/features/onboarding/InstallGitHubLink';
import {
  SetupAbout,
  type SetupAboutProps,
} from '@/components/features/onboarding/SetupAbout';
import { SetupStepsSkeleton } from '@/components/features/onboarding/SetupStepsSkeleton';
import { CouldNotLoad } from '@/components/shared/CouldNotLoad';
import { buttonVariants } from '@/components/ui/button';
import { useOnboarding } from '@/hooks/api/useOnboarding';
import type { SetupStepResponseDto } from '@/lib/api/types.gen';
import { failed, loading } from '@/lib/query';
import { cn } from '@/lib/utils';

type SetupStepsProps = {
  teamId: string;
  body: string;
  about: SetupAboutProps | undefined;
  resolved: boolean;
};

const CONTROL = 'rounded-full px-3.5 shadow-none';

const CALLS: Partial<Record<SetupStepResponseDto['key'], string>> = {
  integrations: 'Choose them',
};

type StepProps = {
  step: SetupStepResponseDto;
  action: ReactNode;
  disabled: boolean;
};

function Step({ step, action, disabled }: StepProps) {
  const [expanded, setExpanded] = useState(false);

  const revisable = step.done && Boolean(action);
  const showAction = !step.done || expanded;

  const [clipped, setClipped] = useState(!showAction);
  if (!showAction && !clipped) {
    setClipped(true);
  }

  const heading = (
    <div>
      <p className="font-medium text-foreground text-sm leading-6">
        {step.title}
      </p>
      <p className="text-muted-foreground text-sm leading-6">
        {step.description}
      </p>
    </div>
  );

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

      <div className="flex min-w-0 flex-1 flex-col items-start">
        {revisable ? (
          <button
            type="button"
            onClick={() => setExpanded((open) => !open)}
            aria-expanded={expanded}
            className="flex w-full items-start justify-between gap-2 text-left outline-none"
          >
            {heading}
            <ChevronDown
              className={cn(
                'mt-1.5 size-3.5 shrink-0 text-muted-foreground transition-transform duration-200',
                expanded && 'rotate-180',
              )}
              aria-hidden
            />
          </button>
        ) : (
          heading
        )}

        {action && (
          <div
            className={cn(
              'grid w-full transition-all duration-200 ease-out',
              showAction
                ? 'grid-rows-[1fr] opacity-100'
                : 'grid-rows-[0fr] opacity-0',
            )}
            onTransitionEnd={() => {
              if (showAction) {
                setClipped(false);
              }
            }}
          >
            <div className={cn('min-h-0', clipped && 'overflow-hidden')}>
              <div
                className={cn('pt-2', disabled && 'opacity-50')}
                inert={disabled}
              >
                {action}
              </div>
            </div>
          </div>
        )}
      </div>
    </li>
  );
}

export function SetupSteps({ teamId, body, about, resolved }: SetupStepsProps) {
  const { slug } = useParams();
  const query = useOnboarding(teamId);
  const onboarding = query.data;

  if (slug && loading(query)) {
    return <SetupStepsSkeleton about={about} />;
  }

  if (slug && failed(query)) {
    return (
      <div className="flex flex-col gap-4">
        {about && (
          <SetupAbout title={about.title} description={about.description} />
        )}

        <CouldNotLoad
          what="The setup steps"
          retrying={query.isFetching}
          onRetry={() => void query.refetch()}
          className="items-start"
        />
      </div>
    );
  }

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
        <InstallGitHubLink slug={slug} teamId={teamId} className={CONTROL} />
      );
    }

    return (
      step.where && (
        <Link
          to={step.where}
          className={cn(
            buttonVariants({ variant: 'outline', size: 'sm' }),
            CONTROL,
            'bg-card',
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
        <SetupAbout title={about.title} description={about.description} />
      )}

      <ul className="flex flex-col gap-3">
        {onboarding.steps.map((step) => (
          <Step
            key={step.key}
            step={step}
            action={goAndDoIt(step)}
            disabled={resolved}
          />
        ))}
      </ul>
    </div>
  );
}
