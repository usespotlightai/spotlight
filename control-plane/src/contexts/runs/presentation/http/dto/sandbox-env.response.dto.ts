import { ApiProperty } from '@nestjs/swagger';
import type { SandboxEnvDto } from '@runs/application/dto/sandbox-env.dto';
import { DeniedSecretResponseDto } from '@runs/presentation/http/dto/egress.response.dto';

class SandboxEnvVariableResponseDto {
  @ApiProperty({ example: 'GITHUB_APP_PRIVATE_KEY' })
  readonly name: string;

  @ApiProperty({
    description:
      'The real value of the secret. The runner sets it in the sandbox and redacts it from what it reports',
  })
  readonly value: string;

  constructor(name: string, value: string) {
    this.name = name;
    this.value = value;
  }
}

export class SandboxEnvResponseDto {
  @ApiProperty({ type: SandboxEnvVariableResponseDto, isArray: true })
  readonly variables: readonly SandboxEnvVariableResponseDto[];

  @ApiProperty({
    type: DeniedSecretResponseDto,
    isArray: true,
    description:
      'Secrets the run cannot get, with why. The runner fails the run before setup if any is listed',
  })
  readonly denied: readonly DeniedSecretResponseDto[];

  constructor(env: SandboxEnvDto) {
    this.variables = env.variables.map(
      (each) =>
        new SandboxEnvVariableResponseDto(each.name, each.value.revealed()),
    );
    this.denied = env.denied.map(
      (each) => new DeniedSecretResponseDto(each.secret, each.reason),
    );
  }
}
