export interface ChannelDeliveryInput {
  readonly deliveryId: string;
  readonly destination: string;
  readonly eventType: string;
  readonly ticketNumber?: string;
}

export interface ChannelDeliveryResult {
  readonly providerMessageId?: string;
}

export interface ChannelAdapter {
  deliver(input: ChannelDeliveryInput): Promise<ChannelDeliveryResult>;
}

export const EMAIL_CHANNEL_ADAPTER = Symbol('EMAIL_CHANNEL_ADAPTER');
