import { LockKeyhole } from 'lucide-react';

import { SettingsRow } from '@/components/features/settings/SettingsRow';
import { PillButton } from '@/components/shared/PillButton';
import { RowIcon } from '@/components/shared/RowIcon';
import { WithTooltip } from '@/components/shared/WithTooltip';
import {
  awaitsValue,
  describeHosts,
  describeValue,
  allowsSandbox,
  SANDBOX_NOTE,
  setValueLabel,
  valueNote,
  type WorkspaceSecret,
} from '@/lib/secret';
import { cn } from '@/lib/utils';

type SecretRowProps = {
  secret: WorkspaceSecret;
  onSetValue: () => void;
};

export function SecretRow({ secret, onSetValue }: SecretRowProps) {
  return (
    <li data-slot="secret-row">
      <SettingsRow
        label={secret.name}
        leading={<RowIcon icon={LockKeyhole} />}
        description={describeHosts(secret)}
        stack
      >
        <div className="flex items-center gap-3">
          {allowsSandbox(secret) && (
            <WithTooltip tooltip={SANDBOX_NOTE}>
              <span className="whitespace-nowrap text-xs text-muted-foreground">
                Can enter sandboxes
              </span>
            </WithTooltip>
          )}

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

          {secret.settable && (
            <PillButton
              aria-label={`${setValueLabel(secret)} of ${secret.name}`}
              onClick={onSetValue}
            >
              {setValueLabel(secret)}
            </PillButton>
          )}
        </div>
      </SettingsRow>
    </li>
  );
}
