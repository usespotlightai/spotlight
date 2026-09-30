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
import { useLingering } from '@/hooks/useLingering';
import { messageOf } from '@/lib/error';
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
  const asked = useLingering(token, CLOSING_MS);

  return (
    <Dialog
      open={token !== null}
      onOpenChange={(open) => !open && onClose()}
      onOpenChangeComplete={(settled) => !settled && revoke.reset()}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Revoke {asked?.name}?</DialogTitle>
          <DialogDescription>
            Whatever uses this token is refused from this moment. It can’t be
            undone; create another token to replace it.
          </DialogDescription>
        </DialogHeader>

        {revoke.isError && (
          <p role="alert" className="text-destructive text-xs">
            {messageOf(revoke.error, 'Could not revoke the token')}
          </p>
        )}

        <DialogFooter>
          <DialogClose render={<Button variant="outline" size="sm" />}>
            Keep it
          </DialogClose>
          <Button
            variant="destructive"
            size="sm"
            disabled={!token || revoke.isPending}
            onClick={() =>
              token && revoke.mutate(token, { onSuccess: onClose })
            }
          >
            {revoke.isPending ? 'Revoking…' : 'Revoke token'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
