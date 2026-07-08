export interface QuickReply {
  title: string;
  payload: string;
}

export interface MessagingProvider {
  getName(): string;
  sendMessage(recipientId: string, text: string): Promise<void>;
  sendQuickReplies(recipientId: string, text: string, replies: QuickReply[]): Promise<void>;
}
