import { Type } from 'class-transformer';
import { IsInt, Matches, Min } from 'class-validator';

export class SignedReportDownloadQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  declare expires: number;

  @Matches(/^[A-Za-z0-9_-]{43}$/)
  declare signature: string;
}
