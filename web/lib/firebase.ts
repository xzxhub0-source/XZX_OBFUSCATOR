// lib/firebase.ts
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, updateDoc, increment } from 'firebase/firestore';

const firebaseConfig = {
  // Add your Firebase config here
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

export async function getTotalObfuscations(): Promise<number> {
  try {
    const docRef = doc(db, 'stats', 'obfuscations');
    const docSnap = await getDoc(docRef);
    return docSnap.data()?.count || 150;
  } catch (error) {
    console.error('Failed to fetch count:', error);
    return 150;
  }
}

export async function incrementTotalObfuscations(): Promise<number> {
  try {
    const docRef = doc(db, 'stats', 'obfuscations');
    await updateDoc(docRef, {
      count: increment(1)
    });
    const newDoc = await getDoc(docRef);
    return newDoc.data()?.count;
  } catch (error) {
    console.error('Failed to increment count:', error);
    return 151;
  }
}
