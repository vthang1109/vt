// ============================================================
//  room.js — Hệ thống phòng online dùng chung cho tất cả game
//  Dùng Firestore realtime để sync trạng thái game
// ============================================================

import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import {
  getFirestore, doc, setDoc, getDoc, updateDoc,
  onSnapshot, deleteDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBupVBUTEJnBSBTShXKm8qnIJ8dGl4hQoY",
  authDomain: "lienquan-fake.firebaseapp.com",
  projectId: "lienquan-fake",
  storageBucket: "lienquan-fake.firebasestorage.app",
  messagingSenderId: "782694799992",
  appId: "1:782694799992:web:2d8e4a28626c3bbae8ab8d"
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

// ============================================================
//  TẠO ROOM ID NGẪU NHIÊN 6 CHỮ SỐ
// ============================================================
export function generateRoomId() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// ============================================================
//  TẠO PHÒNG MỚI
//  gameName: "caro" | "tictactoe" | "snake" ...
//  initialState: object trạng thái ban đầu của game
// ============================================================
export async function createRoom(gameName, initialState) {
  const user = auth.currentUser;
  if (!user) return { error: "Chưa đăng nhập" };

  try {
    const roomId = generateRoomId();
    const roomRef = doc(db, "rooms", roomId);

    await setDoc(roomRef, {
      game: gameName,
      roomId,
      host: {
        uid: user.uid,
        name: user.displayName || user.email.split('@')[0],
      },
      guest: null,
      status: "waiting",
      turn: "host",
      state: initialState,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return { roomId, role: "host" };
  } catch(e) {
    console.error("Lỗi tạo phòng:", e);
    return { error: "Tạo phòng thất bại: " + e.message };
  }
}

// ============================================================
//  VÀO PHÒNG
// ============================================================
export async function joinRoom(roomId) {
  const user = auth.currentUser;
  if (!user) return { error: "Chưa đăng nhập" };

  const roomRef = doc(db, "rooms", roomId);
  const snap = await getDoc(roomRef);

  if (!snap.exists()) return { error: "Phòng không tồn tại!" };

  const data = snap.data();

  if (data.status !== "waiting") return { error: "Phòng đã đầy hoặc đã kết thúc!" };
  if (data.host.uid === user.uid) return { error: "Không thể tự vào phòng của mình!" };

  await updateDoc(roomRef, {
    guest: {
      uid: user.uid,
      name: user.displayName || user.email.split('@')[0],
    },
    status: "playing",
    updatedAt: serverTimestamp(),
  });

  return { roomId, role: "guest", data };
}

// ============================================================
//  CẬP NHẬT TRẠNG THÁI GAME (gọi sau mỗi nước đi)
// ============================================================
export async function updateRoomState(roomId, newState, nextTurn, status = "playing") {
  const roomRef = doc(db, "rooms", roomId);
  await updateDoc(roomRef, {
    state: newState,
    turn: nextTurn,
    status,
    updatedAt: serverTimestamp(),
  });
}

// ============================================================
//  LẮNG NGHE THAY ĐỔI PHÒNG REALTIME
//  callback(data) được gọi mỗi khi có cập nhật
//  Trả về hàm unsubscribe để dừng lắng nghe
// ============================================================
export function listenRoom(roomId, callback) {
  const roomRef = doc(db, "rooms", roomId);
  return onSnapshot(roomRef, (snap) => {
    if (snap.exists()) callback(snap.data());
  });
}

// ============================================================
//  XOÁ PHÒNG (khi game kết thúc)
// ============================================================
export async function deleteRoom(roomId) {
  try {
    await deleteDoc(doc(db, "rooms", roomId));
  } catch(e) {
    console.error("Xóa phòng thất bại:", e);
  }
}

// ============================================================
//  LẤY THÔNG TIN PHÒNG
// ============================================================
export async function getRoom(roomId) {
  const snap = await getDoc(doc(db, "rooms", roomId));
  return snap.exists() ? snap.data() : null;
}
