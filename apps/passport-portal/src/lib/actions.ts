'use server';

import { cookies } from 'next/headers';
import { getIronSession } from 'iron-session';
import { redirect } from 'next/navigation';
import { sessionOptions, SessionData, defaultSession } from '@/lib/session';
import { login as apiLogin, register as apiRegister } from '@/lib/api';

export async function getSession() {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  
  if (!session.isLoggedIn) {
    session.isLoggedIn = defaultSession.isLoggedIn;
  }
  
  return session;
}

export async function login(formData: FormData) {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;

  if (!email || !password) {
    return { error: 'Email and password are required' };
  }

  try {
    const { user } = await apiLogin(email, password);
    
    const session = await getSession();
    session.userId = user.id;
    session.email = user.email;
    session.displayName = user.displayName;
    session.isLoggedIn = true;
    await session.save();

    redirect('/dashboard');
  } catch (error) {
    if (error instanceof Error && error.message === 'NEXT_REDIRECT') {
      throw error;
    }
    return { error: 'Invalid email or password' };
  }
}

export async function register(formData: FormData) {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;
  const displayName = formData.get('displayName') as string | undefined;

  if (!email || !password) {
    return { error: 'Email and password are required' };
  }

  if (password.length < 8) {
    return { error: 'Password must be at least 8 characters' };
  }

  try {
    const { user } = await apiRegister(email, password, displayName);
    
    const session = await getSession();
    session.userId = user.id;
    session.email = user.email;
    session.displayName = user.displayName;
    session.isLoggedIn = true;
    await session.save();

    redirect('/dashboard');
  } catch (error) {
    if (error instanceof Error && error.message === 'NEXT_REDIRECT') {
      throw error;
    }
    const message = error instanceof Error ? error.message : 'Registration failed';
    return { error: message };
  }
}

export async function logout() {
  const session = await getSession();
  session.destroy();
  redirect('/login');
}

export async function requireAuth() {
  const session = await getSession();
  
  if (!session.isLoggedIn || !session.userId) {
    redirect('/login');
  }
  
  return session;
}
