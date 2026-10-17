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
      onOpenChangeComplete={(open) => !open && revoke.reset()}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Revoke {asked?.name}?</DialogTitle>
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
