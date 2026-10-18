import { KeyRound } from 'lucide-react';
import { SettingsRow } from '@/components/features/settings/SettingsRow';
import { TokenActions } from '@/components/features/tokens/TokenActions';
import { RowIcon } from '@/components/shared/RowIcon';
import {
  describeCreated,
  describeExpiry,
  describeScopes,
  type WorkspaceToken,
} from '@/lib/token';

type TokenRowProps = {
  token: WorkspaceToken;
  onRevoke: () => void;
};

export function TokenRow({ token, onRevoke }: TokenRowProps) {
  return (
    <div data-slot="token-row" className="group/token">
      <SettingsRow
        label={token.name}
        leading={<RowIcon icon={KeyRound} />}
        description={[
          describeCreated(token.issuedAt),
          describeExpiry(token.expiresAt),
          describeScopes(token.scopes),
        ].join(' · ')}
      >
        <TokenActions name={token.name} onRevoke={onRevoke} />
      </SettingsRow>
    </div>
  );
}
