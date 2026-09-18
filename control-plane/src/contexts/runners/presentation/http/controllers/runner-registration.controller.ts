import { Body, Controller, Post } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import {
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentRunner } from '@platform/http/decorators/current-runner.decorator';
import { RunnerOnly } from '@platform/http/decorators/runner-only.decorator';
import { RegisterRunnerCommand } from '@runners/application/commands/runner-fleet.commands';
import type { RegisteredRunnerDto } from '@runners/application/dto/runner.dto';
import { RegisterRunnerRequestDto } from '@runners/presentation/http/dto/register-runner.request.dto';
import { RegisteredRunnerResponseDto } from '@runners/presentation/http/dto/registered-runner.response.dto';

@ApiTags('runners')
@ApiUnauthorizedResponse({ description: 'Missing or wrong enrollment token' })
@RunnerOnly()
@Controller()
export class RunnerRegistrationController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post('runners/register')
  @ApiOperation({
    operationId: 'registerRunner',
    summary: 'Announce this runner and the harnesses it found installed',
  })
  @ApiOkResponse({ type: RegisteredRunnerResponseDto })
  async register(
    @CurrentRunner() runnerId: string,
    @Body() body: RegisterRunnerRequestDto,
  ): Promise<RegisteredRunnerResponseDto> {
    const registered = await this.commandBus.execute<
      RegisterRunnerCommand,
      RegisteredRunnerDto
    >(
      new RegisterRunnerCommand(
        runnerId,
        (body.harnesses ?? []).map((each) => ({
          id: each.id,
          models: each.models ?? [],
        })),
      ),
    );

    return new RegisteredRunnerResponseDto(registered.runnerId);
  }
}
