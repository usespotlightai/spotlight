import type { FetchedEgressSecrets } from '@work/application/dto/egress-secrets.dto';
import {
  DeniedSecretResponseDto,
  EgressSecretsResponseDto,
  ExternalSecretRefResponseDto,
  FetchedSecretResponseDto,
  SpotlightApiResponseDto,
} from '@work/presentation/http/dto/egress.response.dto';

export const EgressSecretsHttpMapper = {
  toResponse(fetched: FetchedEgressSecrets): EgressSecretsResponseDto {
    return new EgressSecretsResponseDto(
      fetched.runId,
      fetched.extraAllowedHosts,
      fetched.bound,
      fetched.secrets.map(
        (each) =>
          new FetchedSecretResponseDto(
            each.secret,
            each.host,
            each.location,
            each.name,
            each.prefix,
            each.sealed,
            each.externalRef
              ? new ExternalSecretRefResponseDto(
                  each.externalRef.kind,
                  each.externalRef.secretId,
                  each.externalRef.field,
                )
              : null,
          ),
      ),
      fetched.denied.map(
        (each) => new DeniedSecretResponseDto(each.secret, each.reason),
      ),
      fetched.spotlightApi
        ? new SpotlightApiResponseDto(fetched.spotlightApi.sealed)
        : null,
    );
  },
};
