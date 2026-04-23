// ===== CHAT FEATURES ENHANCEMENT =====
// Thêm vào chat.js hoặc dùng làm file riêng

// ===== 1. DELETE MESSAGE =====
window.deleteMessage = async function(messageId, roomId) {
  if (!_currentUser) return;
  try {
    const msgRef = doc(db, 'chats', roomId, 'messages', messageId);
    const msgSnap = await getDoc(msgRef);
    
    if (!msgSnap.exists()) {
      window.showToast('❌ Tin nhắn không tồn tại!', 'error');
      return;
    }
    
    // Chỉ cho phép xoá tin của chính mình
    if (msgSnap.data().senderUid !== _currentUser.uid) {
      window.showToast('❌ Bạn không thể xoá tin này!', 'error');
      return;
    }
    
    await updateDoc(msgRef, {
      text: '[Tin nhắn đã được xoá]',
      edited: true,
      deletedAt: serverTimestamp()
    });
    window.showToast('✅ Đã xoá tin nhắn', 'success');
  } catch(e) {
    console.error('Lỗi xoá tin nhắn:', e);
    window.showToast('❌ Xoá thất bại!', 'error');
  }
};

// ===== 2. EDIT MESSAGE =====
window.editMessage = async function(messageId, roomId, newText) {
  if (!_currentUser || !newText.trim()) return;
  try {
    const msgRef = doc(db, 'chats', roomId, 'messages', messageId);
    const msgSnap = await getDoc(msgRef);
    
    if (msgSnap.data().senderUid !== _currentUser.uid) {
      window.showToast('❌ Bạn không thể sửa tin này!', 'error');
      return;
    }
    
    // Chỉ cho phép sửa trong vòng 5 phút
    const createdTime = msgSnap.data().createdAt?.toDate();
    const now = new Date();
    if (now - createdTime > 5 * 60 * 1000) {
      window.showToast('⏰ Chỉ sửa được trong 5 phút!', 'warn');
      return;
    }
    
    await updateDoc(msgRef, {
      text: newText.trim(),
      edited: true,
      editedAt: serverTimestamp()
    });
    window.showToast('✅ Đã sửa tin nhắn', 'success');
  } catch(e) {
    console.error('Lỗi sửa tin nhắn:', e);
    window.showToast('❌ Sửa thất bại!', 'error');
  }
};

// ===== 3. UPDATE USER STATUS =====
window.updateUserStatus = async function(status) {
  if (!_currentUser) return;
  try {
    await updateDoc(doc(db, 'users', _currentUser.uid), {
      status: status,
      lastSeen: serverTimestamp()
    });
  } catch(e) { console.error('Lỗi cập nhật status:', e); }
};

// Cập nhật status khi mở/đóng chat
window.addEventListener('focus', () => window.updateUserStatus('online'));
window.addEventListener('blur', () => window.updateUserStatus('idle'));

// Cập nhật status lúc rời trang
window.addEventListener('beforeunload', () => {
  window.updateUserStatus('offline');
});

// ===== 4. MARK AS READ =====
window.markAsRead = async function(roomId) {
  if (!_currentUser) return;
  try {
    await updateDoc(doc(db, 'chats', roomId), {
      [`readBy.${_currentUser.uid}`]: serverTimestamp()
    });
  } catch(e) { console.error('Lỗi mark as read:', e); }
};

// ===== 5. TYPING INDICATOR =====
let typingTimeout;

window.onInputTyping = function() {
  clearTimeout(typingTimeout);
  
  if (!_currentUser || currentConvoId === '__server__') return;
  
  const roomId = getDmId(_currentUser.uid, currentConvoId);
  
  // Thêm user vào danh sách người đang gõ
  updateDoc(doc(db, 'chats', roomId), {
    typingUsers: arrayUnion(_currentUser.uid)
  }).catch(() => {});
  
  // Xoá sau 2 giây không gõ
  typingTimeout = setTimeout(async () => {
    try {
      await updateDoc(doc(db, 'chats', roomId), {
        typingUsers: arrayRemove(_currentUser.uid)
      });
    } catch(e) { console.error('Lỗi typing indicator:', e); }
  }, 2000);
};

// Gắn vào input field
setTimeout(() => {
  const input = document.getElementById('chatWindowInput');
  if (input) {
    input.addEventListener('input', window.onInputTyping);
  }
}, 500);

// ===== 6. ADD REACTION (EMOJI) =====
window.addReaction = async function(messageId, emoji) {
  if (!_currentUser) return;
  const roomId = currentConvoId === '__server__'
    ? '__server__'
    : getDmId(_currentUser.uid, currentConvoId);
  
  try {
    const msgRef = doc(db, 'chats', roomId, 'messages', messageId);
    
    // Kiểm tra đã reaction chưa
    const msgSnap = await getDoc(msgRef);
    const reactions = msgSnap.data().reactions || [];
    
    const existingIdx = reactions.findIndex(
      r => r.uid === _currentUser.uid && r.emoji === emoji
    );
    
    if (existingIdx >= 0) {
      // Xoá reaction nếu đã có
      reactions.splice(existingIdx, 1);
    } else {
      // Thêm reaction mới
      reactions.push({
        emoji: emoji,
        uid: _currentUser.uid,
        timestamp: serverTimestamp()
      });
    }
    
    await updateDoc(msgRef, { reactions });
  } catch(e) { console.error('Lỗi reaction:', e); }
};

// ===== 7. BLOCK USER =====
window.blockUser = async function(blockUid) {
  if (!_currentUser) return;
  try {
    await updateDoc(doc(db, 'users', _currentUser.uid), {
      blockedUsers: arrayUnion(blockUid)
    });
    window.showToast('✅ Đã chặn người dùng', 'success');
  } catch(e) {
    window.showToast('❌ Chặn thất bại!', 'error');
  }
};

window.unblockUser = async function(blockUid) {
  if (!_currentUser) return;
  try {
    await updateDoc(doc(db, 'users', _currentUser.uid), {
      blockedUsers: arrayRemove(blockUid)
    });
    window.showToast('✅ Đã bỏ chặn', 'success');
  } catch(e) {
    window.showToast('❌ Bỏ chặn thất bại!', 'error');
  }
};

// ===== 8. GET UNREAD COUNT =====
window.getUnreadCount = async function(roomId, callback) {
  if (!_currentUser) { callback(0); return; }
  
  try {
    const chatRef = doc(db, 'chats', roomId);
    const chatSnap = await getDoc(chatRef);
    
    if (!chatSnap.exists()) { callback(0); return; }
    
    const readBy = chatSnap.data().readBy || {};
    const lastReadTime = readBy[_currentUser.uid];
    
    if (!lastReadTime) { callback(999); return; } // Chưa đọc
    
    // Đếm tin nhắn sau lastReadTime
    const q = query(
      collection(db, 'chats', roomId, 'messages'),
      where('createdAt', '>', lastReadTime)
    );
    
    const snap = await getDocs(q);
    callback(snap.size);
  } catch(e) { callback(0); }
};

// ===== 9. CLEAR CHAT HISTORY =====
window.clearChatHistory = async function(roomId) {
  if (!confirm('Bạn chắc chắn muốn xoá tất cả tin nhắn?')) return;
  
  try {
    const snap = await getDocs(collection(db, 'chats', roomId, 'messages'));
    const batch = writeBatch(db);
    
    snap.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    await batch.commit();
    window.showToast('✅ Đã xoá lịch sử chat', 'success');
  } catch(e) {
    console.error('Lỗi xoá lịch sử:', e);
    window.showToast('❌ Xoá thất bại!', 'error');
  }
};

// ===== 10. EXPORT CHAT (Download JSON) =====
window.exportChat = async function(roomId, filename = 'chat.json') {
  try {
    const snap = await getDocs(
      query(collection(db, 'chats', roomId, 'messages'), orderBy('createdAt'))
    );
    
    const messages = [];
    snap.forEach(doc => {
      messages.push(doc.data());
    });
    
    const dataStr = JSON.stringify(messages, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    
    window.showToast('✅ Đã tải xuống chat', 'success');
  } catch(e) {
    console.error('Lỗi export:', e);
    window.showToast('❌ Tải xuống thất bại!', 'error');
  }
};

// ===== 11. SEARCH MESSAGES =====
window.searchMessages = async function(roomId, keyword, callback) {
  try {
    const snap = await getDocs(
      collection(db, 'chats', roomId, 'messages')
    );
    
    const results = [];
    snap.forEach(doc => {
      const text = doc.data().text || '';
      if (text.toLowerCase().includes(keyword.toLowerCase())) {
        results.push({ id: doc.id, ...doc.data() });
      }
    });
    
    callback(results);
  } catch(e) {
    console.error('Lỗi search:', e);
    callback([]);
  }
};

// ===== 12. PIN MESSAGE =====
window.pinMessage = async function(messageId, roomId) {
  if (!_currentUser) return;
  try {
    await updateDoc(doc(db, 'chats', roomId), {
      pinnedMessage: { messageId, pinnedBy: _currentUser.uid, pinnedAt: serverTimestamp() }
    });
    window.showToast('📌 Đã ghim tin nhắn', 'success');
  } catch(e) {
    window.showToast('❌ Ghim thất bại!', 'error');
  }
};

console.log('✅ Chat features loaded successfully!');
