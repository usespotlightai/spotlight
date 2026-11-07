import type { FetchedEgressSecrets } from '@runs/application/dto/egress-secrets.dto';
import type { RedeemedCallSecrets } from '@runs/application/dto/host-call.dto';
import {
  DeniedSecretResponseDto,
  EgressSecretsResponseDto,
  ExternalSecretRefResponseDto,
  FetchedSecretResponseDto,
  SpotlightApiResponseDto,
} from '@runs/presentation/http/dto/egress.response.dto';

export const EgressSecretsHttpMapper = {
  toRedeemedResponse(redeemed: RedeemedCallSecrets): EgressSecretsResponseDto {
    return EgressSecretsHttpMapper.toResponse({
      outcome: 'fetched',
      runId: redeemed.callId,
      extraAllowedHosts: [],
      bound: redeemed.bound,
      secrets: redeemed.secrets,
      denied: redeemed.denied,
      spotlightApi: null,
    });
  },

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
