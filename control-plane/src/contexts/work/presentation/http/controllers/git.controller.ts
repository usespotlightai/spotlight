import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiExcludeController } from '@nestjs/swagger';
import { CurrentMachine } from '@platform/http/decorators/current-machine.decorator';
import { MachineOnly } from '@platform/http/decorators/machine-only.decorator';
import { CarryGitCallCommand } from '@work/application/commands/carry-git-call.command';
import {
  GIT_SERVICES,
  type GitAnswerDto,
  type GitService,
} from '@work/application/dto/git-call.dto';

const isService = (value: string): value is GitService =>
  GIT_SERVICES.includes(value as GitService);

interface Incoming extends AsyncIterable<Uint8Array> {
  headers: Record<string, string | string[] | undefined>;
}

interface Outgoing {
  status(code: number): Outgoing;
  setHeader(name: string, value: string): void;
  write(chunk: Uint8Array): boolean;
  end(): void;
}

@ApiExcludeController()
@Controller('git/:runId/:repo')
@MachineOnly()
export class GitController {
  constructor(private readonly commandBus: CommandBus) {}

  @Get('info/refs')
  async advertise(
    @Param('runId') runId: string,
    @Param('repo') repo: string,
    @Query('service') service: string,
    @CurrentMachine() runnerId: string,
    @Req() request: Incoming,
    @Res() response: Outgoing,
  ): Promise<void> {
    if (!service || !isService(service)) {
      throw new BadRequestException('unsupported git service');
    }

    await this.answer(
      await this.carried(runId, runnerId, repo, service, {
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
    @CurrentMachine() runnerId: string,
    @Req() request: Incoming,
    @Res() response: Outgoing,
  ): Promise<void> {
    if (!isService(service)) {
      throw new NotFoundException();
    }

    await this.answer(
      await this.carried(runId, runnerId, repo, service, {
        method: 'POST',
        path: `/${service}`,
        search: '',
        headers: request.headers,
        body: request,
      }),
      response,
    );
  }

  private carried(
    runId: string,
    runnerId: string,
    repo: string,
    service: GitService,
    call: CarryGitCallCommand['call'],
  ): Promise<GitAnswerDto | null> {
    return this.commandBus.execute(
      new CarryGitCallCommand(runId, runnerId, repo, service, call),
    );
  }

  private async answer(
    answered: GitAnswerDto | null,
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
