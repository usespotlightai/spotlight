import { Button } from '@/components/ui/button';
import { useDecideDevice } from '@/hooks/api/useDecideDevice';
import { shownUserCode } from '@/lib/device';

type DecideDeviceProps = {
  userCode: string;
};

export function DecideDevice({ userCode }: DecideDeviceProps) {
  const decide = useDecideDevice(userCode);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-center font-medium text-2xl text-foreground tracking-widest">
        {shownUserCode(userCode)}
      </p>

      <div className="flex justify-center gap-2">
        <Button
          variant="outline"
          size="lg"
          className="rounded-full bg-card px-6 shadow-none"
          disabled={decide.isPending}
          onClick={() => decide.mutate('deny')}
        >
          Deny
        </Button>
        <Button
          size="lg"
          className="rounded-full px-6"
          disabled={decide.isPending}
          onClick={() => decide.mutate('approve')}
        >
          {decide.isPending && decide.variables === 'approve'
            ? 'Approving…'
            : 'Approve'}
        </Button>
      </div>

      {decide.isError && (
        <p role="alert" className="text-center text-destructive text-sm">
          {decide.error.message}
        </p>
      )}
    </div>
  );
}
