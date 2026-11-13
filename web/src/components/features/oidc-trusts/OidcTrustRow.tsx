import { ShieldCheck } from 'lucide-react';

import { SettingsRow } from '@/components/features/settings/SettingsRow';
import { RowIcon } from '@/components/shared/RowIcon';
import { WithTooltip } from '@/components/shared/WithTooltip';
import { describeIssued, type OidcTrust, trustNote } from '@/lib/oidc-trust';

type OidcTrustRowProps = {
  trust: OidcTrust;
};

export function OidcTrustRow({ trust }: OidcTrustRowProps) {
  return (
    <div data-slot="oidc-trust-row">
      <SettingsRow
        label={trust.key}
        leading={<RowIcon icon={ShieldCheck} />}
        stack
        description={
          trust.description && (
            <WithTooltip tooltip={trust.description}>
              <span className="line-clamp-2 break-words pointer-coarse:line-clamp-none @max-md/pane:pointer-fine:line-clamp-3">
                {trust.description}
              </span>
            </WithTooltip>
          )
        }
      >
        <WithTooltip tooltip={trustNote(trust)}>
          <span className="whitespace-nowrap text-muted-foreground text-xs tabular-nums">
            {trust.lastIssuedAt ? (
              <time dateTime={trust.lastIssuedAt}>
                {describeIssued(trust.lastIssuedAt)}
              </time>
            ) : (
              describeIssued(null)
            )}
          </span>
        </WithTooltip>
      </SettingsRow>
    </div>
  );
}
