import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Configuration injected from firebase-applet-config.json
const firebaseConfig = {
  apiKey: "AIzaSyBTGUETtADB4XEdRMwiDB5oBbXqa6sfuzs",
  authDomain: "gen-lang-client-0128861273.firebaseapp.com",
  projectId: "gen-lang-client-0128861273",
  storageBucket: "gen-lang-client-0128861273.firebasestorage.app",
  messagingSenderId: "559937159890",
  appId: "1:559937159890:web:e82333e26d91d5088ba30b"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

export { signInWithPopup, signOut, onAuthStateChanged };
