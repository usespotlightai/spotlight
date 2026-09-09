import {
  GIT_GATEWAY,
  type GitGatewayPort,
} from '@application/ports/git-gateway.port';
import type { GitAnswer } from '@application/ports/repository-git.port';
import {
  BadRequestException,
  Controller,
  Get,
  Inject,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { CurrentRunner } from '@presentation/http/decorators/current-runner.decorator';
import { RunnerOnly } from '@presentation/http/decorators/runner-only.decorator';

const SERVICES = ['git-upload-pack', 'git-receive-pack'] as const;

type Service = (typeof SERVICES)[number];

const isService = (value: string): value is Service =>
  SERVICES.includes(value as Service);

interface Incoming extends AsyncIterable<Uint8Array> {
  headers: Record<string, string | string[] | undefined>;
}

interface Outgoing {
  status(code: number): Outgoing;
  setHeader(name: string, value: string): void;
  write(chunk: Uint8Array): boolean;
  end(): void;
}

/**
 * The runner authenticates as itself; what reaches GitHub belongs to the
 * control plane, so no repository credential lives on the machine.
 */
@ApiExcludeController()
@Controller('git/:runId/:repo')
@RunnerOnly()
export class GitController {
  constructor(@Inject(GIT_GATEWAY) private readonly gateway: GitGatewayPort) {}

  @Get('info/refs')
  async advertise(
    @Param('runId') runId: string,
    @Param('repo') repo: string,
    @Query('service') service: string,
    @CurrentRunner() runnerId: string,
    @Req() request: Incoming,
    @Res() response: Outgoing,
  ): Promise<void> {
    if (!service || !isService(service)) {
      throw new BadRequestException('unsupported git service');
    }

    await this.answer(
      await this.gateway.carry(runId, runnerId, repo, {
        method: 'GET',
        path: '/info/refs',
        search: `?service=${service}`,
        headers: request.headers,
        body: null,
      }),
      response,
    );
  }

  @Post(':service')
  async pack(
    @Param('runId') runId: string,
    @Param('repo') repo: string,
    @Param('service') service: string,
    @CurrentRunner() runnerId: string,
    @Req() request: Incoming,
    @Res() response: Outgoing,
  ): Promise<void> {
    if (!isService(service)) {
      throw new NotFoundException();
    }

    await this.answer(
      await this.gateway.carry(runId, runnerId, repo, {
        method: 'POST',
        path: `/${service}`,
        search: '',
        headers: request.headers,
        body: request,
      }),
      response,
    );
  }

  private async answer(
    answered: GitAnswer | null,
    response: Outgoing,
  ): Promise<void> {
    if (!answered) {
      throw new NotFoundException('this run works no repository');
    }

    response.status(answered.status);
    for (const [name, value] of Object.entries(answered.headers)) {
      response.setHeader(name, value);
    }

    if (answered.body) {
      for await (const chunk of answered.body) {
        response.write(chunk);
      }
    }

    response.end();
  }
}
