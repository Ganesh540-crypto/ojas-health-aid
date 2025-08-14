import { auth, googleProvider } from './firebase';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signInWithPopup, sendPasswordResetEmail, updateProfile, User } from 'firebase/auth';

export type AuthResult = { user: User };

export async function signupWithEmail(email: string, password: string, displayName?: string): Promise<AuthResult> {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  if (displayName) await updateProfile(cred.user, { displayName });
  return { user: cred.user };
}

export async function loginWithEmail(email: string, password: string): Promise<AuthResult> {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return { user: cred.user };
}

export async function loginWithGoogle(): Promise<AuthResult> {
  const cred = await signInWithPopup(auth, googleProvider);
  return { user: cred.user };
}

export async function sendReset(email: string) {
  await sendPasswordResetEmail(auth, email);
}
