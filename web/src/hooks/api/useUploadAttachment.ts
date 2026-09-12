import { useMutation } from '@tanstack/react-query';
import { grantAttachmentUpload } from '@/lib/api';

type UploadAttachmentInput = {
  slug: string;
  file: File;
};

const grant = async (slug: string, file: File) => {
  const { data } = await grantAttachmentUpload({
    path: { slug },
    body: {
      name: file.name,
      contentType: file.type || 'application/octet-stream',
      size: file.size,
    },
    throwOnError: true,
  });

  return data;
};

export function useUploadAttachment() {
  return useMutation({
    mutationFn: async ({ slug, file }: UploadAttachmentInput) => {
      const { id, url, headers } = await grant(slug, file);

      // Exactly the headers it was signed with, or storage refuses it.
      const put = await fetch(url, { method: 'PUT', headers, body: file });

      if (!put.ok) {
        throw new Error(`Storage refused the upload (${put.status})`);
      }

      return { id };
    },
  });
}
