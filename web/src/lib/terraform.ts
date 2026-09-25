import { strToU8, zipSync } from 'fflate';
import type { TerraformFileResponseDto } from '@/lib/api';

const terraformModuleName = (slug: string): string => `${slug}-terraform`;

export const terraformArchiveName = (slug: string): string =>
  `${terraformModuleName(slug)}.zip`;

export function terraformArchive(
  slug: string,
  files: readonly TerraformFileResponseDto[],
): Blob {
  const folder = terraformModuleName(slug);
  const zipped = zipSync(
    Object.fromEntries(
      files.map((file) => [`${folder}/${file.path}`, strToU8(file.content)]),
    ),
  );

  return new Blob([zipped], { type: 'application/zip' });
}
