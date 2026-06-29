import { HttpException, HttpStatus, ArgumentsHost } from '@nestjs/common';
import { GlobalExceptionFilter } from './global-exception.filter';
import { ERROR_CODES } from '../constants/error-codes.constant';

/**
 * Tests unitaires du GlobalExceptionFilter.
 *
 * Ce filtre standardise TOUTES les reponses d'erreur de l'API au format :
 * { success: false, error: { code, message, details?, correlationId, timestamp } }
 *
 * Il doit correctement differencier les HttpException des erreurs
 * de programmation et toujours inclure un correlationId.
 */
describe('GlobalExceptionFilter', () => {
  let filter: GlobalExceptionFilter;
  let mockJson: jest.Mock;
  let mockStatus: jest.Mock;
  let mockGetResponse: jest.Mock;
  let mockGetRequest: jest.Mock;
  let mockHttpArgumentsHost: jest.Mock;
  let mockArgumentsHost: ArgumentsHost;

  beforeEach(() => {
    filter = new GlobalExceptionFilter();

    mockJson = jest.fn();
    mockStatus = jest.fn().mockReturnValue({ json: mockJson });
    mockGetResponse = jest.fn().mockReturnValue({ status: mockStatus });
    mockGetRequest = jest.fn().mockReturnValue({
      headers: { 'x-correlation-id': 'test-correlation-id' },
    });
    mockHttpArgumentsHost = jest.fn().mockReturnValue({
      getResponse: mockGetResponse,
      getRequest: mockGetRequest,
    });
    mockArgumentsHost = {
      switchToHttp: mockHttpArgumentsHost,
    } as unknown as ArgumentsHost;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('HttpException — Erreurs HTTP standard', () => {
    it('doit retourner 400 + INVALID_INPUT pour une BadRequestException', () => {
      const exception = new HttpException('Donnees invalides', HttpStatus.BAD_REQUEST);

      filter.catch(exception, mockArgumentsHost);

      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: ERROR_CODES.INVALID_INPUT,
            message: 'Donnees invalides',
          }),
        }),
      );
    });

    it('doit retourner 404 + NOT_FOUND pour une NotFoundException', () => {
      const exception = new HttpException('Ticket non trouve', HttpStatus.NOT_FOUND);

      filter.catch(exception, mockArgumentsHost);

      expect(mockStatus).toHaveBeenCalledWith(404);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: ERROR_CODES.NOT_FOUND,
            message: 'Ticket non trouve',
          }),
        }),
      );
    });

    it('doit retourner 401 + UNAUTHORIZED pour une UnauthorizedException', () => {
      const exception = new HttpException('Non autorise', HttpStatus.UNAUTHORIZED);

      filter.catch(exception, mockArgumentsHost);

      expect(mockStatus).toHaveBeenCalledWith(401);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: ERROR_CODES.UNAUTHORIZED,
            message: 'Non autorise',
          }),
        }),
      );
    });

    it('doit retourner 403 + FORBIDDEN pour une ForbiddenException', () => {
      const exception = new HttpException('Acces interdit', HttpStatus.FORBIDDEN);

      filter.catch(exception, mockArgumentsHost);

      expect(mockStatus).toHaveBeenCalledWith(403);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: ERROR_CODES.FORBIDDEN,
            message: 'Acces interdit',
          }),
        }),
      );
    });

    it('doit retourner 409 + CONFLICT pour une ConflictException', () => {
      const exception = new HttpException('Email deja utilise', HttpStatus.CONFLICT);

      filter.catch(exception, mockArgumentsHost);

      expect(mockStatus).toHaveBeenCalledWith(409);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: ERROR_CODES.CONFLICT,
            message: 'Email deja utilise',
          }),
        }),
      );
    });

    it('doit inclure les details de validation quand presents', () => {
      const exception = new HttpException(
        {
          message: 'Validation echouee',
          errors: [
            { field: 'email', constraint: 'IsEmail' },
            { field: 'password', constraint: 'MinLength' },
          ],
        },
        HttpStatus.BAD_REQUEST,
      );

      filter.catch(exception, mockArgumentsHost);

      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            details: [
              { field: 'email', constraint: 'IsEmail' },
              { field: 'password', constraint: 'MinLength' },
            ],
          }),
        }),
      );
    });
  });

  describe('Erreur non-Http — Erreurs de programmation', () => {
    it('doit retourner 500 + INTERNAL_ERROR pour une Error generique', () => {
      const exception = new Error('Erreur interne inattendue');

      filter.catch(exception, mockArgumentsHost);

      expect(mockStatus).toHaveBeenCalledWith(500);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: ERROR_CODES.INTERNAL_ERROR,
            message: 'Une erreur interne est survenue.',
          }),
        }),
      );
    });

    it('doit retourner 500 + INTERNAL_ERROR pour une exception inconnue (non Error)', () => {
      const exception = 'Chaine de caractere inattendue';

      filter.catch(exception as unknown, mockArgumentsHost);

      expect(mockStatus).toHaveBeenCalledWith(500);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: ERROR_CODES.INTERNAL_ERROR,
            message: 'Une erreur inconnue est survenue.',
          }),
        }),
      );
    });
  });

  describe('CorrelationId — Tracing distribue', () => {
    it("doit utiliser le correlationId de l'entete x-correlation-id s'il existe", () => {
      const exception = new HttpException('Test', HttpStatus.BAD_REQUEST);

      filter.catch(exception, mockArgumentsHost);

      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            correlationId: 'test-correlation-id',
          }),
        }),
      );
    });

    it("doit generer un correlationId si l'entete est absent", () => {
      mockGetRequest.mockReturnValue({
        headers: {},
      });

      const exception = new HttpException('Test', HttpStatus.BAD_REQUEST);

      filter.catch(exception, mockArgumentsHost);

      const callArg = mockJson.mock.calls[0][0];
      expect(callArg.error.correlationId).toBeDefined();
      expect(typeof callArg.error.correlationId).toBe('string');
    });
  });

  describe("Timestamp — Horodatage de l'erreur", () => {
    it('doit inclure un timestamp ISO 8601 dans la reponse', () => {
      const exception = new HttpException('Test', HttpStatus.BAD_REQUEST);

      filter.catch(exception, mockArgumentsHost);

      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            timestamp: expect.any(String),
          }),
        }),
      );
    });
  });

  describe('Format de reponse — Conformite au standard', () => {
    it('doit retourner une reponse avec success=false et error', () => {
      const exception = new HttpException('Erreur', HttpStatus.BAD_REQUEST);

      filter.catch(exception, mockArgumentsHost);

      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: expect.any(String),
            message: expect.any(String),
            correlationId: expect.any(String),
            timestamp: expect.any(String),
          }),
        }),
      );
    });

    it("ne doit pas inclure la propriete data dans une reponse d'erreur", () => {
      const exception = new HttpException('Erreur', HttpStatus.BAD_REQUEST);

      filter.catch(exception, mockArgumentsHost);

      const responseBody = mockJson.mock.calls[0][0];
      expect(responseBody).not.toHaveProperty('data');
    });
  });
});
