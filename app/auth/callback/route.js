import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET(request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');

  console.log('🔄 Auth callback triggered');

  if (!code) {
    console.log('❌ No code found');
    return NextResponse.redirect(new URL('/login', requestUrl.origin));
  }

  const cookieStore = cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        get(name) {
          return cookieStore.get(name)?.value;
        },
        set(name, value, options) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch (error) {
            // Ignore cookie errors during redirect
          }
        },
        remove(name, options) {
          try {
            cookieStore.set({ name, value: '', ...options });
          } catch (error) {
            // Ignore cookie errors during redirect
          }
        },
      },
    }
  );

  try {
    // Exchange code for session
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error('❌ Exchange error:', error.message);
      return NextResponse.redirect(new URL('/login', requestUrl.origin));
    }

    if (!data?.session) {
      console.log('❌ No session created');
      return NextResponse.redirect(new URL('/login', requestUrl.origin));
    }

    console.log('✅ Session created for:', data.user.email);

    // Check profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, job, onboarding_completed')
      .eq('id', data.user.id)
      .maybeSingle();

    console.log('📊 Profile:', profile);

    // Create profile if doesn't exist
    if (!profile) {
      console.log('🆕 Creating profile...');

      await supabase.from('profiles').insert({
        id: data.user.id,
        email: data.user.email,
        full_name: data.user.user_metadata?.full_name || data.user.user_metadata?.name || '',
        job: '',
        avatar_url: data.user.user_metadata?.avatar_url || data.user.user_metadata?.picture || '',
        onboarding_completed: false,
      });

      console.log('➡️ Redirecting to onboarding');
      
      const response = NextResponse.redirect(new URL('/onboarding', requestUrl.origin));
      return response;
    }

    // Check if onboarding complete
    if (!profile.full_name || !profile.onboarding_completed) {
      console.log('➡️ Onboarding incomplete');
      return NextResponse.redirect(new URL('/onboarding', requestUrl.origin));
    }

    // Success - go to chat
    console.log('✅ Redirecting to chat');
    return NextResponse.redirect(new URL('/chat', requestUrl.origin));

  } catch (error) {
    console.error('❌ Callback error:', error);
    return NextResponse.redirect(new URL('/login', requestUrl.origin));
  }
}