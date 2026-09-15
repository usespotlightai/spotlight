export const ContinuityKey = {
  for({ taskId, stationId }: { taskId: string; stationId: string }): string {
    return `${taskId}-${stationId}`;
  },

  forChat(chatId: string): string {
    return `chat-${chatId}`;
  },
};
