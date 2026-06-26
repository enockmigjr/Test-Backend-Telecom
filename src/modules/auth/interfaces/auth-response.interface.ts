export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    departmentId: string;
    departmentName: string;
  };
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}
