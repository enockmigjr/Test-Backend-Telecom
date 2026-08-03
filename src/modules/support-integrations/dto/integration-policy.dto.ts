import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class IntegrationTrustPolicyDto {
  @ApiPropertyOptional({ default: 90, minimum: 1, maximum: 365 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  trustedDeviceDays?: number;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  policyVersion?: number;

  @ApiPropertyOptional({ default: 7, minimum: 1, maximum: 30 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(30)
  renewalWindowDays?: number;
}

export class IntegrationQuotaPolicyDto {
  @ApiPropertyOptional({ default: 5, minimum: 1, maximum: 100 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  verificationRequestsPerHour?: number;

  @ApiPropertyOptional({ default: 10, minimum: 1, maximum: 100 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  verificationAttemptsPerHour?: number;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 1000 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000)
  verificationRequestsPerIpHour?: number;

  @ApiPropertyOptional({ default: 500, minimum: 10, maximum: 10000 })
  @IsOptional()
  @IsInt()
  @Min(10)
  @Max(10000)
  verificationRequestsPerIntegrationHour?: number;

  @ApiPropertyOptional({ default: 50, minimum: 1, maximum: 2000 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(2000)
  verificationAttemptsPerIpHour?: number;

  @ApiPropertyOptional({ default: 2000, minimum: 10, maximum: 20000 })
  @IsOptional()
  @IsInt()
  @Min(10)
  @Max(20000)
  verificationAttemptsPerIntegrationHour?: number;
}
