import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions, SessionData } from '@/lib/session';
import { getApp, updateApp, deleteApp, createAppKey, revokeAppKey } from '@/lib/api';

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: RouteParams) {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  const { id } = await params;

  if (!session.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const app = await getApp(session.userId, id);
    if (!app) {
      return NextResponse.json({ error: 'App not found' }, { status: 404 });
    }
    return NextResponse.json(app);
  } catch (error) {
    console.error('Failed to fetch app:', error);
    return NextResponse.json({ error: 'Failed to fetch app' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  const { id } = await params;

  if (!session.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const app = await updateApp(session.userId, id, body);
    return NextResponse.json(app);
  } catch (error) {
    console.error('Failed to update app:', error);
    const message = error instanceof Error ? error.message : 'Failed to update app';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  const { id } = await params;

  if (!session.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await deleteApp(session.userId, id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete app:', error);
    const message = error instanceof Error ? error.message : 'Failed to delete app';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
