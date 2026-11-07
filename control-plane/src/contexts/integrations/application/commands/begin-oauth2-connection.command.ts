import type { ActsAsKind } from '@integrations/domain/value-objects/acts-as.vo';

export class BeginOAuth2ConnectionCommand {
  constructor(
    readonly teamId: string,
    readonly integration: string,
    readonly viewerId: string,
    readonly actsAs: ActsAsKind | null,
    readonly returnTo: string | null,
  ) {}
}
