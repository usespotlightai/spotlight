import { SettingsRow } from '@/components/features/settings/SettingsRow';
import { Button } from '@/components/ui/button';
import { since } from '@/lib/runner';
import { expiryTold, scopesTold, type WorkspaceToken } from '@/lib/token';

type TokenRowProps = {
  token: WorkspaceToken;
  onRevoke: () => void;
};

export function TokenRow({ token, onRevoke }: TokenRowProps) {
  return (
    <SettingsRow
      label={token.name}
      description={
        <>
          {token.description && (
            <span className="block">{token.description}</span>
          )}
          <span className="block">
            {scopesTold(token.scopes)} · {expiryTold(token.expiresAt)} · Created{' '}
            {since(token.issuedAt)}
          </span>
        </>
      }
    >
      <Button
        variant="ghost"
        size="sm"
        aria-label={`Revoke ${token.name}`}
        onClick={onRevoke}
      >
        Revoke
      </Button>
    </SettingsRow>
  );
}
