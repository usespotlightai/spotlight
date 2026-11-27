import { LockKeyhole, TriangleAlert } from 'lucide-react';
import type { ComponentProps } from 'react';

import { SettingsRow } from '@/components/features/settings/SettingsRow';
import { PillButton } from '@/components/shared/PillButton';
import { RowIcon } from '@/components/shared/RowIcon';
import { WarningTooltip } from '@/components/shared/WarningTooltip';
import { WithTooltip } from '@/components/shared/WithTooltip';
import { TrailLink } from '@/components/shell/layout/TrailLink';
import { runnersPath } from '@/lib/runner';
import {
  awaitsValue,
  describeHosts,
  describeValue,
  allowsSandbox,
  SANDBOX_NOTE,
  setValueLabel,
  showsValueLabel,
  UNREACHED_LABEL,
  unreachedNote,
  valueNote,
  type WorkspaceSecret,
} from '@/lib/secret';
import { cn } from '@/lib/utils';

type SecretRowProps = {
  slug: string;
  secret: WorkspaceSecret;
  onSetValue: () => void;
};

type UnreachedProps = {
  slug: string;
  secret: WorkspaceSecret;
  note: string;
};

function Unreached({ slug, secret, note }: UnreachedProps) {
  if (secret.reach.deliverable) {
    return (
      <WarningTooltip tone="warning" label={UNREACHED_LABEL} tooltip={note} />
    );
  }

  return (
    <WithTooltip tooltip={note} named={UNREACHED_LABEL}>
      <TrailLink
        to={runnersPath(slug)}
        aria-label={`${UNREACHED_LABEL}. See runners`}
        className="inline-flex shrink-0"
      >
        <TriangleAlert
          aria-hidden
          className="size-3.5 text-amber-600 dark:text-amber-400"
        />
      </TrailLink>
    </WithTooltip>
  );
}

type SetValueButtonProps = ComponentProps<typeof PillButton> & {
  secret: WorkspaceSecret;
  onSetValue: () => void;
};

function SetValueButton({ secret, onSetValue, ...props }: SetValueButtonProps) {
  return (
    <PillButton
      {...props}
      aria-label={`${setValueLabel(secret)} of ${secret.name}`}
      onClick={onSetValue}
    >
      {setValueLabel(secret)}
    </PillButton>
  );
}

export function SecretRow({ slug, secret, onSetValue }: SecretRowProps) {
  const note = unreachedNote(secret);

  return (
    <li data-slot="secret-row">
      <SettingsRow
        label={secret.name}
        leading={<RowIcon icon={LockKeyhole} />}
        description={describeHosts(secret)}
        stack
      >
        <div className="flex items-center gap-3">
          {note && <Unreached slug={slug} secret={secret} note={note} />}

          {allowsSandbox(secret) && (
            <WithTooltip tooltip={SANDBOX_NOTE}>
              <span className="whitespace-nowrap text-xs text-muted-foreground">
                Can enter sandboxes
              </span>
            </WithTooltip>
          )}

          {showsValueLabel(secret) && (
            <WithTooltip tooltip={valueNote(secret)}>
              <span
                className={cn(
                  'whitespace-nowrap text-xs tabular-nums',
                  awaitsValue(secret)
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-muted-foreground',
                )}
              >
                {describeValue(secret)}
              </span>
            </WithTooltip>
          )}

          {secret.settable &&
            (awaitsValue(secret) ? (
              <WithTooltip tooltip={valueNote(secret)}>
                <SetValueButton secret={secret} onSetValue={onSetValue} />
              </WithTooltip>
            ) : (
              <SetValueButton secret={secret} onSetValue={onSetValue} />
            ))}
        </div>
      </SettingsRow>
    </li>
  );
}
