// firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, getFirestore } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// --- 1. การเชื่อมต่อหลัก: ระบบ e-Voting (เก็บแคมเปญและผลโหวต) ---
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

// --- 2. การเชื่อมต่อรอง: ระบบ MST Passport (ดึงรายชื่อผู้ใช้แบบ Real-time) ---
const passportConfig = {
    apiKey: "AIzaSyAYatUqsCBoeWDoOp2kj-OWkWzg2Zq6cV0",
    authDomain: "passport-mst.firebaseapp.com",
    projectId: "passport-mst",
    storageBucket: "passport-mst.firebasestorage.app",
    messagingSenderId: "432387692181",
    appId: "1:432387692181:web:ce8ad2dc306f8b38ea6d9c"
};
// ตั้งชื่อแอปที่สองเป็น "passportApp" เพื่อไม่ให้ชนกับแอปแรก
const passportApp = initializeApp(passportConfig, "passportApp"); 
const passportDb = getFirestore(passportApp);

// ส่งออก passportDb ไปให้ไฟล์ admin.js ใช้งาน
export { auth, db, passportDb };