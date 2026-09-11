import { collection, query, where, orderBy, limit, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './config';
import type { Reward, Withdrawal } from '../types';

export async function fetchRewardHistory(userId: string, max = 20): Promise<Reward[]> {
  const q = query(
    collection(db, 'rewards'),
    where('userId', '==', userId),
    orderBy('createdAt', 'desc'),
    limit(max)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Reward, 'id'>) }));
}

export async function createWithdrawalRequest(input: {
  userId: string;
  amount: number;
  bankName: string;
  accountName: string;
  accountNumber: string;
}) {
  await addDoc(collection(db, 'withdrawals'), {
    ...input,
    status: 'pending',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function fetchMyWithdrawals(userId: string, max = 20): Promise<Withdrawal[]> {
  const q = query(
    collection(db, 'withdrawals'),
    where('userId', '==', userId),
    orderBy('createdAt', 'desc'),
    limit(max)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Withdrawal, 'id'>) }));
}
