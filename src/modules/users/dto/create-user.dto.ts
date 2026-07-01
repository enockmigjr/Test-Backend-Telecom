import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, IsUUID, IsIn, MaxLength } from 'class-validator';

const VALID_ROLES = [
  'ADMINISTRATOR',
  'SUPERVISOR',
  'CUSTOMER_SERVICE_AGENT',
  'NOC_ENGINEER',
  'BILLING_AGENT',
  'TECHNICAL_SUPPORT_ENGINEER',
  'FIELD_TECHNICIAN',
] as const;

export class CreateUserDto {
  @ApiProperty({ description: 'Adresse email professionnelle', example: 'agent@telecom.local', format: 'email' })
  @IsEmail({}, { message: "L'adresse email fournie n'est pas valide." })
  email: string;

  @ApiProperty({ description: 'Prénom', example: 'Jean' })
  @IsString({ message: 'Le prénom est requis.' })
  @MaxLength(100)
  firstName: string;

  @ApiProperty({ description: 'Nom de famille', example: 'Dupont' })
  @IsString({ message: 'Le nom de famille est requis.' })
  @MaxLength(100)
  lastName: string;

  @ApiProperty({ description: 'Rôle', enum: VALID_ROLES, example: 'CUSTOMER_SERVICE_AGENT' })
  @IsString()
  @IsIn(VALID_ROLES, { message: 'Rôle invalide.' })
  role: string;

  @ApiProperty({ description: 'ID du département (UUID)', example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsUUID('all')
  departmentId: string;
}
