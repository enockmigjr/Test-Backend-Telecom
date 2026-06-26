import { Global, Module } from '@nestjs/common';
import { TelecomWebSocketGateway } from './websocket.gateway';

@Global()
@Module({
  providers: [TelecomWebSocketGateway],
  exports: [TelecomWebSocketGateway],
})
export class WebSocketModule {}
