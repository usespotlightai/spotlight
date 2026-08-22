export interface CommandHandlerPort<TCommand, TResult> {
  execute(command: TCommand): Promise<TResult>;
}
