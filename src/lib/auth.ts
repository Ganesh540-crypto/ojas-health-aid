import { auth, googleProvider } from './firebase';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signInWithPopup, sendPasswordResetEmail, updateProfile, User, sendEmailVerification, deleteUser, signOut } from 'firebase/auth';

export type AuthResult = { user: User };

export async function signupWithEmail(email: string, password: string, displayName?: string): Promise<AuthResult> {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  if (displayName) await updateProfile(cred.user, { displayName });
  try {
    await sendEmailVerification(cred.user, {
      url: `https://app.ojasai.co.in/email-action`,
      handleCodeInApp: true,
    } as any);
  } catch {}
  return { user: cred.user };
}

export async function loginWithEmail(email: string, password: string): Promise<AuthResult> {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  try { await cred.user.reload(); } catch {}
  if (!cred.user.emailVerified) {
    try { await startEmailOtp(email); } catch {
      try {
        await sendEmailVerification(cred.user, {
          url: `https://app.ojasai.co.in/email-action`,
          handleCodeInApp: true,
        } as any);
      } catch {}
    }
    const err: any = new Error('Please verify your email. We\'ve sent a new verification link.');
    err.code = 'auth/email-not-verified';
    throw err;
  }
  return { user: cred.user };
}

export async function loginWithGoogle(): Promise<AuthResult> {
  const cred = await signInWithPopup(auth, googleProvider);
  return { user: cred.user };
}

export async function sendReset(email: string) {
  await sendPasswordResetEmail(auth, email);
}

// Optional Email OTP via Cloud Functions (fallback to verification link if functions are not set up)
export async function startEmailOtp(email: string): Promise<{ mode: 'otp' | 'link' }>{
  if (auth.currentUser) {
    await sendEmailVerification(auth.currentUser, {
      url: `https://app.ojasai.co.in/email-action`,
      handleCodeInApp: true,
    } as any);
  }
  return { mode: 'link' };
}

export async function verifyEmailOtp(email: string, code: string): Promise<boolean>{
  try {
    const response = await fetch('/api/verifyEmailOtp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: { email, code } })
    });
    if (!response.ok) return false;
    const result = await response.json();
    return !!result?.result?.ok;
  } catch {
    return false;
  }
}

export async function deleteMyAccount(): Promise<{ ok: boolean; requiresRecentLogin?: boolean }>{
  const user = auth.currentUser;
  if (!user) return { ok: false };
  try {
    await deleteUser(user);
    return { ok: true };
  } catch (e: any) {
    if (e?.code === 'auth/requires-recent-login') {
      return { ok: false, requiresRecentLogin: true };
    }
    return { ok: false };
  }
}
