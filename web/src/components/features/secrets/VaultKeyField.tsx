import { Eye } from 'lucide-react';
import { CopyButton } from '@/components/shared/CopyButton';
import { ValueField } from '@/components/shared/ValueField';
import { Button } from '@/components/ui/button';
import { useRevealVaultKey } from '@/hooks/api/useRevealVaultKey';

const HIDDEN = '•'.repeat(32);

type VaultKeyFieldProps = {
  teamId: string;
};

export function VaultKeyField({ teamId }: VaultKeyFieldProps) {
  const reveal = useRevealVaultKey(teamId);

  if (reveal.data === null) {
    return (
      <p className="text-muted-foreground text-sm">
        Only owners and admins can see the vault key.
      </p>
    );
  }

  if (reveal.isError) {
    return (
      <p className="text-muted-foreground text-sm">
        The vault key could not be loaded. Try again.
      </p>
    );
  }

  const shown = reveal.data?.key;

  return (
    <ValueField value={shown ?? HIDDEN} className="w-72">
      {shown ? (
        <CopyButton value={shown} label="Copy the vault key" />
      ) : (
        <Button
          variant="outline"
          size="sm"
          type="button"
          onClick={() => reveal.mutate()}
          disabled={reveal.isPending}
          className="shrink-0 bg-card"
        >
          <Eye className="size-3.5" aria-hidden />
          Reveal
        </Button>
      )}
    </ValueField>
  );
}
