// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBM5C-vhrVDVwSiKGqMkei-Iq_eHkjx6sg",
  authDomain: "arch-canvas.firebaseapp.com",
  projectId: "arch-canvas",
  storageBucket: "arch-canvas.firebasestorage.app",
  messagingSenderId: "347366027359",
  appId: "1:347366027359:web:65e1c3fee553488a0eabea",
  measurementId: "G-JE532XZC1H"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const db = getFirestore(app);

export { app, analytics, auth, db };
