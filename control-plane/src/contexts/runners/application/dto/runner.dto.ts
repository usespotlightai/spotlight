export interface RegisteredRunnerDto {
  readonly runnerId: string;
}

export interface EnrolledRunnerDto {
  readonly runnerId: string;
  readonly name: string;
  readonly token: string;
}

export interface ExchangedTokenDto {
  readonly runnerId: string;
  readonly token: string;
}
