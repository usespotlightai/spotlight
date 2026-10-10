import { Download } from 'lucide-react';
import { SectionButton } from '@/components/shared/SectionButton';
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
    <SectionButton
      disabled={!workspaceId || download.isPending}
      onClick={() => workspaceId && download.mutate({ workspaceId, slug })}
    >
      <Download aria-hidden className="size-3.5" />
      {download.isPending ? 'Preparing Terraform…' : 'Download'}
    </SectionButton>
  );
}
