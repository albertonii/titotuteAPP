import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  throw new Error('NEXT_PUBLIC_SUPABASE_URL no está configurado');
}

const inviteUser = async ({
  email,
  name,
  role,
  userId
}: {
  email: string;
  name: string;
  role: string;
  userId: string;
}) => {
  if (!serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY no está configurado en el servidor');
  }

  const client = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  const { error } = await client.auth.admin.inviteUserByEmail(email, {
    data: {
      full_name: name,
      role,
      local_user_id: userId
    }
  });

  if (error) {
    throw error;
  }
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, name, role, userId } = body as {
      email?: string;
      name?: string;
      role?: string;
      userId?: string;
    };

    if (!email || !name || !role || !userId) {
      return NextResponse.json({ message: 'Datos incompletos' }, { status: 400 });
    }

    await inviteUser({ email, name, role, userId });

    return NextResponse.json({ message: 'Invitación enviada' }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ message }, { status: 500 });
  }
}
