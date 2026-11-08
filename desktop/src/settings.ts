import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DEFAULT_ADDRESS, originOf } from './links';

interface Settings {
  readonly address: string;
}

export class SettingsFile {
  private readonly path: string;

  constructor(directory: string) {
    this.path = join(directory, 'settings.json');
  }

  origin(): string {
    try {
      const stored = JSON.parse(readFileSync(this.path, 'utf8')) as Settings;

      return originOf(stored.address) ?? DEFAULT_ADDRESS;
    } catch {
      return DEFAULT_ADDRESS;
    }
  }

  save(address: string): string | null {
    const origin = originOf(address);

    if (!origin) {
      return null;
    }

    try {
      writeFileSync(this.path, JSON.stringify({ address: origin }, null, 2));
    } catch {
      return null;
    }

    return origin;
  }
}
