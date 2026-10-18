import type {
  HappeningDeclaration,
  WebhookProviderPort,
} from '@integrations/application/ports/webhook-provider.port';

export class WebhookProviders {
  #byKey: ReadonlyMap<string, WebhookProviderPort> | null = null;

  constructor(
    private readonly registered: () => readonly WebhookProviderPort[],
  ) {}

  static of(providers: readonly WebhookProviderPort[]): WebhookProviders {
    return new WebhookProviders(() => providers);
  }

  find(key: string): WebhookProviderPort | null {
    return this.byKey.get(key) ?? null;
  }

  get all(): readonly WebhookProviderPort[] {
    return [...this.byKey.values()];
  }

  get happenings(): readonly HappeningDeclaration[] {
    return this.all.flatMap((each) => [...each.happenings]);
  }

  private get byKey(): ReadonlyMap<string, WebhookProviderPort> {
    this.#byKey ??= new Map(this.registered().map((each) => [each.key, each]));

    return this.#byKey;
  }
}
