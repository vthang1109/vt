/**
 * sound.js — VTWorld Sound Effects Utility
 *
 * Cách dùng:
 *   import { play, toggle, isOn } from '../../assets/sound.js';
 *   play('correct');   // phát âm thanh
 *   toggle();          // bật/tắt
 *
 * Files mặc định trong assets/audio/:
 *   correct.ogg  — đúng
 *   wrong.mp3    — sai (chưa có, fallback về correct)
 *   theme.mp3    — nhạc nền
 *   final.ogg    — câu cuối
 *   bg.mp3       — nhạc nền phụ
 */

let _enabled = true;
const _cache = {};

const BASE = (() => {
  const s = document.currentScript;
  if (s && s.src) return s.src.substring(0, s.src.lastIndexOf('/') + 1) + 'audio/';
  return 'assets/audio/';
})();

const FILES = {
  correct:  'correct.ogg',
  wrong:    'correct.ogg', // fallback: dùng correct.ogg nếu chưa có wrong
  theme:    'theme.mp3',
  final:    'final.ogg',
  bg:       'bg.mp3',
  tick:     'correct.ogg', // fallback
};

/**
 * Phát âm thanh. 
 * @param {string} name  - key trong FILES (correct, wrong, theme, final, bg, tick)
 * @param {object} opts  - { loop, volume }
 */
export function play(name, opts = {}) {
  if (!_enabled) return;
  const file = FILES[name] || FILES.correct;
  const url = BASE + file;
  try {
    let a = _cache[name];
    if (!a) {
      a = new Audio(url);
      _cache[name] = a;
    }
    if (opts.loop) a.loop = true;
    if (opts.volume != null) a.volume = opts.volume;
    a.currentTime = 0;
    a.play().catch(() => {});
  } catch (e) { /* silent fail */ }
}

/**
 * Phát âm thanh và tự động xoá sau khi phát xong (dùng cho hiệu ứng 1 lần).
 */
export function playOnce(name, opts = {}) {
  if (!_enabled) return;
  const file = FILES[name] || FILES.correct;
  const url = BASE + file;
  try {
    const a = new Audio(url);
    if (opts.volume != null) a.volume = opts.volume;
    a.play().catch(() => {});
  } catch (e) { /* silent fail */ }
}

/** Dừng âm thanh đang phát */
export function stop(name) {
  const a = _cache[name];
  if (a) { a.pause(); a.currentTime = 0; }
}

/** Dừng tất cả âm thanh */
export function stopAll() {
  Object.keys(_cache).forEach(k => stop(k));
}

/** Bật/tắt âm thanh, trả về trạng thái mới */
export function toggle() {
  _enabled = !_enabled;
  if (!_enabled) stopAll();
  return _enabled;
}

/** Kiểm tra âm thanh đang bật hay tắt */
export function isOn() {
  return _enabled;
}

/** Set trạng thái âm thanh */
export function setEnabled(val) {
  _enabled = !!val;
  if (!_enabled) stopAll();
}

export default { play, playOnce, stop, stopAll, toggle, isOn, setEnabled };
