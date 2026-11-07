import type {
  HappeningDeclaration,
  WebhookProviderPort,
} from '@integrations/application/ports/webhook-provider.port';
import type { IntegrationKey } from '@integrations/domain/value-objects/integration-key.vo';

export class WebhookProviders {
  #byKey: ReadonlyMap<string, WebhookProviderPort> | null = null;

  constructor(
    private readonly registered: () => readonly WebhookProviderPort[],
  ) {}

  static of(providers: readonly WebhookProviderPort[]): WebhookProviders {
    return new WebhookProviders(() => providers);
  }

  find(key: IntegrationKey): WebhookProviderPort | null {
    return this.byKey.get(key.value) ?? null;
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
