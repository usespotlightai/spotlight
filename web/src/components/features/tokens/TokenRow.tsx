import { KeyRound } from 'lucide-react';
import { SettingsRow } from '@/components/features/settings/SettingsRow';
import { TokenActions } from '@/components/features/tokens/TokenActions';
import { RowIcon } from '@/components/shared/RowIcon';
import {
  createdTold,
  expiryTold,
  scopesTold,
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
          createdTold(token.issuedAt),
          expiryTold(token.expiresAt),
          scopesTold(token.scopes),
        ].join(' · ')}
      >
        <TokenActions name={token.name} onRevoke={onRevoke} />
      </SettingsRow>
    </div>
  );
}
