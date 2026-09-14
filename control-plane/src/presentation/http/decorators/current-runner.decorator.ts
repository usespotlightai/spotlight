import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { RunnerRequest } from '@presentation/http/guards/runner.guard';

export const CurrentRunner = createParamDecorator(
  (_: unknown, context: ExecutionContext): string =>
    context.switchToHttp().getRequest<RunnerRequest>().runnerId as string,
);
