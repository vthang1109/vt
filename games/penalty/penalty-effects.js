// ============================
// DỮ LIỆU HIỆU ỨNG CÚ SÚT
// ============================
export const PT_EFFECTS = [
  { id:'wind', name:'Gió', icon:'💨', desc:'Xoáy lốc cuốn bóng', color:'#38bdf8', price:0 },
  { id:'fire', name:'Lửa', icon:'🔥', desc:'Cháy bừng rực rỡ', color:'#f97316', price:0 },
  { id:'ice', name:'Băng', icon:'❄️', desc:'Băng giá lạnh lẽo', color:'#67e8f9', price:0 },
  { id:'leaf', name:'Lá', icon:'🍃', desc:'Lá cuốn theo cơn gió', color:'#84cc16', price:0 },
  { id:'rainbow', name:'Cầu vồng', icon:'🌈', desc:'Sắc màu rực rỡ', color:'#a78bfa', price:5000 },
  { id:'dark', name:'Hắc ám', icon:'💀', desc:'Bóng tối bao trùm', color:'#1a0000', price:20000 },
  { id:'thunder', name:'Sấm sét', icon:'⚡', desc:'Sét đánh rung trời', color:'#eab308', price:10000 },
  { id:'light', name:'Ánh sáng', icon:'✨', desc:'Chói lòa không gian', color:'#fef08a', price:10000 },
  { id:'clone', name:'Phân thân', icon:'👻', desc:'Bóng ma lập lòe', color:'#b48cfa', price:10000 },
  { id:'butterfly', name:'Hoa sen', icon:'🪷', desc:'Cánh sen bay theo bóng', color:'#ec4899', price:12000 },
  { id:'blackhole', name:'Hố đen', icon:'🕳️', desc:'Xuyên không qua hố đen', color:'#06b6d4', price:15000 },
];
export const PT_EFFECTS_STORAGE_KEY = 'vt_penalty_effects';
export function loadPenaltyEffects(){
  try{ const raw = localStorage.getItem(PT_EFFECTS_STORAGE_KEY); if(raw) return JSON.parse(raw); }catch(e){}
  return { owned:[], selected:[] };
}
export function savePenaltyEffects(data){
  try{ localStorage.setItem(PT_EFFECTS_STORAGE_KEY, JSON.stringify(data)); }catch(e){}
}

export function simAIPenalty() {
  const base = 2;
  const h = base + Math.floor(Math.random() * 4);
  const a = base + Math.floor(Math.random() * 4);
  return [h, a];
}

export function orientMatchScore(fixture, playerGoals, oppGoals){
  return fixture.home===0 ? [playerGoals, oppGoals] : [oppGoals, playerGoals];
}
