import { createServerClient } from '@supabase/ssr';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';

function isAdminPage(pathname: string) {
  return pathname === '/admin' || pathname.startsWith('/admin/');
}

function isAdminApi(pathname: string) {
  return pathname === '/api/admin' || pathname.startsWith('/api/admin/');
}

async function isApprovedAdmin(userId: string, supabaseUrl: string) {
  const secretKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!secretKey) {
    return false;
  }

  const adminClient = createSupabaseClient(supabaseUrl, secretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { data, error } = await adminClient
    .from('admin_users')
    .select('id')
    .eq('id', userId)
    .maybeSingle();

  return !error && Boolean(data);
}

function adminApiError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function redirectToAdminLogin(request: NextRequest, error?: string) {
  const url = request.nextUrl.clone();
  url.pathname = '/admin/login';
  url.search = '';

  if (error) {
    url.searchParams.set('error', error);
  }

  return NextResponse.redirect(url);
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const pathname = request.nextUrl.pathname;
  const adminPage = isAdminPage(pathname);
  const adminApi = isAdminApi(pathname);
  const adminArea = adminPage || adminApi;
  const adminLogin = pathname === '/admin/login';

  if (!supabaseUrl || !publishableKey) {
    if (!adminArea || adminLogin) {
      return response;
    }

    return adminApi
      ? adminApiError('Admin authentication is not configured.', 503)
      : redirectToAdminLogin(request, 'Admin authentication is not configured.');
  }

  const supabase = createServerClient(supabaseUrl, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  if (!adminArea) {
    return response;
  }

  if (!userId || claimsError) {
    if (adminLogin) {
      return response;
    }

    return adminApi
      ? adminApiError('Authentication required.', 401)
      : redirectToAdminLogin(request);
  }

  const approvedAdmin = await isApprovedAdmin(userId, supabaseUrl);

  if (!approvedAdmin) {
    if (adminLogin) {
      return response;
    }

    return adminApi
      ? adminApiError('Admin access required.', 403)
      : redirectToAdminLogin(request, 'This account does not have admin access.');
  }

  if (adminLogin) {
    const url = request.nextUrl.clone();
    url.pathname = '/admin';
    url.search = '';
    return NextResponse.redirect(url);
  }

  return response;
}
