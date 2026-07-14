/* ============================================
   FIREBASE CONFIGURATION
   ============================================ */

// PASTE YOUR FIREBASE CONFIG HERE ⬇️
const firebaseConfig = {
  apiKey: "AIzaSyAFToenA3UZozo2_4XPv_WVH7-FM7dMAbc",
  authDomain: "crust-chilly-business.firebaseapp.com",
  projectId: "crust-chilly-business",
  storageBucket: "crust-chilly-business.firebasestorage.app",
  messagingSenderId: "421851479520",
  appId: "1:421851479520:web:54e537279b14b4ef4e7f85"
};

// Initialize Firebase (Compat SDK for easier use)
firebase.initializeApp(firebaseConfig);

// Get services
const auth = firebase.auth();
const db = firebase.firestore();

// Enable offline persistence
db.enablePersistence()
  .catch((err) => {
    if (err.code === 'failed-precondition') {
      console.log('Multiple tabs open, offline mode disabled');
    } else if (err.code === 'unimplemented') {
      console.log('Browser does not support offline mode');
    }
  });

console.log('✅ Firebase initialized');