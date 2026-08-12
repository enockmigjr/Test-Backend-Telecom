import { BadRequestException } from '@nestjs/common';
import { SavePublicTicketDraftDto } from '../dto/public-conversation.dto';
import { PublicTicketDraft } from '../interfaces/public-admission.interface';
import { isRecord } from '../../../common/utils/helpers';

export function normalizeDraft(dto: SavePublicTicketDraftDto): PublicTicketDraft {
  return {
    categoryId: dto.categoryId,
    title: dto.title.trim(),
    description: dto.description.trim(),
    impact: dto.impact,
    urgency: dto.urgency,
    ...(dto.customerAccountNumber ? { customerAccountNumber: dto.customerAccountNumber.trim() } : {}),
    ...(dto.serviceKey ? { serviceKey: dto.serviceKey.trim() } : {}),
  };
}

export function parseDraft(value: unknown): PublicTicketDraft {
  if (!isRecord(value)) throw new BadRequestException('Le brouillon doit être complété avant confirmation.');
  const dto = Object.assign(new SavePublicTicketDraftDto(), value);
  const valid =
    typeof dto.categoryId === 'string' &&
    typeof dto.title === 'string' &&
    typeof dto.description === 'string' &&
    isLevel(dto.impact) &&
    isLevel(dto.urgency);
  if (!valid) throw new BadRequestException('Le brouillon enregistré est invalide.');
  return normalizeDraft(dto);
}

export function publicDraft(value: unknown): PublicTicketDraft | null {
  try {
    return parseDraft(value);
  } catch {
    return null;
  }
}

function isLevel(value: unknown): value is 'LOW' | 'MEDIUM' | 'HIGH' {
  return value === 'LOW' || value === 'MEDIUM' || value === 'HIGH';
}
