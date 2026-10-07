import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useDownloadTerraform } from '@/hooks/api/useDownloadTerraform';

type DownloadTerraformButtonProps = {
  workspaceId: string | undefined;
  slug: string;
};

export function DownloadTerraformButton({
  workspaceId,
  slug,
}: DownloadTerraformButtonProps) {
  const download = useDownloadTerraform();

  return (
    <Button
      variant="outline"
      size="sm"
      className="rounded-full border-border bg-card px-3 shadow-none"
      disabled={!workspaceId || download.isPending}
      onClick={() => workspaceId && download.mutate({ workspaceId, slug })}
    >
      <Download aria-hidden className="size-3.5" />
      {download.isPending ? 'Preparing Terraform…' : 'Download'}
    </Button>
  );
}
