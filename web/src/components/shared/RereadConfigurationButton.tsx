import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRereadConfiguration } from '@/hooks/api/useConfiguration';

type RereadConfigurationButtonProps = {
  teamId: string | undefined;
};

export function RereadConfigurationButton({
  teamId,
}: RereadConfigurationButtonProps) {
  const reread = useRereadConfiguration(teamId);

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => reread.mutate()}
      disabled={reread.isPending}
      className="rounded-full bg-card shadow-none"
    >
      <RefreshCw className="size-3.5" aria-hidden />
      {reread.isPending ? 'Reading…' : 'Read again'}
    </Button>
  );
}
