import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class BotMessageDto {
  @ApiProperty({ example: 'Ma ligne coupe depuis hier.' })
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  message: string;
}
