// firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
// 🌟 นำเข้า Firebase Storage
import { getStorage } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-storage.js"; 

const firebaseConfig = {
  apiKey: "AIzaSyDg6LnmXjvARHw8yCMwREirjfVQ2vQrXEg",
  authDomain: "sc-e-voting.firebaseapp.com",
  projectId: "sc-e-voting",
  storageBucket: "sc-e-voting.firebasestorage.app",
  messagingSenderId: "206037022201",
  appId: "1:206037022201:web:7f51638d387a2d03323928"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = initializeFirestore(app, {
    localCache: persistentLocalCache({tabManager: persistentMultipleTabManager()})
});
// 🌟 ประกาศตัวแปร Storage
const storage = getStorage(app); 

// ส่งออก auth, db และ storage
export { auth, db, storage };