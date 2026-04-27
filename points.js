import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
    getFirestore, doc, getDoc, updateDoc, setDoc, serverTimestamp, onSnapshot
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyBupVBUTEJnBSBTShXKm8qnIJ8dGl4hQoY",
  authDomain: "lienquan-fake.firebaseapp.com",
  projectId: "lienquan-fake",
  storageBucket: "lienquan-fake.firebasestorage.app",
  messagingSenderId: "782694799992",
  appId: "1:782694799992:web:2d8e4a28626c3bbae8ab8d"
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

export async function getPoints() {
    const user = auth.currentUser;
    if (!user) return 0;
    try {
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) return userSnap.data().points || 0;
        await setDoc(userRef, { uid: user.uid, email: user.email, points: 10000, createdAt: serverTimestamp() }, { merge: true });
        return 10000;
    } catch (e) { return 0; }
}

export async function addPoints(source, reason, amount) {
    const user = auth.currentUser;
    if (!user) return;
    try {
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        let current = userSnap.exists() ? (userSnap.data().points || 0) : 0;
        let newTotal = current + amount;
        if (newTotal < 0) newTotal = 0;
        await updateDoc(userRef, { points: newTotal, lastUpdate: serverTimestamp() });

        if (window.VTQuests && amount > 0) {
            window.VTQuests.trackEarn(amount);
            const rsn = String(reason || '').toLowerCase();
            if (rsn.includes('thắng') || rsn.includes('win')) window.VTQuests.trackWinSmart();
        }
        return newTotal;
    } catch (e) { throw e; }
}

export async function claimDailyLogin() {
    const user = auth.currentUser;
    if (!user) return { claimed: false };
    try {
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        const today = new Date().toDateString();
        if (userSnap.data()?.lastClaimDate === today) return { claimed: false };
        await addPoints('Hệ thống', 'Quà hàng ngày', 1000);
        await updateDoc(userRef, { lastClaimDate: today });
        return { claimed: true, points: 1000 };
    } catch (e) { return { claimed: false }; }
}

// ========== ĐỒNG BỘ ĐIỂM TỰ ĐỘNG (LISTENER DUY NHẤT) ==========
export function initPointsSync() {
    onAuthStateChanged(auth, user => {
        if (!user) return;
        const userRef = doc(db, 'users', user.uid);
        onSnapshot(userRef, snap => {
            if (!snap.exists()) return;
            const pts = snap.data().points || 0;
            const ptsStr = pts.toLocaleString('vi-VN');
            ['nav-pts', 'user-points-home', 'status-pts', 'pro-points', 'wd-pts', 'shPts'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.textContent = id === 'nav-pts' ? '⭐ ' + ptsStr : ptsStr;
            });
        });
    });
}

// Tự chạy khi import
initPointsSync();