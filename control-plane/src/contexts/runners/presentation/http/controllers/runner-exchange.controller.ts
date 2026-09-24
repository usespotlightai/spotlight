import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import {
  ApiConflictResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AllowAnonymous } from '@platform/http/decorators/allow-anonymous.decorator';
import { ExchangeWorkloadTokenCommand } from '@runners/application/commands/runner-resource.commands';
import type { ExchangedTokenDto } from '@runners/application/dto/runner.dto';
import { ExchangeWorkloadTokenRequestDto } from '@runners/presentation/http/dto/exchange-workload-token.request.dto';
import { ExchangedTokenResponseDto } from '@runners/presentation/http/dto/exchanged-token.response.dto';

@ApiTags('runners')
@Controller()
export class RunnerExchangeController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post('runners/exchange')
  @AllowAnonymous()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    operationId: 'exchangeWorkloadToken',
    summary:
      'Enrol a runner with the token its platform issued it, and answer the runner token it calls with',
  })
  @ApiOkResponse({ type: ExchangedTokenResponseDto })
  @ApiUnauthorizedResponse({
    description: 'No such trust, or the token is not one it admits',
  })
  @ApiConflictResponse({
    description: 'A runner outside this trust already has that name',
  })
  async exchange(
    @Body() body: ExchangeWorkloadTokenRequestDto,
  ): Promise<ExchangedTokenResponseDto> {
    const exchanged = await this.commandBus.execute<
      ExchangeWorkloadTokenCommand,
      ExchangedTokenDto | null
    >(
      new ExchangeWorkloadTokenCommand(
        String(body?.trust ?? ''),
        String(body?.token ?? ''),
        String(body?.name ?? ''),
      ),
    );

    if (!exchanged) {
      throw new UnauthorizedException();
    }

    return new ExchangedTokenResponseDto(exchanged.runnerId, exchanged.token);
  }
}
