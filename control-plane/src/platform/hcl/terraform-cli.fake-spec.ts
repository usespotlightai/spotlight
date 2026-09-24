import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export const TERRAFORM_INSTALLED =
  spawnSync('terraform', ['version'], { encoding: 'utf8' }).status === 0;

export const formattedByTerraform = (hcl: string): string => {
  const formatted = spawnSync('terraform', ['fmt', '-'], {
    input: hcl,
    encoding: 'utf8',
  });

  if (formatted.status !== 0) {
    throw new Error(formatted.stderr);
  }

  return formatted.stdout;
};

export const evaluatedByTerraform = (
  hcl: string,
  expression: string,
): unknown => {
  const module = mkdtempSync(join(tmpdir(), 'hcl-'));

  try {
    writeFileSync(join(module, 'main.tf'), hcl);
    const evaluated = spawnSync('terraform', ['console'], {
      cwd: module,
      input: `jsonencode(${expression})\n`,
      encoding: 'utf8',
    });

    if (evaluated.status !== 0) {
      throw new Error(evaluated.stderr);
    }

    return JSON.parse(JSON.parse(evaluated.stdout));
  } finally {
    rmSync(module, { recursive: true, force: true });
  }
};
