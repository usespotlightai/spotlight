import type {
  HarnessKeySource,
  HarnessKeysPort,
} from '@secrets/application/ports/harness-keys.port';

export class HarnessKeysRegistry implements HarnessKeysPort {
  private readonly sources: HarnessKeySource[] = [];

  register(source: HarnessKeySource): void {
    this.sources.push(source);
  }

  names(): readonly string[] {
    return [...new Set(this.sources.flatMap((each) => each.names()))];
  }
}
