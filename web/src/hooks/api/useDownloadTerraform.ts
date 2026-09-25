import { useMutation } from '@tanstack/react-query';
import { exportWorkspace } from '@/lib/api';
import { saveFile } from '@/lib/download';
import { terraformArchive, terraformArchiveName } from '@/lib/terraform';

type DownloadTerraformInput = { workspaceId: string; slug: string };

export function useDownloadTerraform() {
  return useMutation({
    mutationFn: async ({ workspaceId, slug }: DownloadTerraformInput) => {
      const { data } = await exportWorkspace({
        path: { id: workspaceId },
        throwOnError: true,
      });

      saveFile(terraformArchive(slug, data.files), terraformArchiveName(slug));
    },
  });
}
