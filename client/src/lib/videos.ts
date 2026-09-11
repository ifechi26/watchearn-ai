import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  addDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  getCountFromServer,
} from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { db, storage } from './config';
import type { Video, Comment } from '../types';

const VIDEOS = 'videos';

export interface DiscoverFilter {
  category?: string;
  max?: number;
}

export async function fetchDiscoverVideos({ category, max = 24 }: DiscoverFilter): Promise<Video[]> {
  const clauses = [where('status', '==', 'approved')];
  if (category) clauses.push(where('category', '==', category));
  const q = query(collection(db, VIDEOS), ...clauses, orderBy('createdAt', 'desc'), limit(max));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ videoId: d.id, ...(d.data() as Omit<Video, 'videoId'>) }));
}

export async function fetchShorts(max = 20): Promise<Video[]> {
  const q = query(
    collection(db, VIDEOS),
    where('status', '==', 'approved'),
    where('type', '==', 'short'),
    orderBy('createdAt', 'desc'),
    limit(max)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ videoId: d.id, ...(d.data() as Omit<Video, 'videoId'>) }));
}

export async function fetchVideoById(id: string): Promise<Video | null> {
  const snap = await getDoc(doc(db, VIDEOS, id));
  if (!snap.exists()) return null;
  return { videoId: snap.id, ...(snap.data() as Omit<Video, 'videoId'>) };
}

export async function fetchCreatorVideos(creatorId: string): Promise<Video[]> {
  const q = query(collection(db, VIDEOS), where('creatorId', '==', creatorId), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ videoId: d.id, ...(d.data() as Omit<Video, 'videoId'>) }));
}

export async function fetchLiveCounts(videoId: string) {
  const [likes, saves, comments, sessions] = await Promise.all([
    getCountFromServer(query(collection(db, 'likes'), where('videoId', '==', videoId))),
    getCountFromServer(query(collection(db, 'savedVideos'), where('videoId', '==', videoId))),
    getCountFromServer(query(collection(db, 'comments'), where('videoId', '==', videoId))),
    getCountFromServer(query(collection(db, 'watchSessions'), where('videoId', '==', videoId))),
  ]);
  return {
    likes: likes.data().count,
    saves: saves.data().count,
    comments: comments.data().count,
    views: sessions.data().count,
  };
}

export async function hasUserLiked(videoId: string, userId: string) {
  const snap = await getDocs(query(collection(db, 'likes'), where('videoId', '==', videoId), where('userId', '==', userId)));
  return snap.empty ? null : snap.docs[0].id;
}

export async function hasUserSaved(videoId: string, userId: string) {
  const snap = await getDocs(query(collection(db, 'savedVideos'), where('videoId', '==', videoId), where('userId', '==', userId)));
  return snap.empty ? null : snap.docs[0].id;
}

export async function toggleLike(videoId: string, userId: string, existingLikeId: string | null) {
  if (existingLikeId) {
    await deleteDoc(doc(db, 'likes', existingLikeId));
    return null;
  }
  const ref2 = await addDoc(collection(db, 'likes'), { videoId, userId, createdAt: serverTimestamp() });
  return ref2.id;
}

export async function toggleSave(videoId: string, userId: string, existingSaveId: string | null) {
  if (existingSaveId) {
    await deleteDoc(doc(db, 'savedVideos', existingSaveId));
    return null;
  }
  const ref2 = await addDoc(collection(db, 'savedVideos'), { videoId, userId, createdAt: serverTimestamp() });
  return ref2.id;
}

export async function fetchComments(videoId: string): Promise<Comment[]> {
  const q = query(collection(db, 'comments'), where('videoId', '==', videoId), orderBy('createdAt', 'desc'), limit(50));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Comment, 'id'>) }));
}

export async function postComment(videoId: string, userId: string, text: string) {
  await addDoc(collection(db, 'comments'), { videoId, userId, text, createdAt: serverTimestamp() });
}

export async function recordWatchSession(videoId: string, userId: string, completionPercent: number) {
  await addDoc(collection(db, 'watchSessions'), {
    videoId,
    userId,
    completionPercent: Math.round(completionPercent),
    createdAt: serverTimestamp(),
  });
}
