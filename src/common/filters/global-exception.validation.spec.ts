import { ArgumentsHost, BadRequestException } from '@nestjs/common';
import { GlobalExceptionFilter } from './global-exception.filter';

describe('GlobalExceptionFilter validation payload', () => {
  it('normalise les messages class-validator en message texte et details structures', () => {
    const json = jest.fn();
    const status = jest.fn().mockReturnValue({ json });
    const host = {
      switchToHttp: () => ({
        getResponse: () => ({ status }),
        getRequest: () => ({ correlationId: 'validation-correlation-id' }),
      }),
    } as unknown as ArgumentsHost;

    new GlobalExceptionFilter().catch(
      new BadRequestException({
        message: ['email doit être une adresse email', 'password est trop court'],
        error: 'Bad Request',
        statusCode: 400,
      }),
      host,
    );

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          message: 'La validation des données a échoué.',
          details: {
            messages: ['email doit être une adresse email', 'password est trop court'],
          },
        }),
      }),
    );
  });
});
