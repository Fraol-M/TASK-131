import { randomUUID } from 'crypto';
import { SignJWT, jwtVerify } from 'jose';
import { getDb } from '../../persistence/mongoClient.js';
import { config } from '../../config/index.js';
import type { Session, UserRole, UserScope } from '@nexusorder/shared-types';

const COLLECTION = 'sessions';

function getSecret(): Uint8Array {
  return new TextEncoder().encode(config.session.secret);
}

export const sessionService = {
  async createSession(params: {
    userId: string;
    role: UserRole;
    scope: UserScope;
  }): Promise<{ sessionId: string; token: string; expiresAt: Date }> {
    const sessionId = randomUUID();
    const expiresAt = new Date(Date.now() + config.session.ttlSeconds * 1000);

    const token = await new SignJWT({ sessionId, role: params.role })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(params.userId)
      .setExpirationTime(expiresAt)
      .setIssuedAt()
      .sign(getSecret());

    const session: Session & { _id: string } = {
      _id: sessionId,
      userId: params.userId,
      role: params.role,
      scope: params.scope,
      createdAt: new Date(),
      expiresAt,
    };

    await getDb().collection<Session>(COLLECTION).insertOne(session as Session & { _id: string });

    return { sessionId, token, expiresAt };
  },

  async validateSession(token: string): Promise<Session | null> {
    try {
      const { payload } = await jwtVerify(token, getSecret());
      const sessionId = payload['sessionId'] as string;
      const session = await getDb().collection<Session>(COLLECTION).findOne({ _id: sessionId } as { _id: string });
      if (!session || session.expiresAt < new Date()) return null;
      return session;
    } catch {
      return null;
    }
  },

  async revokeSession(sessionId: string): Promise<void> {
    await getDb().collection(COLLECTION).deleteOne({ _id: sessionId });
  },

  async revokeAllUserSessions(userId: string): Promise<void> {
    await getDb().collection(COLLECTION).deleteMany({ userId });
  },
};
