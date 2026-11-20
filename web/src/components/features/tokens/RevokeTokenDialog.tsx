import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useRevokeWorkspaceToken } from '@/hooks/api/useRevokeWorkspaceToken';
import { useDelayedValue } from '@/hooks/useDelayedValue';
import type { WorkspaceToken } from '@/lib/token';

const CLOSING_MS = 150;

type RevokeTokenDialogProps = {
  workspaceId: string | undefined;
  token: WorkspaceToken | null;
  onClose: () => void;
};

export function RevokeTokenDialog({
  workspaceId,
  token,
  onClose,
}: RevokeTokenDialogProps) {
  const revoke = useRevokeWorkspaceToken(workspaceId);
  const shown = useDelayedValue(token, CLOSING_MS);
  const revoking = revoke.isPending || revoke.isSuccess;

  return (
    <Dialog
      open={token !== null}
      onOpenChange={(open) => !open && onClose()}
      onOpenChangeComplete={(open) => !open && revoke.reset()}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Revoke {shown?.name}?</DialogTitle>
          <DialogDescription>
            Spotlight immediately stops accepting this token. You can’t undo
            this.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" size="sm" />}>
            Keep it
          </DialogClose>
          <Button
            variant="destructive"
            size="sm"
            disabled={!token || revoking}
            onClick={() =>
              token && revoke.mutate(token, { onSuccess: onClose })
            }
          >
            {revoking ? 'Revoking…' : 'Revoke token'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
