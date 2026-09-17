import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AllowAnonymous } from '@platform/http/decorators/allow-anonymous.decorator';
import { HealthResponseDto } from '@platform/http/dto/health.response.dto';

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
