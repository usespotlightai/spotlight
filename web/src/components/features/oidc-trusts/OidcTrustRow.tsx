import { ShieldCheck } from 'lucide-react';
import { SettingsRow } from '@/components/features/settings/SettingsRow';
import { RowIcon } from '@/components/shared/RowIcon';
import { WithTooltip } from '@/components/shared/WithTooltip';
import {
  describeIssued,
  describeTrust,
  type OidcTrust,
  trustNote,
} from '@/lib/oidc-trust';

type OidcTrustRowProps = {
  trust: OidcTrust;
};

export function OidcTrustRow({ trust }: OidcTrustRowProps) {
  return (
    <div data-slot="oidc-trust-row">
      <SettingsRow
        label={trust.key}
        leading={<RowIcon icon={ShieldCheck} />}
        description={describeTrust(trust)}
      >
        <WithTooltip tooltip={trustNote(trust)}>
          <span className="text-muted-foreground text-xs tabular-nums">
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
