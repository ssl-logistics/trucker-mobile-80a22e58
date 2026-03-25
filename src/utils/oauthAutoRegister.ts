import { supabase } from '@/integrations/supabase/client';

interface OAuthRegisterParams {
  authProvider: 'apple' | 'line' | 'google';
  authUserId: string;
  firstName?: string;
  lastName?: string;
}

/**
 * Auto-register an OAuth user in both the internal database (create-account)
 * and the external TMS (register-driver). Both calls are non-blocking.
 */
export const autoRegisterOAuthUser = async (params: OAuthRegisterParams): Promise<void> => {
  const { authProvider, authUserId, firstName, lastName } = params;

  // 1. Create account in internal database
  try {
    console.log(`[AutoRegister] 📝 Creating account for ${authProvider} user:`, authUserId);
    const createBody: Record<string, string> = {
      authProvider,
      authUserId,
      firstName: firstName || authProvider === 'apple' ? 'Apple' : 'OAuth',
      lastName: lastName || 'User',
      phone: '0000000000',
      email: '',
    };

    if (authProvider === 'line') {
      createBody.lineUserId = authUserId;
    }

    const { data: accountData, error: accountError } = await supabase.functions.invoke('create-account', {
      body: createBody,
    });

    if (accountError) {
      console.warn('[AutoRegister] ⚠️ create-account warning:', accountError.message);
    } else if (accountData?.status === 'error') {
      console.warn('[AutoRegister] ⚠️ create-account API error:', accountData.message);
    } else {
      console.log('[AutoRegister] ✅ Account created/found:', accountData?.userId);
    }
  } catch (e) {
    console.warn('[AutoRegister] ⚠️ create-account failed (non-blocking):', e);
  }

  // 2. Register in external TMS
  try {
    console.log(`[AutoRegister] 📝 Registering in external TMS...`);
    const registerBody: Record<string, string> = {
      authProvider,
      authUserId,
    };
    if (firstName) registerBody.firstName = firstName;
    if (lastName) registerBody.lastName = lastName;

    const { data: regData, error: regError } = await supabase.functions.invoke('register-driver', {
      body: registerBody,
    });

    if (regError) {
      console.warn('[AutoRegister] ⚠️ register-driver warning:', regError.message);
    } else {
      console.log('[AutoRegister] ✅ External TMS registration:', regData);
    }
  } catch (e) {
    console.warn('[AutoRegister] ⚠️ register-driver failed (non-blocking):', e);
  }
};
