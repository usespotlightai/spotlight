import type {
  HappeningDeclaration,
  WebhookSourcePort,
} from '@application/ports/webhook-source.port';

/**
 * Every host Spotlight listens to, by the name the world addresses it with.
 * A source nobody registered is not a source: a delivery to one is refused
 * rather than guessed at.
 */
export class WebhookSources {
  private readonly byKey: ReadonlyMap<string, WebhookSourcePort>;

  constructor(sources: readonly WebhookSourcePort[]) {
    this.byKey = new Map(sources.map((each) => [each.key, each]));
  }

  find(key: string): WebhookSourcePort | null {
    return this.byKey.get(key) ?? null;
  }

  get all(): readonly WebhookSourcePort[] {
    return [...this.byKey.values()];
  }

  /**
   * Every word anybody here raises. A station can only be set to wait for one
   * of these, so nothing waits on a word nobody says.
   */
  get happenings(): readonly HappeningDeclaration[] {
    return this.all.flatMap((each) => [...each.happenings]);
  }
}
