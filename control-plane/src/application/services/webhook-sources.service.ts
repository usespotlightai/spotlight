import type {
  HappeningDeclaration,
  WebhookSourcePort,
} from '@application/ports/webhook-source.port';

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

  get happenings(): readonly HappeningDeclaration[] {
    return this.all.flatMap((each) => [...each.happenings]);
  }

  private get byKey(): ReadonlyMap<string, WebhookSourcePort> {
    // Resolved lazily: sources are only all registered once the app is assembled.
    this.#byKey ??= new Map(this.registered().map((each) => [each.key, each]));

    return this.#byKey;
  }
}
