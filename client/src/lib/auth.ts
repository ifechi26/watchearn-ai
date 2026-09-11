import { createUserWithEmailAndPassword, signInWithEmailAndPassword, sendEmailVerification, signOut, updateProfile } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './config';
import type { User } from '../types';

function generateReferralCode(uid: string) {
  return `WE-${uid.slice(0, 6).toUpperCase()}`;
}

async function createUserProfile(uid: string, email: string | null, displayName: string | null) {
  const ref = doc(db, 'users', uid);
  const existing = await getDoc(ref);
  if (existing.exists()) return;

  const profile: Omit<User, 'id'> = {
    email,
    name: displayName || 'User',
    username: `user_${uid.slice(0, 8)}`,
    role: 'USER',
    status: 'active',
    premiumStatus: 'none',
    createdAt: new Date(),
    lastActive: new Date(),
    referralCode: generateReferralCode(uid),
    country: '',
    timezone: 'UTC',
    notificationPreferences: {
      email: true,
      inApp: true,
    },
  };
  await setDoc(ref, profile);
}

export async function registerWithEmail(email: string, password: string, displayName: string) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(cred.user, { displayName });
  await createUserProfile(cred.user.uid, email, displayName);
  await sendEmailVerification(cred.user);
  return cred.user;
}

export async function loginWithEmail(email: string, password: string) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

export async function logout() {
  await signOut(auth);
}
