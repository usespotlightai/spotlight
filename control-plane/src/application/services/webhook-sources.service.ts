import type {
  HappeningDeclaration,
  WebhookSourcePort,
} from '@application/ports/webhook-source.port';

/**
 * Every host Spotlight listens to, by the name the world addresses it with.
 * A source nobody registered is not a source: a delivery to one is refused
 * rather than guessed at.
 *
 * Asked for its sources the first time somebody wants one, and not before:
 * what is registered is settled by then, and nothing here needs to know in
 * what order it was put together.
 */
export class WebhookSources {
  #byKey: ReadonlyMap<string, WebhookSourcePort> | null = null;

  constructor(
    private readonly registered: () => readonly WebhookSourcePort[],
  ) {}

  static of(sources: readonly WebhookSourcePort[]): WebhookSources {
    return new WebhookSources(() => sources);
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

  private get byKey(): ReadonlyMap<string, WebhookSourcePort> {
    this.#byKey ??= new Map(this.registered().map((each) => [each.key, each]));

    return this.#byKey;
  }
}
