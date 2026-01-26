// Another service following the same pattern
export class AuthService {
  private sessions: Map<string, Session> = new Map();

  async login(email: string, password: string): Promise<Session> {
    // Mock implementation
    const session: Session = {
      token: crypto.randomUUID(),
      userId: email,
      expiresAt: new Date(Date.now() + 3600000),
    };
    this.sessions.set(session.token, session);
    return session;
  }

  async logout(token: string): Promise<void> {
    this.sessions.delete(token);
  }

  async validateSession(token: string): Promise<boolean> {
    const session = this.sessions.get(token);
    if (!session) return false;
    return session.expiresAt > new Date();
  }
}

interface Session {
  token: string;
  userId: string;
  expiresAt: Date;
}
