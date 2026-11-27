import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import { nonEmpty } from '@shared-kernel/domain/non-empty';

export const REQUEST_MACHINE = Symbol('REQUEST_MACHINE');

export type RequestWithMachine = { [REQUEST_MACHINE]?: string };

export const CurrentMachine = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string => {
    const machineId = context.switchToHttp().getRequest<RequestWithMachine>()[
      REQUEST_MACHINE
    ];

    if (!nonEmpty(machineId)) {
      throw new Error(
        'No machine on the request. Is the route @MachineOnly()?',
      );
    }

    return machineId;
  },
);
