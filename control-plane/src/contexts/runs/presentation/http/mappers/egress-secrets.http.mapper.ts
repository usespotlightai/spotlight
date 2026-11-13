import type { FetchedEgressSecrets } from '@runs/application/dto/egress-secrets.dto';
import type { HarnessKeysDto } from '@runs/application/dto/harness-keys.dto';
import type { RedeemedCallSecrets } from '@runs/application/dto/host-call.dto';
import {
  DeniedSecretResponseDto,
  EgressSecretsResponseDto,
  ExternalSecretRefResponseDto,
  FetchedSecretResponseDto,
  HarnessKeysResponseDto,
  SpotlightApiResponseDto,
} from '@runs/presentation/http/dto/egress.response.dto';
import type {
  DeniedSecret,
  FetchedSecret,
} from '@secrets/application/contracts/run-secret-fetch.contract';

const fetchedOf = (each: FetchedSecret): FetchedSecretResponseDto =>
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
  );

const deniedOf = (each: DeniedSecret): DeniedSecretResponseDto =>
  new DeniedSecretResponseDto(each.secret, each.reason);

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

  toHarnessKeysResponse(
    fetched: Extract<HarnessKeysDto, { readonly outcome: 'fetched' }>,
  ): HarnessKeysResponseDto {
    return new HarnessKeysResponseDto(
      fetched.bound,
      fetched.secrets.map(fetchedOf),
      fetched.denied.map(deniedOf),
    );
  },

  toResponse(fetched: FetchedEgressSecrets): EgressSecretsResponseDto {
    return new EgressSecretsResponseDto(
      fetched.runId,
      fetched.extraAllowedHosts,
      fetched.bound,
      fetched.secrets.map(fetchedOf),
      fetched.denied.map(deniedOf),
      fetched.spotlightApi
        ? new SpotlightApiResponseDto(fetched.spotlightApi.sealed)
        : null,
    );
  },
};
