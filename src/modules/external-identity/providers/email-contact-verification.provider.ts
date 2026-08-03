import { Injectable } from '@nestjs/common';
import { EmailService } from '../../email/email.service';
import { ContactVerificationProvider } from './contact-verification-provider.interface';

@Injectable()
export class EmailContactVerificationProvider implements ContactVerificationProvider {
  constructor(private readonly email: EmailService) {}

  async sendEmailCode(destination: string, code: string, expiresInSeconds: number): Promise<void> {
    await this.email.sendTemplate(destination, 'Votre code de vérification', 'otp', {
      otpCode: code,
      expiresIn: `${Math.ceil(expiresInSeconds / 60)} minutes`,
    });
  }
}
