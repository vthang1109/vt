import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getFirestore, doc, getDoc, updateDoc, setDoc, serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyBupVBUTEJnBSBTShXKm8qnIJ8dGl4hQoY",
  authDomain: "lienquan-fake.firebaseapp.com",
  projectId: "lienquan-fake",
  storageBucket: "lienquan-fake.firebasestorage.app",
  messagingSenderId: "782694799992",
  appId: "1:782694799992:web:2d8e4a28626c3bbae8ab8d"
};

// Khởi tạo app dùng chung để tránh lỗi "App already exists" hoặc sai database
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
        
        const initialPoints = 10000;
        await setDoc(userRef, {
            uid: user.uid,
            email: user.email,
            points: initialPoints,
            createdAt: serverTimestamp()
        }, { merge: true });
        return initialPoints;
    } catch (e) {
        return 0;
    }
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

        await updateDoc(userRef, {
            points: newTotal,
            lastUpdate: serverTimestamp()
        });
        
        // Cập nhật UI nhanh cho trang chủ nếu đang mở
        const pointsEl = document.getElementById('user-points-home');
        if (pointsEl) pointsEl.textContent = newTotal.toLocaleString();

        // ====== Hook nhiệm vụ hằng ngày ======
        try {
            if (window.VTQuests && amount > 0) {
                window.VTQuests.trackEarn(amount);
                const src = String(source || '').toLowerCase();
                const rsn = String(reason || '').toLowerCase();
                const isWin = rsn.includes('thắng') || rsn.includes('win') || rsn.includes('đúng') || rsn.includes('hoàn thành');
                if (isWin && (src.includes('caro') || src.includes('quiz') || src.includes('sudoku'))) {
                    window.VTQuests.trackWinSmart();
                }
            }
        } catch(e) {}

        return newTotal;
    } catch (e) {
        throw e;
    }
}

export async function updateMission(missionId, increment = 1) {
    const user = auth.currentUser;
    if (!user) return;
    try {
        const missionRef = doc(db, 'users', user.uid, 'missions', missionId);
        const snap = await getDoc(missionRef);
        const current = snap.exists() ? (snap.data().progress || 0) : 0;
        await setDoc(missionRef, {
            progress: current + increment,
            updatedAt: serverTimestamp()
        }, { merge: true });
    } catch (e) {
        console.error('updateMission error:', e);
    }
}

export async function claimDailyLogin() {
    const user = auth.currentUser;
    if (!user) return { claimed: false };
    try {
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        const userData = userSnap.data();
        const today = new Date().toDateString();
        if (userData?.lastClaimDate === today) return { claimed: false };

        const bonus = 1000;
        await addPoints('Hệ thống', 'Quà hàng ngày', bonus);
        await updateDoc(userRef, { lastClaimDate: today });
        return { claimed: true, points: bonus };
    } catch (e) { return { claimed: false }; }
}
