import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { HealthResponseDto } from '@presentation/http/dto/health.response.dto';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';

@ApiTags('health')
@Controller('health')
export class HealthController {
  @Get()
  @AllowAnonymous()
  @ApiOperation({ operationId: 'getHealth', summary: 'Liveness probe' })
  @ApiOkResponse({ type: HealthResponseDto })
  handle(): HealthResponseDto {
    return new HealthResponseDto();
  }
}
