import { PillButton } from '@/components/shared/PillButton';
import { useDisconnect } from '@/hooks/api/useDisconnect';

type DisconnectButtonProps = {
  teamId: string;
  source: string;
  name: string;
};

export function DisconnectButton({
  teamId,
  source,
  name,
}: DisconnectButtonProps) {
  const disconnect = useDisconnect(teamId);

  return (
    <PillButton
      aria-label={`Disconnect ${name}`}
      disabled={disconnect.isPending}
      onClick={() => disconnect.mutate(source)}
    >
      {disconnect.isPending ? 'Disconnecting…' : 'Disconnect'}
    </PillButton>
  );
}
