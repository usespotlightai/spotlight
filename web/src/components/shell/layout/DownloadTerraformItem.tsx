import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { useDownloadTerraform } from '@/hooks/api/useDownloadTerraform';

type DownloadTerraformItemProps = {
  workspaceId: string;
  slug: string;
  onDownloaded: () => void;
};

export function DownloadTerraformItem({
  workspaceId,
  slug,
  onDownloaded,
}: DownloadTerraformItemProps) {
  const download = useDownloadTerraform();

  return (
    <DropdownMenuItem
      closeOnClick={false}
      disabled={download.isPending}
      onClick={() =>
        download.mutate({ workspaceId, slug }, { onSuccess: onDownloaded })
      }
    >
      {download.isPending
        ? 'Preparing Terraform…'
        : download.isError
          ? 'Could not download. Try again'
          : 'Download as Terraform'}
    </DropdownMenuItem>
  );
}
