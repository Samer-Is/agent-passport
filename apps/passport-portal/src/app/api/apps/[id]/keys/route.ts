import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions, SessionData } from '@/lib/session';
import { createAppKey, revokeAppKey } from '@/lib/api';

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: RouteParams) {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  const { id } = await params;

  if (!session.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { name } = body;

    const result = await createAppKey(session.userId, id, name);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Failed to create app key:', error);
    const message = error instanceof Error ? error.message : 'Failed to create key';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
