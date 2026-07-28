import { Global, Module } from '@nestjs/common';
import { TelecomWebSocketGateway } from './websocket.gateway';
import { AuthModule } from '../modules/auth/auth.module';
import { WebSocketAuthService } from './websocket-auth.service';

@Global()
@Module({
  imports: [AuthModule],
  providers: [TelecomWebSocketGateway, WebSocketAuthService],
  exports: [TelecomWebSocketGateway],
})
export class WebSocketModule {}
