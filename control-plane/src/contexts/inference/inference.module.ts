import { IdentityModule } from '@identity/identity.module';
import { INFERENCE_ENDPOINT_CONFIGURATION } from '@inference/application/ports/inference-endpoint-configuration.port';
import {
  INFERENCE_CONTROLLERS,
  INFERENCE_PROVIDERS,
} from '@inference/inference.wiring';
import { Module } from '@nestjs/common';
import { SecretsModule } from '@secrets/secrets.module';
import { INFERENCE_CALLS } from '@shared-kernel/application/ports/inference-calls.port';

@Module({
  imports: [IdentityModule, SecretsModule],
  controllers: [...INFERENCE_CONTROLLERS],
  providers: [...INFERENCE_PROVIDERS],
  exports: [INFERENCE_CALLS, INFERENCE_ENDPOINT_CONFIGURATION],
})
export class InferenceModule {}
