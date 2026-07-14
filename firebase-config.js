/* ============================================
   FIREBASE CONFIGURATION
   Crust & Chilly Business Dashboard
   ============================================ */

const firebaseConfig = {
  apiKey: "AIzaSyAFToenA3UZozo2_4XPv_WVH7-FM7dMAbc",
  authDomain: "crust-chilly-business.firebaseapp.com",
  projectId: "crust-chilly-business",
  storageBucket: "crust-chilly-business.firebasestorage.app",
  messagingSenderId: "421851479520",
  appId: "1:421851479520:web:54e537279b14b4ef4e7f85"
};

firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.firestore();

db.enablePersistence({ synchronizeTabs: true })
  .then(() => console.log('✅ Offline mode enabled'))
  .catch((err) => {
    if (err.code === 'failed-precondition') {
      console.log('⚠️ Multiple tabs open');
    }
  });

console.log('🔥 Firebase ready');