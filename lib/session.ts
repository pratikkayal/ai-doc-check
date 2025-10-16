import { getIronSession, IronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { SessionData } from '@/types';

const sessionOptions = {
  password: process.env.SESSION_SECRET || 'complex_password_at_least_32_characters_long',
  cookieName: 'document_checker_session',
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax' as const,
    maxAge: 60 * 60 * 24 * 7, // 1 week
  },
};

export async function getSession(): Promise<IronSession<SessionData>> {
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, sessionOptions);
}

export async function isAuthenticated(): Promise<boolean> {
  const session = await getSession();
  return !!session.databricksToken && session.isAuthenticated === true;
}

