/**
 * Interfaces nommées pour les méthodes de UsersService.
 * Remplacent les DTOs inline anonymes dans les signatures de service.
 */

export interface CreateUserInput {
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  departmentId: string;
}

export interface UpdateUserInput {
  firstName?: string;
  lastName?: string;
  role?: string;
  departmentId?: string;
}
