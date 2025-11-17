import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { emergencyContacts } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { auth } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session) {
      return NextResponse.json(
        { error: 'Authentication required', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    const contacts = await db
      .select()
      .from(emergencyContacts)
      .where(eq(emergencyContacts.userId, session.user.id))
      .orderBy(desc(emergencyContacts.createdAt));

    return NextResponse.json(contacts, { status: 200 });
  } catch (error) {
    console.error('GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error: ' + (error as Error).message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session) {
      return NextResponse.json(
        { error: 'Authentication required', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    const body = await request.json();

    if ('userId' in body || 'user_id' in body) {
      return NextResponse.json(
        {
          error: 'User ID cannot be provided in request body',
          code: 'USER_ID_NOT_ALLOWED',
        },
        { status: 400 }
      );
    }

    const { name, phone, email, relationship } = body;

    if (!name || typeof name !== 'string' || name.trim() === '') {
      return NextResponse.json(
        { error: 'Name is required and must be a non-empty string', code: 'MISSING_NAME' },
        { status: 400 }
      );
    }

    if (!phone || typeof phone !== 'string' || phone.trim() === '') {
      return NextResponse.json(
        { error: 'Phone is required and must be a non-empty string', code: 'MISSING_PHONE' },
        { status: 400 }
      );
    }

    if (!email || typeof email !== 'string' || email.trim() === '') {
      return NextResponse.json(
        { error: 'Email is required and must be a non-empty string', code: 'MISSING_EMAIL' },
        { status: 400 }
      );
    }

    const newContact = await db
      .insert(emergencyContacts)
      .values({
        userId: session.user.id,
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim().toLowerCase(),
        relationship: relationship?.trim() || null,
        createdAt: new Date().toISOString(),
      })
      .returning();

    return NextResponse.json(newContact[0], { status: 201 });
  } catch (error) {
    console.error('POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error: ' + (error as Error).message },
      { status: 500 }
    );
  }
}