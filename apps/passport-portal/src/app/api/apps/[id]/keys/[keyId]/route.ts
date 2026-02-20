import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions, SessionData } from '@/lib/session';
import { revokeAppKey } from '@/lib/api';

type RouteParams = { params: Promise<{ id: string; keyId: string }> };

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  const { id, keyId } = await params;

  if (!session.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await revokeAppKey(session.userId, id, keyId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to revoke app key:', error);
    const message = error instanceof Error ? error.message : 'Failed to revoke key';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
