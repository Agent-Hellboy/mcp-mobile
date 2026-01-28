import type { AuthProvider, HeadersMap } from './types';

export class TokenAuthProvider implements AuthProvider {
  private token: string;
  private scheme: string;

  constructor(token: string, scheme = 'Bearer') {
    this.token = token;
    this.scheme = scheme;
  }

  setToken(token: string) {
    this.token = token;
  }

  async getHeaders(): Promise<HeadersMap> {
    if (!this.token) return {};
    return {
      Authorization: `${this.scheme} ${this.token}`,
    };
  }
}

export class StaticHeadersAuthProvider implements AuthProvider {
  private headers: HeadersMap;

  constructor(headers: HeadersMap) {
    this.headers = headers;
  }

  async getHeaders(): Promise<HeadersMap> {
    return { ...this.headers };
  }
}
