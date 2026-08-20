export class GreetingResponseDto {
  readonly message: string;

  constructor(message: string) {
    this.message = message;
  }
}
