import { ApiProperty } from '@nestjs/swagger';

export class PublicSuccessResponseDto {
  @ApiProperty({ type: Boolean, enum: [true] })
  success: boolean;

  @ApiProperty({ minimum: 200, maximum: 299 })
  statusCode: number;
}

export class PublicPaginationMetaDto {
  @ApiProperty({ minimum: 1 })
  page: number;

  @ApiProperty({ minimum: 1, maximum: 100 })
  limit: number;

  @ApiProperty({ minimum: 0 })
  total: number;

  @ApiProperty({ minimum: 0 })
  totalPages: number;
}
