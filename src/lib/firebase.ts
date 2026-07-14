import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Configuration injected from firebase-applet-config.json
const firebaseConfig = {
  apiKey: "AIzaSyCaxAsP5oMzszUyGqibvytbeunoUmojq-Q",
  authDomain: "smartcook-6b0f9.firebaseapp.com",
  projectId: "smartcook-6b0f9",
  storageBucket: "smartcook-6b0f9.firebasestorage.app",
  messagingSenderId: "721466508399",
  appId: "1:721466508399:web:1a8bfb75dfd908860df99a",
  measurementId: "G-5PZTG2RN1L"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

export { signInWithPopup, signOut, onAuthStateChanged };
