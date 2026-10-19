import { Injectable, type OnApplicationShutdown } from '@nestjs/common';
import { stopOpenTelemetry } from '@platform/telemetry/open-telemetry';

@Injectable()
export class TelemetryShutdown implements OnApplicationShutdown {
  onApplicationShutdown(): Promise<void> {
    return stopOpenTelemetry();
  }
}
