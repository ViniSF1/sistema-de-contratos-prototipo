/** Erros padronizados da camada de dados. */
export class ApiError extends Error {
  constructor(message, { status = 0, campos = null } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.campos = campos;
  }
}

export class AuthError extends ApiError {
  constructor(message = 'Sessão expirada. Faça login novamente.') {
    super(message, { status: 401 });
    this.name = 'AuthError';
  }
}

export class NotImplementedError extends Error {
  constructor(feature) {
    super(`${feature} ainda não está disponível no adapter Supabase.`);
    this.name = 'NotImplementedError';
  }
}
