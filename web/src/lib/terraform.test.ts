import { strFromU8, unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { terraformArchive, terraformArchiveName } from '@/lib/terraform';

const unzipped = async (archive: Blob) =>
  Object.fromEntries(
    Object.entries(unzipSync(new Uint8Array(await archive.arrayBuffer()))).map(
      ([path, bytes]) => [path, strFromU8(bytes)],
    ),
  );

describe('terraformArchiveName', () => {
  it('names the archive after the workspace', () => {
    expect(terraformArchiveName('acme')).toBe('acme-terraform.zip');
  });
});

describe('terraformArchive', () => {
  it('zips every exported file at its path inside the module folder, byte for byte', async () => {
    const archive = terraformArchive('acme', [
      {
        path: 'main.tf',
        content: 'resource "spotlight_workspace" "acme" {}\n',
      },
      { path: 'variables.tf', content: '' },
      {
        path: 'prompts/platform/delivery/triage.md',
        content: 'Sort it — then hand over.\n',
      },
    ]);

    expect(archive.type).toBe('application/zip');
    expect(await unzipped(archive)).toEqual({
      'acme-terraform/main.tf': 'resource "spotlight_workspace" "acme" {}\n',
      'acme-terraform/variables.tf': '',
      'acme-terraform/prompts/platform/delivery/triage.md':
        'Sort it — then hand over.\n',
    });
  });
});
