import type { Credential } from '@secrets/application/contracts/credential.contract';

export interface SandboxEnvDto {
  readonly variables: readonly {
    readonly name: string;
    readonly value: Credential;
  }[];
  readonly denied: readonly {
    readonly secret: string;
    readonly reason: string;
  }[];
}
