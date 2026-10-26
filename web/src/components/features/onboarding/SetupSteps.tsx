import { Check, ChevronDown } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { Link, useParams } from 'react-router';
import { ConfigFolderForm } from '@/components/features/onboarding/ConfigFolderForm';
import { InstallGitHubLink } from '@/components/features/onboarding/InstallGitHubLink';
import {
  SetupAbout,
  type SetupAboutProps,
} from '@/components/features/onboarding/SetupAbout';
import { SetupCi } from '@/components/features/onboarding/SetupCi';
import { SetupStepsSkeleton } from '@/components/features/onboarding/SetupStepsSkeleton';
import {
  SETUP_CONTROL,
  setupLinkClass,
} from '@/components/features/onboarding/setup-control';
import { CouldNotLoad } from '@/components/shared/CouldNotLoad';
import { useOnboarding } from '@/hooks/api/useOnboarding';
import type { SetupStepResponseDto } from '@/lib/api/types.gen';
import { chatPath } from '@/lib/chat';
import { failed, loading } from '@/lib/query';
import { runnersPath } from '@/lib/runner';
import { cn } from '@/lib/utils';

type SetupStepsProps = {
  teamId: string;
  body: string;
  about: SetupAboutProps | undefined;
  resolved: boolean;
};

type StepProps = {
  step: SetupStepResponseDto;
  action: ReactNode;
  detail: ReactNode;
  disabled: boolean;
};

function Step({ step, action, detail, disabled }: StepProps) {
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

        {detail}

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

  const configuring = (): ReactNode => {
    const chat = onboarding.setupChat;

    if (chat?.pullRequest) {
      return (
        <a
          href={chat.pullRequest}
          target="_blank"
          rel="noreferrer"
          className={setupLinkClass}
        >
          Open pull request
        </a>
      );
    }

    if (chat?.id) {
      return (
        <Link to={chatPath(slug, teamId, chat.id)} className={setupLinkClass}>
          Open setup chat
        </Link>
      );
    }

    if (chat) {
      return (
        <p className="text-muted-foreground text-sm leading-6">
          {chat.startedBy || 'A former member'} is setting this up.
        </p>
      );
    }

    if (!onboarding.viewerIsAdmin) {
      return (
        <p className="text-muted-foreground text-sm leading-6">
          Only a workspace owner or admin can set up configuration as code.
        </p>
      );
    }

    return onboarding.canSetUp ? (
      <ConfigFolderForm slug={slug} teamId={teamId} />
    ) : (
      <p className="text-muted-foreground text-sm leading-6">
        The setup chat needs the GitHub App and egress. Connect a host, or name
        an egress in a push pool.
      </p>
    );
  };

  const created = (step: SetupStepResponseDto): ReactNode => {
    const chat = onboarding.setupChat;

    return step.key === 'configuration' && chat?.ci ? (
      <SetupCi repository={chat.repository} ci={chat.ci} />
    ) : null;
  };

  const goAndDoIt = (step: SetupStepResponseDto): ReactNode => {
    if (step.key === 'github') {
      return (
        <InstallGitHubLink
          slug={slug}
          teamId={teamId}
          className={SETUP_CONTROL}
        />
      );
    }

    if (step.key === 'configuration') {
      return configuring();
    }

    return (
      <Link to={runnersPath(slug)} className={setupLinkClass}>
        Go to runners
      </Link>
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
            detail={created(step)}
            disabled={resolved && step.key !== 'configuration'}
          />
        ))}
      </ul>
    </div>
  );
}
