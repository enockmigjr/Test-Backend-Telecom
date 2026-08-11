import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class BotReplyDto {
  @ApiProperty({ enum: ['disabled', 'unavailable', 'reply'] })
  mode: string;

  @ApiPropertyOptional({ nullable: true })
  reply?: string | null;

  @ApiProperty({ type: [String] })
  suggestedActions: string[];
}
