// ===================== PENALTY SHOOTOUT - CUP EDITION =====================
import { auth, addPoints } from '../../points.js';
import { COUNTRIES, FIFA_CODE3, abbr3, CUP_TOURNAMENTS, LEAGUE_LIST, buildRoundRobin, MODES, KIT_COLORS, flagColorCache, getFlagColors, applyTeamKit, SHOOTER_POSES, HAIR_HOME_HEX, HAIR_AWAY_HEX, JERSEY_SPECIAL_NUMBERS, randomJerseyNumber, _shooterImgCache, _loadImg, _hexToRgb, _rgbToHsl, _hslToRgb, _poseDataCache, _getPoseData, _dyeMaskLayer, _bodyLayerCache, _teamLayerCache, _hairLayerCache, _getSplitShooterLayers, renderShooterSprite, GK_POSITIONS, applyKeeperSprite, applyKeeperKit, prewarmKeeperKit, shuffle, getAllCountries, getRegionCountries, countryByCode, getTopCountries, flagImg, CLUB_MAP, clubByCode, getAllClubs, teamFlagSrc, getCupsByType, getLeaguesByType, cupById, leagueById, CLUB_COUNTRIES, clubCountry } from './penalty-countries.js';
import { PT_EFFECTS, PT_EFFECTS_STORAGE_KEY, loadPenaltyEffects, savePenaltyEffects, simAIPenalty, orientMatchScore } from './penalty-effects.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";



const ZONES = ['top-left','top-center','top-right','mid-left','mid-center','mid-right','bot-left','bot-center','bot-right'];
const TEAMTYPE_TABS = [
  { id:'national', icon:'🌍', name:'Quốc Gia' },
  { id:'club',     icon:'⚽', name:'CLB' },
];
const FLIGHT_MS_BY_STYLE={default:900,wind:650,fire:650,ice:650,leaf:650,rainbow:650,dark:650,thunder:650,light:650,clone:650,butterfly:650,blackhole:650,dragon:650};
const KEEPER_REACT_DELAY_MS = 130;

const AI_ACCURACY = 0.35;
// Mỗi giải (League hoặc Cup) có tiến trình lưu riêng biệt theo configId
// → 5 League + 5 Cup = 10 tiến trình độc lập, không đè lên nhau.
function saveKeyFor(mode, configId){
  if(mode==='league') return 'vt_penalty_save_league_'+(configId||'world')+'_v1';
  if(mode==='cup') return 'vt_penalty_save_cup_'+(configId||'worldcup')+'_v1';
  return null;
}

// ===== LỊCH SỬ THÀNH TÍCH =====
const PT_HISTORY_KEY = 'vt_penalty_history_v1';
const PT_HISTORY_MAX = 100;
function loadPenaltyHistory(){
  try{
    const raw = localStorage.getItem(PT_HISTORY_KEY);
    if(raw){
      const list = JSON.parse(raw);
      // Chỉ giữ kết quả giải đấu (vô địch/hạng); bỏ các trận đấu lẻ ghi trước đây
      if(Array.isArray(list)){
        const clean = list.filter(e => e && e.kind === 'tournament');
        if(clean.length !== list.length) savePenaltyHistory(clean);
        return clean;
      }
    }
  }catch(e){}
  return [];
}
function savePenaltyHistory(list){
  try{ localStorage.setItem(PT_HISTORY_KEY, JSON.stringify(list.slice(0, PT_HISTORY_MAX))); }catch(e){}
}

export class PenaltyGame {
  constructor() {
    this._shooterReq = 0; // token chống race giữa 2 promise màu cờ đội nhà/đội khách
    this.state = {
      modeId: 'nhanh',
      teamType: 'national', // 'national' | 'club' — tab Quốc Gia / CLB
      playerCountry: getAllCountries().find(c=>c.code==='vn') || getAllCountries()[0],
      aiCountry: this.randomCountry(null),
      tournament: CUP_TOURNAMENTS[0],
      league: LEAGUE_LIST[0],
      is2Player: false,
      // match state
      round:0, maxRounds:5, scores:[0,0], history:[], _dotsBaseP:0, _dotsBaseA:0,
      currentShooter:'player', phase:'idle', shotLocked:false, _pendingAiZone:null,
      // league
      leagueTeams:[], leagueTable:{}, leagueRounds:[], leagueRoundIdx:0,
      // cup
      cupConfig: null,
      cupTeams: [],
      cupGroups: [],          // [{name,teams,matches,rounds,table}]
      cupGroupMatchQueue: [], // [{groupIdx, matchIdx}]
      cupGroupMatchPtr: 0,
      cupQualifiers: [],      // [{teamIdx,groupName,groupPos}]
      cupPhase: null,         // 'group'|'transition'|'knockout'
      cupKnockoutRounds: [],// [{name, matches:[{home,away,result}]}]
      cupKnockoutMatchPtr: 0,
      _matchContext: null,   // {type:'cup-group'|'cup-knockout', groupIdx, matchIdx, roundIdx}
      // effect
      _effectOwned: [],
      _effectSelected: [],
    };
    // Chế độ hiệu suất thấp — máy yếu: giảm hạt + bỏ trail SVG đường bay
    this._lowPerf = localStorage.getItem('vt_penalty_lowperf') === '1';
    // Flush tiến trình đang chờ debounce ngay khi đóng/ẩn tab — đặt ở CONSTRUCTOR
    // để MP (override _init mà không gọi super._init) cũng nhận được listener.
    window.addEventListener('pagehide', ()=>{
      if(this._saveTimer){ clearTimeout(this._saveTimer); this._saveTimer=null; this._writeProgress(); }
    });
    // Load effects from localStorage — normalize dữ liệu cũ (string → array)
    const saved = loadPenaltyEffects();
    const rawOwned = saved.owned;
    const rawSelected = saved.selected;
    this.state._effectOwned = Array.isArray(rawOwned) ? rawOwned : [];
    this.state._effectSelected = Array.isArray(rawSelected) ? rawSelected : [];
    this._pendingBuyEffectId = null;
    // Hiệu ứng mặc định luôn miễn phí & tự sở hữu; tài khoản chưa chọn gì → mặc định chọn nó
    let _effDirty = false;
    if(!this.state._effectOwned.includes('default')){
      this.state._effectOwned.push('default');
      _effDirty = true;
    }
    if(!this.state._effectSelected.length){
      this.state._effectSelected = ['default'];
      _effDirty = true;
    }
    if(_effDirty){
      const data = loadPenaltyEffects();
      data.owned = [...this.state._effectOwned];
      data.selected = [...this.state._effectSelected];
      savePenaltyEffects(data);
    }
    // Pre-warm sớm toàn bộ ảnh sprite KHÔNG phụ thuộc đội tuyển (4 tư thế cầu
    // thủ + thủ môn đen) ngay khi mở trang — không chờ đến lúc vào trận mới tải.
    // MP: guest nhận snapshot phase 'shooting' đầu tiên là lúc phải tải + decode
    // ~20 ảnh + vòng pixel nhuộm — chính là lý do "bên kia load trễ 3-5s sau khi
    // host bắt đầu". Pre-warm từ constructor làm mọi ảnh đã nóng trong cache
    // (_shooterImgCache/_poseDataCache/_gkTintSrcCache), vào trận chỉ còn nhuộm
    // màu theo đội (nhanh hơn nhiều).
    this._prewarmStaticAssets();
    this._init();
  }

  // Tải + decode trước ảnh sprite dùng chung cho MỌI trận đấu:
  // - 4 tư thế cầu thủ (base + 4 mask) qua _getPoseData
  // - 7 WebP thủ môn + nhuộm đen qua prewarmKeeperKit
  // Fire-and-forget — mọi promise đều có .catch để không vỡ luồng khởi tạo.
  _prewarmStaticAssets(){
    Object.keys(SHOOTER_POSES).forEach(pose=>{
      _getPoseData(pose).catch(()=>{});
    });
    prewarmKeeperKit().catch(()=>{});
  }

  _init() {
    onAuthStateChanged(auth, u=>{
      if(!u){location.href='../../index.html';return}
      this.renderModes(); this.renderTeamType(); this.renderTournaments(); this.renderLeagues(); this.renderFlags(); this.bindEvents(); this.showMenu();
    });
  }

  randomCountry(excludeCode) {
    // LƯU Ý: constructor gọi randomCountry() trong lúc object literal state đang được tạo,
    // nên this.state CHƯA tồn tại — phải guard bằng (this.state && ...) để không vỡ.
    const all = (this.state && this.state.teamType==='club') ? getAllClubs() : getAllCountries();
    let c;
    do{c=all[Math.floor(Math.random()*all.length)]}while(c.code===excludeCode);
    return c;
  }

  // ===== TEAM TYPE =====
  setTeamType(type){
    if(!type || type===this.state.teamType) return;
    this.state.teamType = type;
    this.renderTeamType();
    this.renderTournaments();
    this.renderLeagues();
    // Đổi hệ thống đội → ép về đội hợp lệ của loại mới (renderFlags tự chuyển)
    this.renderFlags();
    this._updateContinueCard();
    this._updatePlayButton();
  }

  // ===== RENDER UI =====
  renderModes() {
    const c=document.getElementById('pt-mode-row');
    c.innerHTML=MODES.map((m,i)=>`<button class="pt-mode-btn ${i===0?'selected':''}" data-mode="${m.id}">
      <span class="mode-label">${m.name}</span>
    </button>`).join('');
  }

  renderTeamType() {
    const c=document.getElementById('pt-teamtype-row');
    if(!c)return;
    const t=this.state.teamType||'national';
    c.innerHTML=TEAMTYPE_TABS.map(x=>`<button class="pt-teamtype-tab ${x.id===t?'selected':''}" data-teamtype="${x.id}">${x.icon} ${x.name}</button>`).join('');
  }

  renderTournaments() {
    const c=document.getElementById('pt-tournament-row');
    const list=getCupsByType(this.state.teamType||'national');
    if(!list.find(t=>t.id===(this.state.tournament&&this.state.tournament.id))){
      this.state.tournament=list[0]||CUP_TOURNAMENTS[0];
    }
    c.innerHTML=list.map(t=>`<button class="pt-tournament-btn ${t.id===this.state.tournament.id?'selected':''}" data-id="${t.id}">${t.icon} ${t.name}</button>`).join('');
  }

  renderLeagues() {
    const c=document.getElementById('pt-league-row');
    if(!c)return;
    const list=getLeaguesByType(this.state.teamType||'national');
    if(!list.find(l=>l.id===(this.state.league&&this.state.league.id))){
      this.state.league=list[0]||LEAGUE_LIST[0];
    }
    c.innerHTML=list.map(l=>`<button class="pt-tournament-btn ${l.id===this.state.league.id?'selected':''}" data-id="${l.id}">${l.icon} ${l.name}</button>`).join('');
  }

  renderFlags(query) {
    const c=document.getElementById('pt-flag-grid');
    if(!c)return;
    let countries;
    if(this.state.modeId==='cup'){
      const tour=this.state.tournament;
      countries=tour.region?getRegionCountries(tour.region):getAllCountries();
    }else if(this.state.modeId==='league'){
      const lg=this.state.league;
      countries=lg&&lg.clubs?lg.clubs.map(code=>CLUB_MAP[code]).filter(Boolean):(lg&&lg.region?getRegionCountries(lg.region):getAllCountries());
    }else{
      countries = this.state.teamType==='club' ? getAllClubs() : getAllCountries();
    }
    if(!countries.find(x=>x.code===this.state.playerCountry.code)){
      this.state.playerCountry=countries[0]||getAllCountries()[0];
      this.state.aiCountry=this.randomCountry(this.state.playerCountry.code);
      // LƯU Ý: không gọi _invalidateProgressForTeamChange ở đây — việc tự đổi đội
      // khi chuyển giải là hành động của hệ thống, không phải người chơi cố ý đổi
      // đội → vẫn phải cho phép "Tiếp tục" tiến trình đang lưu của giải đó.
    }

    const q=(query||'').trim().toLowerCase();
    const matches=x=>!q||x.name.toLowerCase().includes(q);
    const btn=x=>`<button class="pt-flag-btn ${x.code===this.state.playerCountry.code?'selected':''}" data-code="${x.code}" title="${x.name}">
      <span class="pt-flag-emoji">${flagImg(x.code, x.name, 32)}</span>
      <span class="pt-flag-label">${x.name}</span>
    </button>`;

    let html='';
    // Việt Nam luôn ở đầu tiên
    const vn=countries.find(x=>x.code==='vn');
    if(vn && matches(vn)){
      html+=`<div class="pt-flag-group-label">⭐ Nổi bật</div><div class="pt-flag-group">${btn(vn)}</div>`;
    }
    // Sau đó chia theo khu vực để dễ tìm
    for(const region of Object.values(COUNTRIES)){
      const list=region.list.filter(x=>x.code!=='vn' && countries.includes(x) && matches(x));
      if(!list.length)continue;
      html+=`<div class="pt-flag-group-label">${region.name}</div><div class="pt-flag-group">${list.map(btn).join('')}</div>`;
    }
    // Câu lạc bộ — xếp theo nước (Anh, Tây Ban Nha, Ý, Đức, Pháp, Bồ Đào Nha, Hà Lan)
    const clubList=countries.filter(x=>CLUB_MAP[x.code] && x.code!=='vn' && matches(x));
    if(clubList.length){
      const groups={};
      for(const club of clubList){
        const ctry=clubCountry(club.code);
        (groups[ctry]=groups[ctry]||[]).push(club);
      }
      const order=Object.keys(CLUB_COUNTRIES);
      const keys=Object.keys(groups).sort((a,b)=>{
        const ia=order.indexOf(a), ib=order.indexOf(b);
        return (ia<0?99:ia)-(ib<0?99:ib);
      });
      for(const ctry of keys){
        const info=CLUB_COUNTRIES[ctry]||{name:'Khác',flag:'⚽'};
        html+=`<div class="pt-flag-group-label">${info.flag} ${info.name}</div><div class="pt-flag-group">${groups[ctry].map(btn).join('')}</div>`;
      }
    }
    c.innerHTML=html || `<div class="pt-flag-empty">Không tìm thấy quốc gia</div>`;
    // Update country picker
    this._updateCountryPicker();
  }

  _updateCountryPicker(){
    const flag=document.getElementById('pt-country-flag');
    const name=document.getElementById('pt-country-name');
    if(!flag||!name)return;
    const pc=this.state.playerCountry;
    flag.innerHTML=flagImg(pc.code, pc.name, 32);
    name.textContent=pc.name;
  }

  openCountryPopup(){
    const search=document.getElementById('pt-country-search');
    if(search)search.value='';
    this.renderFlags();
    const modal=document.getElementById('pt-country-modal');
    if(modal)modal.classList.add('active');
    if(search)setTimeout(()=>search.focus(),150);
  }

  closeCountryPopup(){
    const modal=document.getElementById('pt-country-modal');
    if(modal)modal.classList.remove('active');
  }

  // ===== BIND EVENTS =====
  bindEvents() {
    // Mode
    document.getElementById('pt-mode-row').addEventListener('click',e=>{
      const b=e.target.closest('.pt-mode-btn');if(!b)return;
      document.querySelectorAll('.pt-mode-btn').forEach(x=>x.classList.remove('selected'));b.classList.add('selected');
      this.state.modeId=b.dataset.mode;
      const showCup=this.state.modeId==='cup';
      const showLeague=this.state.modeId==='league';
      document.getElementById('pt-tournament-panel').style.display=showCup?'':'none';
      const lp=document.getElementById('pt-league-panel');
      if(lp)lp.style.display=showLeague?'':'none';
      this._updateContinueCard();
      this._updatePlayButton();
      this.renderFlags();
    });

    // Team type (Quốc Gia / CLB)
    document.getElementById('pt-teamtype-row').addEventListener('click',e=>{
      const b=e.target.closest('.pt-teamtype-tab');if(!b)return;
      this.setTeamType(b.dataset.teamtype);
    });

    // Tournaments
    document.getElementById('pt-tournament-row').addEventListener('click',e=>{
      const b=e.target.closest('.pt-tournament-btn');if(!b)return;
      document.querySelectorAll('#pt-tournament-row .pt-tournament-btn').forEach(x=>x.classList.remove('selected'));b.classList.add('selected');
      this.state.tournament=cupById(b.dataset.id)||getCupsByType(this.state.teamType||'national')[0];
      if(this.state.modeId==='cup'){this.renderFlags();this._updateContinueCard();this._updatePlayButton();}
    });

    // Leagues
    const lgRow=document.getElementById('pt-league-row');
    if(lgRow)lgRow.addEventListener('click',e=>{
      const b=e.target.closest('.pt-tournament-btn');if(!b)return;
      document.querySelectorAll('#pt-league-row .pt-tournament-btn').forEach(x=>x.classList.remove('selected'));b.classList.add('selected');
      this.state.league=leagueById(b.dataset.id)||getLeaguesByType(this.state.teamType||'national')[0];
      if(this.state.modeId==='league'){this.renderFlags();this._updateContinueCard();this._updatePlayButton();}
    });

    // Flags (in modal)
    document.getElementById('pt-flag-grid').addEventListener('click',e=>{
      const b=e.target.closest('.pt-flag-btn');if(!b)return;
      document.querySelectorAll('.pt-flag-btn').forEach(x=>x.classList.remove('selected'));b.classList.add('selected');
      const found=countryByCode(b.dataset.code)||clubByCode(b.dataset.code);
      if(found){
        this.state.playerCountry=found;
        this.state.aiCountry=this.randomCountry(found.code);
        this._updateCountryPicker();
        // Chọn đội khác với đội trong tiến trình đang lưu → xoá tiến trình cũ để
        // nút Play không bị kẹt ở chế độ "Tiếp tục" (restore về đội cũ, ví dụ VN)
        this._invalidateProgressForTeamChange();
        this.closeCountryPopup();
      }
    });

    // Country search
    document.getElementById('pt-country-search').addEventListener('input',e=>{
      this.renderFlags(e.target.value);
    });

    // Country modal close
    document.getElementById('pt-country-modal-close').addEventListener('click',()=>this.closeCountryPopup());
    document.getElementById('pt-country-modal').addEventListener('click',e=>{
      if(e.target===e.currentTarget)this.closeCountryPopup();
    });

    // Play
    document.getElementById('pt-play-btn').addEventListener('click',()=>{
      const btn=document.getElementById('pt-play-btn');
      if(btn.dataset.continue==='1'){
        const mode=this.state.modeId;
        const configId = mode==='league' ? this.state.league.id : this.state.tournament.id;
        this.restoreProgress(mode, configId);
      }else{
        this.startMode();
      }
    });

    // Continue saved progress (League + Cup riêng)
    const cbL=document.getElementById('pt-continue-btn-league');
    if(cbL)cbL.addEventListener('click',()=>this.restoreProgress('league', this.state.league.id));
    const dbL=document.getElementById('pt-discard-btn-league');
    if(dbL)dbL.addEventListener('click',(e)=>{e.stopPropagation();this.clearProgress('league', this.state.league.id);this._updateContinueCard();this._updatePlayButton();});
    const cbC=document.getElementById('pt-continue-btn-cup');
    if(cbC)cbC.addEventListener('click',()=>this.restoreProgress('cup', this.state.tournament.id));
    const dbC=document.getElementById('pt-discard-btn-cup');
    if(dbC)dbC.addEventListener('click',(e)=>{e.stopPropagation();this.clearProgress('cup', this.state.tournament.id);this._updateContinueCard();this._updatePlayButton();});

    // In-game — shoot or defend
    document.getElementById('pt-goal-grid').addEventListener('click',e=>{
      const z=e.target.closest('.pt-zone');if(!z||this.state.shotLocked)return;
      if(this.state.phase==='shooting'&&this.state.currentShooter==='player'){
        this.playerShoot(z.dataset.zone);
      }else if(this.state.phase==='defending'){
        this.playerDefend(z.dataset.zone);
      }
    });
    document.getElementById('pt-match-done-btn').addEventListener('click',()=>this.onMatchDone());

    // League / Cup next
    document.getElementById('pt-league-next').addEventListener('click',()=>this.playLeagueMatch());
    const gn=document.getElementById('pt-group-next');
    if(gn)gn.addEventListener('click',()=>this.playGroupMatch());
    const tn=document.getElementById('pt-transition-next');
    if(tn)tn.addEventListener('click',()=>this.advanceToKnockout());
    const kn=document.getElementById('pt-knockout-next');
    if(kn)kn.addEventListener('click',()=>this.playKnockoutMatch());

    // Hiệu ứng cú sút — click bar mở modal chứa tất cả hiệu ứng
    document.getElementById('pt-effect-panel').addEventListener('click',()=>{
      this.openEffectModal();
    });
    // Modal effect grid — chọn/bỏ chọn / mua + gợi ý
    document.getElementById('pt-effect-modal-grid').addEventListener('click',e=>{
      const btn = e.target.closest('.pt-effect-modal-btn');
      if(btn) return this._handleEffectModalClick(btn.dataset.effectId);
      const sug = e.target.closest('.pt-effect-suggestion span');
      if(sug && sug.dataset.effectId) return this._handleEffectModalClick(sug.dataset.effectId);
      // Select-all checkbox
      const cb = e.target.closest('.pt-select-all-cb');
      if(cb) return this._handleSelectAll(cb.checked);
    });
    // Modal apply
    document.getElementById('pt-effect-apply-btn').addEventListener('click',()=>this._applyEffectSelection());
    // Modal close / cancel
    document.getElementById('pt-effect-modal-close').addEventListener('click',()=>this.closeEffectModal());
    document.getElementById('pt-effect-modal-cancel').addEventListener('click',()=>this.closeEffectModal());
    document.getElementById('pt-effect-modal').addEventListener('click',e=>{
      if(e.target===e.currentTarget) this.closeEffectModal();
    });

    // Confirm mua hiệu ứng
    document.getElementById('pt-buy-confirm-btn').addEventListener('click',()=>this._confirmBuy());
    document.getElementById('pt-buy-confirm-cancel').addEventListener('click',()=>this._cancelBuy());
    document.getElementById('pt-buy-confirm-close').addEventListener('click',()=>this._cancelBuy());
    document.getElementById('pt-buy-confirm-modal').addEventListener('click',e=>{
      if(e.target===e.currentTarget) this._cancelBuy();
    });

    // Chế độ hiệu suất thấp
    const lpBtn=document.getElementById('pt-lowperf-btn');
    if(lpBtn) lpBtn.addEventListener('click',()=>this._toggleLowPerf());
    this._renderLowPerfToggle();

    // Lịch sử thành tích
    const hb=document.getElementById('pt-history-btn');
    if(hb) hb.addEventListener('click',()=>this.openHistoryModal());
    const hc=document.getElementById('pt-history-modal-close');
    if(hc) hc.addEventListener('click',()=>this.closeHistoryModal());
    const hClose=document.getElementById('pt-history-close');
    if(hClose) hClose.addEventListener('click',()=>this.closeHistoryModal());
    const hcl=document.getElementById('pt-history-clear');
    if(hcl) hcl.addEventListener('click',(e)=>{e.stopPropagation();this.clearHistory();});
    const hm=document.getElementById('pt-history-modal');
    if(hm) hm.addEventListener('click',e=>{if(e.target===e.currentTarget)this.closeHistoryModal();});

    setTimeout(()=>{
      if(window.TopNav?.setLeaveAction)window.TopNav.setLeaveAction(()=>this.showScreen('pt-menu'));
    },100);
  }

  // ===== MENU / SCREEN CONTROL =====
  _hideResultShooters(){
    this._stopVictoryFlags();
    ['pt-shooter-player','pt-shooter-ai'].forEach(id=>{
      const el=document.getElementById(id);
      if(el) el.style.display='none';
    });
    // Ẩn cờ khung thành
    const goalFlag=document.getElementById('pt-goal-flag');
    if(goalFlag) goalFlag.style.display='none';
    this._clearStandFlags();
  }

  showMenu(){
    this._hideResultShooters();
    ['pt-menu','pt-game','pt-league-view','pt-cup-group-view','pt-cup-transition','pt-cup-knockout-view'].forEach(id=>{
      const e=document.getElementById(id);
      if(e){e.classList.toggle('active',id==='pt-menu');e.style.display=id==='pt-menu'?'':'none'}
    });
    document.getElementById('pt-result-overlay').style.display='none';
    document.getElementById('pt-match-info').style.display='none';
    this._updateContinueCard();
    this._updatePlayButton();
    this.renderEffectsPanel();
  }

  // ===== HIỆU ỨNG CÚ SÚT =====
  renderEffectsPanel(){
    const iconEl = document.getElementById('pt-effect-bar-icon');
    const nameEl = document.getElementById('pt-effect-bar-name');
    if(!iconEl || !nameEl) return;
    const selected = this.state._effectSelected || [];
    const owned = this.state._effectOwned || [];
    // Filter to valid selected effects
    const valid = selected.filter(id => PT_EFFECTS.find(e=>e.id===id));
    if(valid.length === 0){
      iconEl.textContent = '⚽';
      nameEl.textContent = 'Chưa chọn';
      nameEl.style.color = '#94a3b8';
      iconEl.style.filter = 'none';
    } else if(valid.length === 1){
      const eff = PT_EFFECTS.find(e=>e.id===valid[0]);
      iconEl.textContent = eff.icon;
      nameEl.textContent = eff.name;
      nameEl.style.color = '#e0f2fe';
      iconEl.style.filter = `drop-shadow(0 0 6px ${eff.color}80)`;
    } else {
      const first = PT_EFFECTS.find(e=>e.id===valid[0]);
      iconEl.textContent = '✨';
      nameEl.textContent = `${valid.length} hiệu ứng`;
      nameEl.style.color = '#c4b5fd';
      iconEl.style.filter = first ? `drop-shadow(0 0 6px ${first.color}80)` : 'none';
    }
  }

  // === Modal hiệu ứng ===
  openEffectModal(){
    const modal = document.getElementById('pt-effect-modal');
    if(!modal) return;
    // Lưu tạm selected vào dataset để có thể hủy
    this._tempSelected = [...(this.state._effectSelected || [])];
    this.renderEffectModalGrid();
    modal.classList.add('active');
  }

  closeEffectModal(){
    const modal = document.getElementById('pt-effect-modal');
    if(modal) modal.classList.remove('active');
    this._tempSelected = null;
  }

  renderEffectModalGrid(){
    const grid = document.getElementById('pt-effect-modal-grid');
    if(!grid) return;
    const owned = this.state._effectOwned || [];
    const tempSel = this._tempSelected || [];
    const allOwned = PT_EFFECTS.every(e => owned.includes(e.id));
    // Tính xem có bao nhiêu hiệu ứng có thể chọn (đã sở hữu hoặc miễn phí)
    const selectable = PT_EFFECTS.filter(e => owned.includes(e.id) || e.price === 0);
    const allSelected = selectable.length > 0 && selectable.every(e => tempSel.includes(e.id));
    let html = `<div class="pt-select-all-row">
      <label class="pt-select-all-label">
        <input type="checkbox" class="pt-select-all-cb" ${allSelected?'checked':''} />
        <span>Chọn tất cả (${selectable.length} hiệu ứng)</span>
      </label>
      <span class="pt-select-all-count">${tempSel.length} đã chọn</span>
    </div>`;
    html += PT_EFFECTS.map(e => {
      const isOwned = owned.includes(e.id);
      const isSelected = tempSel.includes(e.id);
      const locked = !isOwned;
      const isFree = e.price === 0;
      let statusHtml = '';
      if(locked){
        if(isFree){
          statusHtml = `<span class="pt-effect-modal-status">🎁 Miễn phí</span>`;
        } else {
          statusHtml = `<span class="pt-effect-modal-price"><span class="pt-price-icon">💰</span> ${e.price.toLocaleString('vi-VN')}</span>`;
        }
      } else {
        statusHtml = `<span class="pt-effect-modal-status">${isSelected ? '✓ Đã chọn' : 'Đã sở hữu'}</span>`;
      }
      return `<button class="pt-effect-modal-btn ${isSelected?'selected':''} ${isOwned?'owned':''} ${locked?'locked':''}" data-effect-id="${e.id}">
        <div class="pt-effect-modal-bg" style="background:radial-gradient(circle,${e.color}20,transparent 70%)"></div>
        <div class="pt-effect-modal-check">${isSelected ? '✓' : ''}</div>
        <span class="pt-effect-modal-icon">${e.icon}</span>
        <span class="pt-effect-modal-name">${e.name}</span>
        <span class="pt-effect-modal-desc-text">${e.desc}</span>
        ${statusHtml}
      </button>`;
    }).join('');
    // Gợi ý hiệu ứng chưa mua (paid) — chỉ hiện nếu còn
    const lockedPaid = PT_EFFECTS.filter(e => e.price > 0 && !owned.includes(e.id));
    if(lockedPaid.length > 0){
      html += `<div class="pt-effect-suggestion">💡 Mới: ${lockedPaid.map(e =>
        `<span data-effect-id="${e.id}">${e.icon} ${e.name} (💰${e.price.toLocaleString('vi-VN')})</span>`
      ).join(' ')}</div>`;
    }
    grid.innerHTML = html;
  }

  _handleSelectAll(checked){
    if(!this._tempSelected) this._tempSelected = [];
    const owned = this.state._effectOwned || [];
    // Các hiệu ứng có thể chọn: đã sở hữu hoặc miễn phí
    const selectable = PT_EFFECTS.filter(e => owned.includes(e.id) || e.price === 0).map(e=>e.id);
    if(checked){
      // Thêm tất cả vào _tempSelected (tránh trùng)
      selectable.forEach(id => {
        if(!this._tempSelected.includes(id)) this._tempSelected.push(id);
      });
    } else {
      // Bỏ tất cả
      this._tempSelected = this._tempSelected.filter(id => !selectable.includes(id));
    }
    this.renderEffectModalGrid();
  }

  _handleEffectModalClick(effectId){
    const effect = PT_EFFECTS.find(e=>e.id===effectId);
    if(!effect) return;
    const owned = this.state._effectOwned || [];
    if(!owned.includes(effectId)){
      // Chưa sở hữu → free thì mua luôn, paid thì confirm
      if(effect.price > 0){
        this._showBuyConfirm(effectId);
        return;
      }
      // Free — mua ngay
      owned.push(effectId);
      this.state._effectOwned = owned;
      const data = loadPenaltyEffects();
      data.owned = [...owned];
      if(!this._tempSelected) this._tempSelected = [];
      if(!this._tempSelected.includes(effectId)) this._tempSelected.push(effectId);
      savePenaltyEffects(data);
      this.renderEffectModalGrid();
      this.renderEffectsPanel();
    } else {
      // Đã sở hữu → toggle chọn/bỏ chọn
      if(!this._tempSelected) this._tempSelected = [];
      const idx = this._tempSelected.indexOf(effectId);
      if(idx >= 0){
        this._tempSelected.splice(idx, 1);
      } else {
        this._tempSelected.push(effectId);
      }
      this.renderEffectModalGrid();
    }
  }

  _showBuyConfirm(effectId){
    const effect = PT_EFFECTS.find(e=>e.id===effectId);
    if(!effect) return;
    this._pendingBuyEffectId = effectId;
    document.getElementById('pt-buy-icon').textContent = effect.icon;
    document.getElementById('pt-buy-name').textContent = effect.name;
    document.getElementById('pt-buy-desc').textContent = effect.desc;
    document.getElementById('pt-buy-price').textContent = `💰 ${effect.price.toLocaleString('vi-VN')} điểm`;
    const modal = document.getElementById('pt-buy-confirm-modal');
    if(modal) modal.classList.add('active');
  }

  _confirmBuy(){
    const effectId = this._pendingBuyEffectId;
    this._pendingBuyEffectId = null;
    if(!effectId) return;
    const effect = PT_EFFECTS.find(e=>e.id===effectId);
    if(!effect) return;
    const modal = document.getElementById('pt-buy-confirm-modal');
    if(modal) modal.classList.remove('active');
    const owned = this.state._effectOwned || [];
    if(owned.includes(effectId)) return; // đã mua rồi
    // Trừ points
    import('../../points.js').then(mod => {
      mod.addPoints('Penalty', `Mua hiệu ứng ${effect.name}`, -effect.price).catch(()=>{});
    });
    owned.push(effectId);
    this.state._effectOwned = owned;
    const data = loadPenaltyEffects();
    data.owned = [...owned];
    if(!this._tempSelected) this._tempSelected = [];
    if(!this._tempSelected.includes(effectId)) this._tempSelected.push(effectId);
    savePenaltyEffects(data);
    this.renderEffectModalGrid();
    this.renderEffectsPanel();
  }

  _cancelBuy(){
    this._pendingBuyEffectId = null;
    const modal = document.getElementById('pt-buy-confirm-modal');
    if(modal) modal.classList.remove('active');
  }

  _applyEffectSelection(){
    const selected = this._tempSelected || [];
    this.state._effectSelected = [...selected];
    const data = loadPenaltyEffects();
    data.selected = [...selected];
    data.owned = [...(this.state._effectOwned || [])];
    savePenaltyEffects(data);
    this.renderEffectsPanel();
    this.closeEffectModal();
  }

  // ===== LỊCH SỬ THÀNH TÍCH =====
  _recordHistory(entry){
    if(!entry) return;
    const list = loadPenaltyHistory();
    list.unshift(entry);
    savePenaltyHistory(list);
  }

  // Ước lượng hạng Cup khi đội nhà (index 0) không vô địch:
  // vào chung kết → 2; bị loại ở vòng r → matches.length+1 (R16→9, QF→5, SF→3).
  _estimateCupRank(rounds, isWin, finalMatch){
    if(isWin) return 1;
    if(finalMatch && (finalMatch.home===0 || finalMatch.away===0)) return 2;
    for(let r=0;r<(rounds||[]).length;r++){
      const lost = rounds[r].matches.some(m=>{
        if(m.home!==0 && m.away!==0) return false;
        if(!m.result) return false;
        const pScore = m.home===0 ? m.result[0] : m.result[1];
        const aScore = m.home===0 ? m.result[1] : m.result[0];
        return pScore < aScore;
      });
      if(lost) return rounds[r].matches.length + 1;
    }
    return 2; // mặc định á quân
  }

  openHistoryModal(){
    const modal = document.getElementById('pt-history-modal');
    if(!modal) return;
    this.renderHistoryModal();
    modal.classList.add('active');
  }

  closeHistoryModal(){
    const modal = document.getElementById('pt-history-modal');
    if(modal) modal.classList.remove('active');
  }

  clearHistory(){
    savePenaltyHistory([]);
    this.renderHistoryModal();
  }

  renderHistoryModal(){
    const statsEl = document.getElementById('pt-history-stats');
    const listEl = document.getElementById('pt-history-list');
    if(!statsEl || !listEl) return;
    const list = loadPenaltyHistory();
    // Thống kê thành tích giải đấu
    const total = list.length;
    const champs = list.filter(e=>e.result==='champion').length;
    const silver = list.filter(e=>e.result==='rank' && e.rank===2).length;
    const bronze = list.filter(e=>e.result==='rank' && e.rank===3).length;
    statsEl.innerHTML = `
      <div class="pt-hstat"><b>${total}</b><span>Giải</span></div>
      <div class="pt-hstat pt-hstat-cup"><b>${champs}</b><span>Vô địch</span></div>
      <div class="pt-hstat pt-hstat-silver"><b>${silver}</b><span>Hạng 2</span></div>
      <div class="pt-hstat pt-hstat-bronze"><b>${bronze}</b><span>Hạng 3</span></div>
    `;
    if(!list.length){
      listEl.innerHTML = `<div class="pt-history-empty">Chưa có thành tích giải đấu. Hãy tham gia League/Cúp ngay! 🏆</div>`;
      return;
    }
    listEl.innerHTML = list.slice(0, PT_HISTORY_MAX).map(e=>this._historyRowHtml(e)).join('');
  }

  _historyRowHtml(e){
    const d = new Date(e.ts);
    const date = d.toLocaleDateString('vi-VN',{day:'2-digit',month:'2-digit',year:'2-digit'}) + ' ' + d.toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit'});
    const modeIcon = e.mode==='cup' ? '🏆' : '📊';
    const isChamp = e.result==='champion';
    const rankTxt = isChamp ? '🏆 Vô địch!' : (e.rank===2 ? '🥈 Hạng 2' : (e.rank===3 ? '🥉 Hạng 3' : 'Hạng '+(e.rank||'?')));
    return `<div class="pt-hrow pt-hrow-tour ${isChamp?'pt-hrow-champ':''}">
      <div class="pt-hrow-icon">${modeIcon}</div>
      <div class="pt-hrow-main">
        <div class="pt-hrow-title">${e.label||''}</div>
        <div class="pt-hrow-sub">${flagImg(e.player.code, e.player.name, 13)} ${e.player.name} · ${rankTxt}</div>
      </div>
      <div class="pt-hrow-date">${date}</div>
    </div>`;
  }

  showScreen(id){
    this._hideResultShooters();
    ['pt-menu','pt-game','pt-league-view','pt-cup-group-view','pt-cup-transition','pt-cup-knockout-view'].forEach(x=>{
      const e=document.getElementById(x);
      if(!e)return;
      e.classList.toggle('active',x===id);
      e.style.display=x===id?'':'none';
    });
    document.getElementById('pt-result-overlay').style.display='none';
  }

  async showMatch(opponent,label, context){
    this.showScreen('pt-game');
    const mi=document.getElementById('pt-match-info');
    mi.style.display='';
    document.getElementById('pt-match-label').innerHTML=label||'';
    const pc=this.state.playerCountry,ac=opponent||this.state.aiCountry;
    this.state.aiCountry=ac;
    this.state.round=0;this.state.scores=[0,0];this.state.history=[];
    this.state._dotsBaseP=0;this.state._dotsBaseA=0;
    this.state.phase='idle';this.state.shotLocked=false;
    this.state.maxRounds=5;
    this.state._matchContext = context || null;
    this.state._matchLabel = label||'';
    getFlagColors(pc.code); getFlagColors(ac.code); // prefetch màu áo cho cả 2 đội, tránh chớp trắng ở lượt sút đầu
    // Làm nóng trước cache sprite cho các pose sẽ dùng lúc sút (kick/celebrate/
    // disappoint) — và giờ ĐỢI xong hẳn trước khi bắt đầu lượt 1, thay vì để
    // decode WebP + vòng pixel nặng rơi đúng lúc bóng bay cú sút đầu (nguyên
    // nhân "đứng đứng" ở cú sút đầu tiên trên máy yếu).
    const prewarmJobs=[];
    [pc,ac].forEach(team=>{
      if(!team) return;
      prewarmJobs.push(getFlagColors(team.code).then(kit=>{
        if(!kit) return;
        const poseJobs=[];
        ['mid-stand','kick','celebrate','disappoint'].forEach(pose=>{
          // Tóc cố định 2 màu (nhà trắng / khách đen) → pre-warm cả 2, hết miss random.
          [HAIR_HOME_HEX, HAIR_AWAY_HEX].forEach(hairHex=>{
            poseJobs.push(_getSplitShooterLayers(pose, kit.primary, kit.secondary, hairHex, kit.socks).catch(()=>{}));
          });
        });
        return Promise.all(poseJobs);
      }).catch(()=>{}));
    });
    // Pre-warm áo thủ môn WebP — nhuộm ĐEN cố định 1 lần cho mọi tư thế bay (không
    // phụ thuộc đội), tránh vòng lặp từng pixel đồng bộ (_gkColorizeWhite) chạy lúc
    // bóng đang bay. Đội nhà dùng ảnh gốc trắng nên chỉ cần pre-warm đen 1 lần là đủ.
    prewarmJobs.push(prewarmKeeperKit().catch(()=>{}));
    document.getElementById('pt-actions').style.display='none';
    document.getElementById('pt-match-done-btn').style.display='none';
    this.renderStatusBar();
    this._populateStandFlags([pc, ac]);
    // Đợi toàn bộ pre-warm hoàn tất (tối đa 4s cho máy cực chậm/mạng treo) rồi
    // mới bắt đầu lượt — mọi công việc nặng đã xong từ trước, cú sút đầu mượt.
    // Khóa bấm zone trong lúc chờ (startRound() sẽ mở khóa lại) — nếu không,
    // người chơi click vào pitch giữa khoảng chờ sẽ gọi playerShoot khi bóng/
    // chân sút chưa được reset về vị trí.
    this.state.shotLocked=true;
    const matchPrewarmP = Promise.all(prewarmJobs);
    // .catch để đề phòng 1 job pre-warm reject (dù mọi job đã có catch riêng) —
    // nếu throw thì startRound() không chạy → shotLocked kẹt true, game đơ vĩnh viễn.
    await Promise.race([matchPrewarmP, new Promise(r=>setTimeout(r,4000))]).catch(()=>{});
    this.startRound();
  }

  // Thêm cờ của 2 đội trên khán đài cổ vũ
  _populateStandFlags(teams){
    const container=document.getElementById('pt-stand-flags');
    if(!container) return;
    container.innerHTML='';
    const flagCount=12;
    for(let i=0;i<flagCount;i++){
      const team=teams[i%2];
      if(!team || !team.code) continue;
      const el=document.createElement('img');
      el.className='pt-stand-flag';
      el.src=teamFlagSrc(team.code);
      el.alt=team.name||'';
      // decoding=async + loading=lazy: cờ nền trang trí không được chặn vẽ
      // main thread lúc vào trận (12 ảnh SVG cùng lúc là gánh nặng thật trên máy yếu)
      el.decoding='async';
      el.loading='lazy';
      container.appendChild(el);
    }
  }

  _clearStandFlags(){
    const container=document.getElementById('pt-stand-flags');
    if(container) container.innerHTML='';
  }

  // ===== START MODE =====
  startMode(){
    const mode=this.state.modeId;
    if(mode==='nhanh')this.startQuick();
    else if(mode==='league')this.startLeague();
    else if(mode==='cup')this.startCup();
  }

  startQuick(){
    this.state.aiCountry=this.randomCountry(this.state.playerCountry.code);
    this.showMatch(this.state.aiCountry,`🏟️ Giao hữu`, {type:'quick'});
    this.state._mode='nhanh';
  }

  // ===== LEAGUE =====
  // Vòng đấu (round) chứa nhiều cặp cùng lúc. Đội mình đá cặp nào trong vòng thì
  // các cặp còn lại của CÙNG vòng đó tự động resolve (AI vs AI) ngay khi mình đá xong.
  startLeague(){
    const config=this.state.league||LEAGUE_LIST[0];
    const pool=config.clubs?config.clubs.map(code=>CLUB_MAP[code]).filter(Boolean):(config.region?getRegionCountries(config.region):getAllCountries());
    // Đội không thuộc giải (vd vừa chọn PSG ở Cúp C1 rồi sang Premier) → tự đổi
    // sang đội hợp lệ trong giải, tránh "sai đội ở các giải đấu".
    if(!pool.find(c=>c.code===this.state.playerCountry.code)){
      this.state.playerCountry=pool.find(c=>c.code==='vn')||pool[0]||getAllCountries()[0];
      this._updateCountryPicker();
      window.showToast?.(`⚠️ Đội không tham gia ${config.name} — đã chọn ${this.state.playerCountry.name}`,'warn');
    }
    const n=config.teamCount||8;
    const top=getTopCountries(pool, n-1, this.state.playerCountry.code);
    const teams=[this.state.playerCountry,...shuffle(top)];
    this.state.leagueTeams=teams;

    this.state.leagueRounds=buildRoundRobin(teams.length);
    this.state.leagueRoundIdx=0;

    this.state.leagueTable={};
    teams.forEach((t,i)=>{this.state.leagueTable[i]={name:t.name,flag:t.flag,code:t.code,p:0,w:0,d:0,l:0,gf:0,ga:0,gd:0,pts:0}});

    this.state._mode='league';
    this.renderLeagueView();
  }

  renderLeagueView(){
    const config=this.state.league||LEAGUE_LIST[0];
    const table=this.state.leagueTable;
    const teams=this.state.leagueTeams;
    const rounds=this.state.leagueRounds;
    const totalMatches=rounds.reduce((s,r)=>s+r.length,0);
    const played=rounds.reduce((s,r)=>s+r.filter(f=>f.result!==null).length,0);
    const roundIdx=this.state.leagueRoundIdx;

    document.getElementById('pt-overview-header').innerHTML=`
      <span class="pt-ov-icon">${config.icon}</span>
      <span class="pt-ov-title">${config.name} · ${teams.length} đội</span>
      <span class="pt-ov-sub">Vòng ${Math.min(roundIdx+1,rounds.length)}/${rounds.length} · Trận ${played}/${totalMatches}</span>
    `;

    const entries=Object.entries(table).sort((a,b)=>b[1].pts-a[1].pts||(b[1].gd-a[1].gd));
    let html=`<table class="pt-lt"><thead><tr><th>#</th><th>Đội</th><th>TR</th><th>THB</th><th>BT</th><th>HS</th><th>Đ</th></tr></thead><tbody>`;
    entries.forEach(([idx,row],i)=>{
      const t=teams[parseInt(idx)];
      const isPlayer=parseInt(idx)===0;
      html+=`<tr class="${isPlayer?'pt-lt-player':''}">
        <td>${i+1}</td><td class="pt-lt-name">${flagImg(t.code, t.name)} ${row.name}</td>
        <td>${row.p}</td>
        <td class="pt-lt-thb"><span class="pt-thb-w">${row.w}</span><span class="pt-thb-d">${row.d}</span><span class="pt-thb-l">${row.l}</span></td>
        <td class="pt-lt-gold">${row.gf}</td><td class="pt-lt-gold">${row.gd}</td><td class="pt-lt-pts pt-lt-gold">${row.pts}</td>
      </tr>`;
    });
    html+=`</tbody></table>`;
    document.getElementById('pt-league-table').innerHTML=html;

    const allDone=roundIdx>=rounds.length;
    document.getElementById('pt-league-next').style.display=allDone?'none':'';
    if(allDone){this.endLeague();}else{this.saveProgress();}

    this.showScreen('pt-league-view');
  }

  playLeagueMatch(){
    const rounds=this.state.leagueRounds;
    let rIdx=this.state.leagueRoundIdx;
    if(rIdx>=rounds.length){this.renderLeagueView();return}
    const round=rounds[rIdx];
    const pMatchIdx=round.findIndex(f=>f.result===null&&(f.home===0||f.away===0));

    if(pMatchIdx===-1){
      // Vòng này mình được nghỉ (bye) hoặc đã đá xong → tự resolve nốt rồi sang vòng sau
      this._resolveRoundRest(rIdx,-1);
      this.state.leagueRoundIdx=rIdx+1;
      this.renderLeagueView();
      return;
    }

    const f=round[pMatchIdx];
    const home=this.state.leagueTeams[f.home],away=this.state.leagueTeams[f.away];
    const opp=f.home===0?away:home;
    const label=`${this.state.league.icon} ${this.state.league.name} · Vòng ${rIdx+1}`;
    this.showMatch(opp,label, {type:'league', roundIdx:rIdx, matchIdx:pMatchIdx});
  }

  // Tự động resolve các cặp còn lại trong vòng rIdx (trừ cặp excludeIdx, đã/đang được người chơi đá)
  _resolveRoundRest(rIdx,excludeIdx){
    const round=this.state.leagueRounds[rIdx];
    if(!round)return;
    round.forEach((f,i)=>{
      if(i===excludeIdx||f.result!==null)return;
      const [h,a]=simAIPenalty();
      f.result=[h,a];
      this.updateLeagueTable(f.home,h,a);
      this.updateLeagueTable(f.away,a,h);
      const home=this.state.leagueTeams[f.home],away=this.state.leagueTeams[f.away];
      //window.showToast(`⚡ ${flagImg(home.code, home.name)} ${home.name} ${h}-${a} ${flagImg(away.code, away.name)} ${away.name}`,'info');
    });
  }

  updateLeagueTable(teamIdx,scored,conceded){
    const row=this.state.leagueTable[teamIdx];
    if(!row)return;
    row.p++;row.gf+=scored;row.ga+=conceded;row.gd=row.gf-row.ga;
    if(scored>conceded){row.w++;row.pts+=3}
    else if(scored===conceded){row.d++;row.pts+=1}
    else row.l++;
  }

  endLeague(){
    const config=this.state.league||LEAGUE_LIST[0];
    const entries=Object.entries(this.state.leagueTable).sort((a,b)=>b[1].pts-a[1].pts||(b[1].gd-a[1].gd));
    const winner=parseInt(entries[0][0]);
    const isWin=winner===0;
    const rank=entries.findIndex(e=>parseInt(e[0])===0)+1;
    const ov=document.getElementById('pt-overview-header');
    ov.innerHTML=`<span class="pt-ov-icon">🏆</span><span class="pt-ov-title">${config.name} · ${isWin?'Vô địch!':'Hạng '+rank}</span>`;
    document.getElementById('pt-league-next').style.display='none';

    const pts=isWin?(config.pointsWin||200):(config.pointsLose||50);
    addPoints('Penalty '+config.name,isWin?'Vô địch '+config.name:'Hết '+config.name,pts).catch(()=>{});
    if(window.VTQuests)window.VTQuests.trackEarn(pts);
    // Ghi lịch sử thành tích: vô địch / hạng
    this._recordHistory({
      ts: Date.now(),
      kind: 'tournament',
      mode: 'league',
      result: isWin ? 'champion' : 'rank',
      rank: rank,
      player: { code: this.state.playerCountry.code, name: this.state.playerCountry.name },
      label: config.name
    });
    this.clearProgress('league', config.id);
  }

  // ===================================================================
  //  CUP — VÒNG BẢNG + VÒNG LOẠI TRỰC TIẾP
  // ===================================================================

  startCup() {
    const config = this.state.tournament;
    const basePool = config.region ? getRegionCountries(config.region) : getAllCountries();
    const pool = shuffle(getTopCountries(basePool, config.teamCount - 1, this.state.playerCountry.code));

    const numGroups = config.groups;
    const totalTeams = config.teamCount;
    const teamsPerGroup = Math.ceil(totalTeams / numGroups);
    const teams = [this.state.playerCountry];
    for (let i = 0; i < totalTeams - 1; i++) {
      if (i < pool.length) teams.push(pool[i]);
      else {
        const fillerNames = ['Đội bóng tự do','FC All Stars','Đội Sao','United FC','Rising Stars','Phoenix FC','Spartak','Dynamo','Galácticos','Invincibles','Thunder FC','Eagles FC','Tigers FC','Lions FC','Warriors FC','Dragons FC'];
        teams.push({code: `gen_${i}`,name: fillerNames[i % fillerNames.length],flag: '🏳️'});
      }
    }

    this.state.cupConfig = config;
    this.state.cupTeams = teams;
    this.state._mode = 'cup';
    this.state.cupPhase = 'group';

    // Create groups with round-robin matches
    const groups = [];
    let teamIdx = 0;
    const groupNames = 'ABCDEFGH'.split('');
    for (let g = 0; g < numGroups; g++) {
      const groupTeams = [];
      for (let t = 0; t < teamsPerGroup && teamIdx < teams.length; t++) {
        groupTeams.push(teamIdx++);
      }

      // Build round-robin rounds using circle method (mỗi đội đá đúng 1 trận/vòng)
      const roundFixtures = this._generateRoundRobinRounds(groupTeams);
      const matches = [];
      const rounds = [];
      roundFixtures.forEach((round, rIdx) => {
        const roundIndices = [];
        round.forEach(fixture => {
          matches.push({ home: fixture.home, away: fixture.away, result: null });
          roundIndices.push(matches.length - 1);
        });
        rounds.push(roundIndices);
      });

      const table = {};
      groupTeams.forEach(ti => { table[ti] = {p:0,w:0,d:0,l:0,gf:0,ga:0,gd:0,pts:0}; });

      groups.push({ name: groupNames[g], teams: groupTeams, matches, rounds, table });
    }

    this.state.cupGroups = groups;

    // Build match queue (player group first)
    const allMatches = [];
    for (let g = 0; g < groups.length; g++) {
      for (let m = 0; m < groups[g].matches.length; m++) {
        allMatches.push({ groupIdx: g, matchIdx: m });
      }
    }
    const pg = groups.findIndex(g => g.teams.includes(0));
    const playerM = allMatches.filter(m => m.groupIdx === pg);
    const aiM = allMatches.filter(m => m.groupIdx !== pg);
    this.state.cupGroupMatchQueue = [...playerM, ...aiM];
    this.state.cupGroupMatchPtr = 0;
    this.state.cupQualifiers = [];
    this.state.cupKnockoutRounds = [];
    this.state.cupKnockoutMatchPtr = 0;

    this.renderGroupStage();
  }

  // ===== GROUP STAGE =====

  /**
   * Circle method: tạo lịch vòng tròn, mỗi đội đá đúng 1 trận/vòng.
   * @param {number[]} teamIds - Mảng các team index trong bảng
   * @returns {Array<{home:number, away:number}[]>} Mảng các vòng, mỗi vòng là mảng các cặp đấu
   */
  _generateRoundRobinRounds(teamIds) {
    const n = teamIds.length;
    const isOdd = n % 2 !== 0;
    const allTeams = [...teamIds];
    if (isOdd) allTeams.push(-1); // dummy (bye)

    const numTeams = allTeams.length;
    const numRounds = numTeams - 1;
    const matchesPerRound = numTeams / 2;

    const rounds = [];
    for (let r = 0; r < numRounds; r++) {
      const roundMatches = [];
      for (let m = 0; m < matchesPerRound; m++) {
        const home = allTeams[m];
        const away = allTeams[numTeams - 1 - m];
        if (home !== -1 && away !== -1) {
          roundMatches.push({ home, away });
        }
        // Nếu 1 bên là -1 (bye), skip — đội đó nghỉ vòng này
      }
      if (roundMatches.length > 0) rounds.push(roundMatches);

      // Xoay: giữ allTeams[0] cố định, xoay phần còn lại theo chiều kim đồng hồ
      const last = allTeams.pop();
      allTeams.splice(1, 0, last);
    }
    return rounds;
  }

  renderGroupStage() {
    const groups = this.state.cupGroups;
    const teams = this.state.cupTeams;
    const config = this.state.cupConfig;

    let html = `<div class="pt-overview-header">
      <span class="pt-ov-icon">${config.icon}</span>
      <span class="pt-ov-title">${config.name} · Vòng bảng</span>
      <span class="pt-ov-sub">${groups.length} bảng</span>
    </div>`;

    let gridOpen = false;
    groups.forEach((group, gIdx) => {
      if (gIdx % 2 === 0) {
        html += '<div class="pt-groups-row">';
        gridOpen = true;
      }
      html += `<div class="pt-group-block ${group.teams.includes(0)?'pt-group-player':''}">
        <div class="pt-group-name">Bảng ${group.name}</div>
        ${this._buildGroupTableHtml(group)}`;

      // Match results for THIS group only, flat grid (no round headers), right under its table.
      // Every match — played or not — gets a slot, so all group cards end up the same height.
      let groupResultsHtml = '';
      group.matches.forEach(m => {
        if (m.result) {
          const h = teams[m.home];
          const a = teams[m.away];
          groupResultsHtml += `<div class="pt-gm-item ${m.home===0||m.away===0?'pt-gm-player':''}">
            ${flagImg(h.code, h.name, 14)} ${m.result[0]}-${m.result[1]} ${flagImg(a.code, a.name, 14)}
          </div>`;
        } else {
          groupResultsHtml += `<div class="pt-gm-item pt-gm-pending">—</div>`;
        }
      });
      html += `<div class="pt-group-results">${groupResultsHtml}</div>`;

      html += `</div>`;
      if (gIdx % 2 === 1 || gIdx === groups.length - 1) {
        html += '</div>';
        gridOpen = false;
      }
    });
    if (gridOpen) html += '</div>';

    document.getElementById('pt-group-view-content').innerHTML = html;

    // Check if group stage is done
    const allDone = groups.every(g => g.matches.every(m => m.result !== null));
    if (allDone) {
      this.state.cupPhase = 'transition';
      this._getQualifiers();
      this.renderTransition();
    } else {
      this.state.cupPhase = 'group';
      this.showScreen('pt-cup-group-view');
      document.getElementById('pt-group-next').style.display = '';
      this.saveProgress();
    }
  }

  // Builds a group's standings table. Qualifying teams (pt-gt-qual) are highlighted,
  // teams currently out of qualification (pt-gt-eliminated) are dimmed.
  _buildGroupTableHtml(group) {
    const teams = this.state.cupTeams;
    const config = this.state.cupConfig;
    const sorted = this._sortGroupTable(group);
    const groupComplete = group.matches.every(m => m.result !== null);

    let html = `<table class="pt-gt">
      <thead><tr><th>#</th><th>Đội</th><th>TR</th><th>THB</th><th>BT</th><th>HS</th><th>Đ</th></tr></thead><tbody>`;

    sorted.forEach((row, i) => {
      const ti = row.teamIdx;
      const t = teams[ti];
      const isPlayer = ti === 0;
      const qualZone = i < config.advancePerGroup;
      const maybeQual = config.extraQualifiers && i < config.advancePerGroup + config.extraQualifiers;
      const showQual = qualZone || (maybeQual && this._isWithinQualRange(i, group, sorted));
      const eliminatedClass = !showQual && groupComplete ? 'pt-gt-eliminated' : '';

      html += `<tr class="${isPlayer?'pt-gt-player':''} ${showQual?'pt-gt-qual':eliminatedClass}">
        <td>${i+1}</td>
        <td class="pt-gt-name">${flagImg(t.code, t.name)} ${t.name}</td>
        <td>${row.p}</td>
        <td class="pt-gt-thb"><span class="pt-thb-w">${row.w}</span><span class="pt-thb-d">${row.d}</span><span class="pt-thb-l">${row.l}</span></td>
        <td class="pt-gt-gold">${row.gf}</td><td class="pt-gt-gold">${row.gd}</td>
        <td class="pt-gt-pts pt-gt-gold">${row.pts}</td>
      </tr>`;
    });

    html += `</tbody></table>`;
    return html;
  }

  _sortGroupTable(group) {
    const entries = Object.entries(group.table).map(([ti, row]) => ({ teamIdx: parseInt(ti), ...row }));
    return entries.sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf);
  }

  _isWithinQualRange(rank, group, sorted) {
    const config = this.state.cupConfig;
    const cutOff = config.advancePerGroup + (config.extraQualifiers || 0);
    if (rank >= cutOff) return false;
    // Check if extra qualifiers are still plausible
    const remain = group.matches.filter(m => m.result === null).length;
    if (remain === 0) return false;
    return true;
  }

  playGroupMatch() {
    const queue = this.state.cupGroupMatchQueue;
    let ptr = this.state.cupGroupMatchPtr;
    while (ptr < queue.length) {
      const item = queue[ptr];
      const group = this.state.cupGroups[item.groupIdx];
      const match = group.matches[item.matchIdx];
      if (match.result === null) break;
      ptr++;
    }
    if (ptr >= queue.length) { this.renderGroupStage(); return; }
    this.state.cupGroupMatchPtr = ptr;

    const item = queue[ptr];
    const group = this.state.cupGroups[item.groupIdx];
    const match = group.matches[item.matchIdx];
    const teams = this.state.cupTeams;
    const config = this.state.cupConfig;

    if (match.home === 0 || match.away === 0) {
      const opp = match.home === 0 ? teams[match.away] : teams[match.home];
      const label = `${config.icon} ${config.name} · Bảng ${group.name}`;
      this.showMatch(opp, label, { type: 'cup-group', groupIdx: item.groupIdx, matchIdx: item.matchIdx });
    } else {
      const [hGoal, aGoal] = simAIPenalty();
      match.result = [hGoal, aGoal];
      this._updateCupGroupTable(item.groupIdx, match.home, hGoal, aGoal);
      this._updateCupGroupTable(item.groupIdx, match.away, aGoal, hGoal);
      this.state.cupGroupMatchPtr = ptr + 1;
      //window.showToast(`⚽ Bảng ${group.name}: ${flagImg(teams[match.home].code, teams[match.home].name)} ${teams[match.home].name} ${hGoal}-${aGoal} ${flagImg(teams[match.away].code, teams[match.away].name)} ${teams[match.away].name}`, 'info');
      this.renderGroupStage();
    }
  }

  _updateCupGroupTable(groupIdx, teamIdx, scored, conceded) {
    const row = this.state.cupGroups[groupIdx].table[teamIdx];
    if (!row) return;
    row.p++; row.gf += scored; row.ga += conceded; row.gd = row.gf - row.ga;
    if (scored > conceded) { row.w++; row.pts += 3; }
    else if (scored === conceded) { row.d++; row.pts += 1; }
    else row.l++;
  }

  _simulateGroupRound(roundIdx) {
    const groups = this.state.cupGroups;
    let simmed = 0;
    for (let g = 0; g < groups.length; g++) {
      const round = groups[g].rounds[roundIdx];
      if (!round) continue;
      round.forEach(mi => {
        const m = groups[g].matches[mi];
        if (m.result !== null) return;
        // Auto-simulate ALL unplayed matches in this round (kể cả trận có player)
        const [hGoal, aGoal] = simAIPenalty();
        m.result = [hGoal, aGoal];
        this._updateCupGroupTable(g, m.home, hGoal, aGoal);
        this._updateCupGroupTable(g, m.away, aGoal, hGoal);
        simmed++;
      });
    }
    return simmed;
  }

  _getQualifiers() {
    const groups = this.state.cupGroups;
    const config = this.state.cupConfig;
    const qualifiers = [];
    const thirds = [];
    groups.forEach(group => {
      const sorted = this._sortGroupTable(group);
      for (let i = 0; i < config.advancePerGroup; i++) {
        if (sorted[i]) qualifiers.push({ teamIdx: sorted[i].teamIdx, groupName: group.name, groupPos: i });
      }
      // Collect 3rd-placed for extra qualifiers
      if (config.extraQualifiers && sorted[config.advancePerGroup]) {
        thirds.push({
          teamIdx: sorted[config.advancePerGroup].teamIdx,
          groupName: group.name,
          groupPos: config.advancePerGroup,
          pts: sorted[config.advancePerGroup].pts,
          gd: sorted[config.advancePerGroup].gd,
        });
      }
    });
    // Take best extra qualifiers across all groups
    if (config.extraQualifiers && thirds.length > 0) {
      thirds.sort((a, b) => b.pts - a.pts || b.gd - a.gd);
      thirds.slice(0, config.extraQualifiers).forEach(t => qualifiers.push(t));
    }
    this.state.cupQualifiers = qualifiers;
    return qualifiers;
  }

  renderTransition() {
    const groups = this.state.cupGroups;
    const config = this.state.cupConfig;

    let html = `<div class="pt-overview-header">
      <span class="pt-ov-icon">⚡</span>
      <span class="pt-ov-title">${config.name} · Kết thúc vòng bảng</span>
      <span class="pt-ov-sub">${this.state.cupQualifiers.length} đội đi tiếp</span>
    </div>`;

    let gridOpen = false;
    groups.forEach((group, gIdx) => {
      if (gIdx % 2 === 0) {
        html += '<div class="pt-groups-row">';
        gridOpen = true;
      }
      html += `<div class="pt-group-block ${group.teams.includes(0)?'pt-group-player':''}">
        <div class="pt-group-name">Bảng ${group.name}</div>
        ${this._buildGroupTableHtml(group)}
      </div>`;
      if (gIdx % 2 === 1 || gIdx === groups.length - 1) {
        html += '</div>';
        gridOpen = false;
      }
    });
    if (gridOpen) html += '</div>';

    document.getElementById('pt-transition-content').innerHTML = html;
    this.showScreen('pt-cup-transition');
    this.saveProgress();
  }

  // ---- Build Knockout Bracket from qualifiers ----
  advanceToKnockout() {
    const config = this.state.cupConfig;
    const teams = this.state.cupTeams;
    const qualifiers = this.state.cupQualifiers;
    const roundNames = config.knockoutRoundNames;

    // Build first round: group winners vs runners-up from other groups
    const groupNames = this.state.cupGroups.map(g => g.name);
    const firstRoundMatches = [];

    if (config.id === 'worldcup' && qualifiers.length === 16) {
      // World Cup R16: A1-B2, C1-D2, E1-F2, G1-H2, B1-A2, D1-C2, F1-E2, H1-G2
      for (let i = 0; i < 8; i++) {
        const w = qualifiers.find(q => q.groupName === groupNames[i] && q.groupPos === 0);
        const ru = qualifiers.find(q => q.groupName === groupNames[i % 2 === 0 ? i + 1 : i - 1] && q.groupPos === 1);
        if (w && ru) firstRoundMatches.push({ home: w.teamIdx, away: ru.teamIdx });
      }
    } else if (qualifiers.length === 8 && groupNames.length >= 4) {
      // Standard 4 groups → QF: A1-B2, C1-D2, B1-A2, D1-C2
      const pairs = [[0,1], [2,3], [1,0], [3,2]];
      pairs.forEach(([wi, rui]) => {
        const w = qualifiers.find(q => q.groupName === groupNames[wi] && q.groupPos === 0);
        const ru = qualifiers.find(q => q.groupName === groupNames[rui] && q.groupPos === 1);
        if (w && ru) firstRoundMatches.push({ home: w.teamIdx, away: ru.teamIdx });
      });
    } else {
      // Fallback: pair sequentially (works for any format including 3 groups → 8 qualifiers)
      // Fallback: pair sequentially
      for (let i = 0; i < qualifiers.length; i += 2) {
        if (i + 1 < qualifiers.length) {
          firstRoundMatches.push({ home: qualifiers[i].teamIdx, away: qualifiers[i+1].teamIdx });
        }
      }
    }

    // Create round objects
    const knockoutRounds = [];
    let currentMatches = firstRoundMatches.map(m => ({ home: m.home, away: m.away, result: null }));

    for (let r = 0; r < roundNames.length; r++) {
      knockoutRounds.push({ name: roundNames[r], matches: currentMatches });
      if (r < roundNames.length - 1) {
        const nextMatches = [];
        for (let i = 0; i < currentMatches.length; i += 2) {
          if (i + 1 < currentMatches.length) {
            nextMatches.push({ home: null, away: null, from: [r, i, r, i + 1], result: null });
          } else {
            nextMatches.push({ home: null, away: null, from: [r, i], result: null });
          }
        }
        currentMatches = nextMatches;
      }
    }

    this.state.cupKnockoutRounds = knockoutRounds;
    this.state.cupKnockoutMatchPtr = 0;
    this.state.cupKnockoutDisplayRoundIdx = 0;
    this.state.cupPhase = 'knockout';
    this.renderKnockoutStage();
  }

  // ---- Resolve bracket ----
  _resolveMatch(roundIdx, matchIdx) {
    const round = this.state.cupKnockoutRounds[roundIdx];
    if (!round || !round.matches[matchIdx]) return null;
    const m = round.matches[matchIdx];
    if (m.home !== null && m.away !== null) return m;

    // Resolve from previous round
    if (m.from) {
      const prevMatch1 = this.state.cupKnockoutRounds[m.from[0]].matches[m.from[1]];
      if (prevMatch1 && prevMatch1.result) {
        const w1 = prevMatch1.result[0] > prevMatch1.result[1] ? prevMatch1.home : prevMatch1.away;
        m.home = w1;
      }
      if (m.from.length >= 4) {
        const prevMatch2 = this.state.cupKnockoutRounds[m.from[2]].matches[m.from[3]];
        if (prevMatch2 && prevMatch2.result) {
          const w2 = prevMatch2.result[0] > prevMatch2.result[1] ? prevMatch2.home : prevMatch2.away;
          m.away = w2;
        }
      }
    }
    return m;
  }

  // ---- Render Knockout ----
  renderKnockoutStage() {
    const config = this.state.cupConfig;
    const rounds = this.state.cupKnockoutRounds;
    const teams = this.state.cupTeams;

    const totalMatches = rounds.reduce((s, r) => s + r.matches.length, 0);
    const playedMatches = rounds.reduce((s, r) => s + r.matches.filter(m => m.result !== null).length, 0);

    const header = document.getElementById('pt-knockout-header');
    header.innerHTML = `
      <span class="pt-ov-icon">${config.icon}</span>
      <span class="pt-ov-title">${config.name} · Vòng loại trực tiếp</span>
      <span class="pt-ov-sub">${playedMatches}/${totalMatches} trận</span>
    `;

    // Build visual bracket — only show the round currently being played.
    // The final two rounds (semifinal + final, and 3rd-place playoff if present) show together.
    // Stays on the round the user just played (even once fully done) until they click "Đá trận tiếp".
    const displayIdx = Math.min(this.state.cupKnockoutDisplayRoundIdx || 0, rounds.length - 1);
    let displayStart, displayEnd;
    if (displayIdx >= rounds.length - 2) {
      displayStart = Math.max(0, rounds.length - 2);
      displayEnd = rounds.length;
    } else {
      displayStart = displayIdx;
      displayEnd = displayIdx + 1;
    }

    let html = '<div class="pt-knockout-bracket">';

    rounds.slice(displayStart, displayEnd).forEach((round, offset) => {
      const rIdx = displayStart + offset;
      html += `<div class="pt-kr-round">
        <div class="pt-kr-round-name">${round.name}</div>
        <div class="pt-kr-matches">`;

      round.matches.forEach((m, mIdx) => {
        this._resolveMatch(rIdx, mIdx);
        const isDone = m.result !== null;
        const hTeam = m.home !== null && m.home !== undefined ? teams[m.home] : null;
        const aTeam = m.away !== null && m.away !== undefined ? teams[m.away] : null;
        const hasPlayer = m.home === 0 || m.away === 0;
        let resStr = isDone ? `${m.result[0]}-${m.result[1]}` : 'vs';

        html += `<div class="pt-kr-match ${isDone ? 'done' : ''} ${hasPlayer ? 'pt-kr-player' : ''}">
          <div class="pt-kr-teams">
            <span class="pt-kr-team ${m.home === 0 ? 'pt-highlight' : ''} ${isDone && m.result[0] > m.result[1] ? 'pt-kr-winner' : ''}">
              ${hTeam ? flagImg(hTeam.code, hTeam.name) + ' ' + abbr3(hTeam) : '⚪ TBD'}
            </span>
            <span class="pt-kr-vs">${resStr}</span>
            <span class="pt-kr-team pt-kr-team-away ${m.away === 0 ? 'pt-highlight' : ''} ${isDone && m.result[1] > m.result[0] ? 'pt-kr-winner' : ''}">
              ${aTeam ? abbr3(aTeam) + ' ' + flagImg(aTeam.code, aTeam.name) : 'TBD ⚪'}
            </span>
          </div>
        </div>`;
      });

      html += `</div></div>`;
    });

    html += '</div>';
    document.getElementById('pt-knockout-bracket').innerHTML = html;

    const allDone = rounds.every(r => r.matches.every(m => m.result !== null));
    if (allDone) {
      document.getElementById('pt-knockout-next').style.display = 'none';
      this.endCup();
    } else {
      document.getElementById('pt-knockout-next').style.display = '';
      document.getElementById('pt-knockout-next').textContent = '⚽ Đá trận tiếp';
      this.saveProgress();
    }

    this.showScreen('pt-cup-knockout-view');
  }

  // ---- Auto-simulate remaining AI-vs-AI matches in a specific round ----
  _simulateKnockoutRound(roundIdx) {
    const round = this.state.cupKnockoutRounds[roundIdx];
    if (!round) return 0;
    let simulated = 0;
    for (let m = 0; m < round.matches.length; m++) {
      const match = round.matches[m];
      if (match.result !== null) continue;
      this._resolveMatch(roundIdx, m);
      if (match.home === null || match.home === undefined || match.away === null || match.away === undefined) continue;
      if (match.home === 0 || match.away === 0) continue; // Skip player matches
      // AI auto-simulate
      const [hGoal, aGoal] = simAIPenalty();
      match.result = [hGoal, aGoal];
      simulated++;
    }
    return simulated;
  }

  // ---- Play Knockout Match ----
  playKnockoutMatch() {
    const rounds = this.state.cupKnockoutRounds;
    const teams = this.state.cupTeams;
    const config = this.state.cupConfig;

    // Find the next unplayed match
    for (let r = 0; r < rounds.length; r++) {
      for (let m = 0; m < rounds[r].matches.length; m++) {
        const match = rounds[r].matches[m];
        if (match.result !== null) continue;

        // Resolve teams from previous rounds
        this._resolveMatch(r, m);
        if (match.home === null || match.home === undefined || match.away === null || match.away === undefined) continue;

        this.state.cupKnockoutDisplayRoundIdx = r;
        const home = teams[match.home];
        const away = teams[match.away];

        if (match.home === 0 || match.away === 0) {
          // Player match
          const opp = match.home === 0 ? away : home;
          const label = `${config.icon} ${config.name} · ${rounds[r].name}`;
          this.showMatch(opp, label, {
            type: 'cup-knockout',
            roundIdx: r,
            matchIdx: m,
          });
          return;
        } else {
          // AI auto-simulate
          const [hGoal, aGoal] = simAIPenalty();
          match.result = [hGoal, aGoal];
          //window.showToast(`🏟️ ${rounds[r].name}: ${flagImg(home.code, home.name)} ${home.name} ${hGoal}-${aGoal} ${flagImg(away.code, away.name)} ${away.name}`, 'info');
          this.renderKnockoutStage();
          return;
        }
      }
    }

    // All done
    this.renderKnockoutStage();
  }

  endCup() {
    const rounds = this.state.cupKnockoutRounds;
    const lastRound = rounds[rounds.length - 1];
    const finalMatch = lastRound ? lastRound.matches[0] : null;
    const teams = this.state.cupTeams;
    const config = this.state.cupConfig;

    let winner = null;
    let isWin = false;
    if (finalMatch && finalMatch.result) {
      winner = finalMatch.result[0] > finalMatch.result[1] ? finalMatch.home : finalMatch.away;
      isWin = winner === 0;
    }

    const pts = isWin ? config.pointsWin : config.pointsLose;
    addPoints('Penalty ' + config.name, isWin ? 'Vô địch ' + config.name : 'Kết thúc ' + config.name, pts).catch(() => {});
    if (window.VTQuests) window.VTQuests.trackEarn(pts);

    const header = document.getElementById('pt-knockout-header');
    header.innerHTML = `
      <span class="pt-ov-icon">🏆</span>
      <span class="pt-ov-title">${isWin ? '🥇 Vô địch ' + config.name + '!' : 'Kết thúc ' + config.name}</span>
      <span class="pt-ov-sub">${isWin ? '+'+pts+'đ' : '+'+pts+'đ'}</span>
    `;

    // Show final result as overlay
    if (isWin) {
      //window.showToast(`🏆 Chức vô địch ${config.name} thuộc về ${flagImg(teams[0].code, teams[0].name)} ${teams[0].name}!`, 'success');
    }
    // Ghi lịch sử thành tích: vô địch / á quân (hoặc hạng nếu không vào chung kết)
    this._recordHistory({
      ts: Date.now(),
      kind: 'tournament',
      mode: 'cup',
      result: isWin ? 'champion' : 'rank',
      rank: this._estimateCupRank(this.state.cupKnockoutRounds, isWin, finalMatch),
      player: { code: this.state.playerCountry.code, name: this.state.playerCountry.name },
      label: config.name
    });
    this.clearProgress('cup', config.id);
  }

  // ===================================================================
  //  MATCH PLAY — NEW: Player shoots + defends when AI shoots
  // ===================================================================

  startRound(){
    this.state.round++;
    this.state.currentShooter='player';
    this.state.phase='shooting';
    this.state.shotLocked=false;
    this.state._pendingAiZone=null;
    this.resetKeeperPos();
    this.resetShooterPos();
    this._resetBall();
    document.getElementById('pt-actions').style.display='none';
    document.getElementById('pt-match-done-btn').style.display='none';
    this.renderStatusBar();
  }

  playerShoot(zoneId){
    if(this.state.shotLocked)return;
    this.state.shotLocked=true;
    this._setRoleBlink(false); // tắt nhấp nháy khi bóng bay
    const aiZone=this.aiPickZone();
    const isGoal=zoneId!==aiZone;
    this.animateShot(zoneId,aiZone,isGoal);
    const result=isGoal?'goal':'saved';
    this.state.history.push({shooter:this.state.currentShooter,zone:zoneId,target:aiZone,result});

    // Bắt dính bóng (không vào) thì giữ nguyên hiện trường thêm 1.5s trước
    // khi reset lượt — để người chơi kịp nhận ra pha cản phá vừa xảy ra,
    // thủ môn chỉ nhảy về vị trí đứng đúng lúc lượt mới bắt đầu.
    const proceedAfterShot=()=>{
      if(!this.state.is2Player){
        // AI's turn — player gets to defend!
        this.state.currentShooter='ai';
        this.state._pendingAiZone=this.aiPickZone();  // AI secretly picks target
        this.state.phase='defending';
        this.state.shotLocked=false;
        this.resetKeeperPos();
        this.resetShooterPos('right');
        this._resetBall();
        this.renderStatusBar();
        // Zone click will call playerDefend()
      }else{
        this.resetKeeperPos();
        this.resetShooterPos();
        this.afterShotDone();
      }
    };
    setTimeout(()=>{
      if(!isGoal){ setTimeout(proceedAfterShot,1500); } else { proceedAfterShot(); }
    },1700);
  }

  // Player chooses where the keeper dives
  playerDefend(zoneId){
    if(this.state.shotLocked)return;
    this.state.shotLocked=true;
    this._setRoleBlink(false); // tắt nhấp nháy khi thủ môn bay cản phá
    const aiZone=this.state._pendingAiZone||this.aiPickZone();
    const playerDive=zoneId;
    const isGoal=playerDive!==aiZone;  // Player chose wrong zone → goal
    this.animateAIShot(aiZone,playerDive,isGoal);
    const result=isGoal?'goal':'saved';
    this.state.history.push({shooter:'ai',zone:aiZone,target:playerDive,result});
    setTimeout(()=>{
      if(!isGoal){ setTimeout(()=>this.afterShotDone(),1500); } else { this.afterShotDone(); }
    },1700);
  }

  afterShotDone(){
    this.state.shotLocked=false;
    const ps=this.state.history.filter(s=>s.shooter==='player'||s.shooter==='p2').length;
    const as=this.state.history.filter(s=>s.shooter==='ai').length;
    const ctx = this.state._matchContext;
    const isKnockout = ctx && ctx.type === 'cup-knockout';

    // Normal 5-round match complete
    if (ps >= 5 && as >= 5) {
      if (this.state.scores[0] !== this.state.scores[1]) {
        // Someone leads → match ends
        this.endMatch();
        return;
      }
      if (!isKnockout) {
        // Group/League/Quick: draw is allowed → match ends
        this.endMatch();
        return;
      }
      // Knockout, tied after 5 → sudden death — reset 5 nốt để hiển thị lượt luân lưu mới
      //window.showToast('⚽ Bước vào loạt luân lưu tử thần!','info');
      this.state._dotsBaseP = ps;
      this.state._dotsBaseA = as;
      this.state.round = Math.max(this.state.round, 1);
      this.startRound();
      return;
    }

    // Sudden death continuation (beyond 5 rounds, knockout only)
    if (ps > 5 && as > 5 && isKnockout) {
      if (this.state.scores[0] !== this.state.scores[1]) {
        this.endMatch();
        return;
      }
      // Still tied → continue
      this.state.round = Math.max(this.state.round, 1);
      this.startRound();
      return;
    }

    // Normal continuation (under 5 rounds, or waiting for both to shoot)
    this.state.currentShooter='player';
    this.state.phase='shooting';
    this.renderStatusBar();
    this.resetKeeperPos();
    this.resetShooterPos();
    this._resetBall();
    document.getElementById('pt-actions').style.display='none';
    document.getElementById('pt-match-done-btn').style.display='none';
  }

  endMatch(){
    this.state.phase='finished';
    this.state.shotLocked=true;
    // Admin force win/lose via __ADMIN_FORCED_RESULT
    if (window.__ADMIN_FORCED_RESULT === 'win') {
      this.state.scores = [5, 0];
      this.state.history = [];
      for (let i = 0; i < 5; i++) {
        this.state.history.push({ shooter: 'player', result: 'goal' });
        this.state.history.push({ shooter: 'ai', result: 'saved' });
      }
    } else if (window.__ADMIN_FORCED_RESULT === 'lose') {
      this.state.scores = [0, 5];
      this.state.history = [];
      for (let i = 0; i < 5; i++) {
        this.state.history.push({ shooter: 'player', result: 'saved' });
        this.state.history.push({ shooter: 'ai', result: 'goal' });
      }
    }
    const ps=this.state.scores[0],as=this.state.scores[1];
    const isWin=ps>as,isDraw=ps===as;

    this.state._lastMatchResult=isWin?'win':isDraw?'draw':'lose';
    this.state._lastMatchScore=[ps,as];

    this.renderStatusBar();
    this._displayResultOverlay();
    this.saveProgress();

    // Points for quick mode
    if(this.state._matchContext && this.state._matchContext.type==='quick'){
      const pts=isWin?150:isDraw?60:30;
      addPoints('Penalty',isWin?'Thắng penalty':isDraw?'Hòa penalty':'Thua penalty',pts).catch(()=>{});
      if(window.VTQuests)window.VTQuests.trackPlay('penalty');
    }
  }

  _displayResultOverlay(){
    document.getElementById('pt-result-overlay').style.display='';
    document.getElementById('pt-actions').style.display='none';
    document.getElementById('pt-match-done-btn').style.display='none';
    // Ẩn cầu thủ gameplay cũ, chỉ hiện 2 cầu thủ kết quả
    const mainShooter=document.getElementById('pt-shooter');
    if(mainShooter) mainShooter.style.display='none';
    const result=this.state._lastMatchResult;
    const isPlayerWin = result==='win';
    const isAiWin = result==='lose';
    // Player luôn bên trái, AI luôn bên phải
    // Pose dựa trên kết quả: thắng → celebrate, thua/thua → disappoint
    this._showResultShooter('pt-shooter-player', this.state.playerCountry, isPlayerWin ? 'celebrate' : 'disappoint');
    this._showResultShooter('pt-shooter-ai',     this.state.aiCountry,     isAiWin     ? 'celebrate' : 'disappoint');
    // Cờ đội thắng bay khắp sân
    const winnerTeam = isPlayerWin ? this.state.playerCountry : (isAiWin ? this.state.aiCountry : null);
    if(winnerTeam){
      this._spawnVictoryFlags(winnerTeam.code, winnerTeam.name);
      // Cờ đội thắng phủ đầy khung thành
      this._showGoalFlag(winnerTeam.code);
    }
  }

  // Cờ đội thắng phủ đầy khung thành (full khung thành)
  _showGoalFlag(code){
    const el=document.getElementById('pt-goal-flag');
    if(!el || !code) return;
    el.style.backgroundImage=`url(${teamFlagSrc(code)})`;
    el.style.display='';
  }

  // Render 1 cầu thủ ở màn kết quả: prefix = 'pt-shooter-winner'/'pt-shooter-loser'
  _showResultShooter(prefix, team, pose){
    const el=document.getElementById(prefix);
    if(!el)return;
    el.style.display='';
    el.className='pt-shooter '+prefix.replace('pt-shooter-','')+' '+pose;
    if(!team){
      renderShooterSprite(pose, null, prefix);
      return;
    }
    const nameEl=document.getElementById(prefix+'-name');
    const numEl=document.getElementById(prefix+'-number');
    const flagEl=document.getElementById(prefix+'-flag');
    if(nameEl) nameEl.textContent = team ? abbr3(team) : '';
    if(numEl) numEl.textContent = String(randomJerseyNumber());
    if(flagEl) flagEl.innerHTML = team ? flagImg(team.code, team.name, 13) : '';
    const kit = flagColorCache[team.code];
    const hairSeed = prefix==='pt-shooter-ai' ? 1 : 0;
    if(kit){
      renderShooterSprite(pose, {...kit, hair:this._pickShooterHair(hairSeed)}, prefix);
    }else{
      renderShooterSprite(pose, null, prefix);
      getFlagColors(team.code).then(kitRaw=>{
        renderShooterSprite(pose, {...kitRaw, hair:this._pickShooterHair(hairSeed)}, prefix);
      });
    }
  }

  // Rắc cờ liên tục theo đợt, đến khi người chơi thoát khỏi màn kết quả.
  // KHÔNG dùng flagImg() vì nó có loading="lazy" gây chậm tải ảnh trên cờ.
  _spawnVictoryFlags(code, name){
    const pitch=document.getElementById('pt-pitch');
    if(!pitch || !code || code.startsWith('gen_')) return;
    // Preload ảnh cờ
    const preload=new Image();
    preload.src=teamFlagSrc(code);
    // Hàm rắc 1 đợt (8-12 lá)
    const spawnWave=()=>{
      if(!document.getElementById('pt-pitch')) return; // sân đã biến mất
      const count=6+Math.floor(Math.random()*7); // 6-12 lá/đợt
      for(let i=0;i<count;i++){
        const pitchNow=document.getElementById('pt-pitch');
        if(!pitchNow) break;
        const el=document.createElement('div');
        el.className='pt-victory-flag';
        const size=24+Math.floor(Math.random()*30); // 24-54px
        const img=document.createElement('img');
        img.src=teamFlagSrc(code);
        img.alt=name||code;
        img.style.cssText=`width:${size}px;height:auto;display:block;`;
        el.appendChild(img);
        el.style.left=(Math.random()*88+6)+'%';
        const duration=(4.0+Math.random()*4.0); // 4-8s
        const delay=(Math.random()*1.5);
        const drift=Math.round(Math.random()*260-130);
        const rot=Math.round(Math.random()*540-270);
        el.style.animationDuration=duration.toFixed(2)+'s';
        el.style.animationDelay=delay.toFixed(2)+'s';
        el.style.setProperty('--vf-drift',drift+'px');
        el.style.setProperty('--vf-rot',rot+'deg');
        pitchNow.appendChild(el);
        setTimeout(()=>{if(el.parentNode) el.remove()},(duration+delay+0.5)*1000);
      }
    };
    // Rắc đợt đầu ngay lập tức
    spawnWave();
    // Rắc tiếp mỗi 1.6-2.4s
    this._victoryFlagsInterval = setInterval(spawnWave, 1600+Math.random()*800);
  }

  // Dừng cờ bay: clear interval + xoá các lá cờ còn sót trên sân
  _stopVictoryFlags(){
    if(this._victoryFlagsInterval){
      clearInterval(this._victoryFlagsInterval);
      this._victoryFlagsInterval = null;
    }
    // Xoá các lá cờ còn lại trong pitch
    const pitch=document.getElementById('pt-pitch');
    if(pitch){
      pitch.querySelectorAll('.pt-victory-flag').forEach(el => el.remove());
    }
  }

  onMatchDone(){
    document.getElementById('pt-result-overlay').style.display='none';
    const ctx = this.state._matchContext;
    const mode = this.state._mode;

    if (mode === 'nhanh') {
      this.showMenu();
    } else if (mode === 'league') {
      const rIdx = ctx ? ctx.roundIdx : this.state.leagueRoundIdx;
      const mIdx = ctx ? ctx.matchIdx : -1;
      const round = this.state.leagueRounds[rIdx];
      const f = round ? round[mIdx] : null;
      if (f) {
        const raw = this.state._lastMatchScore;
        const oriented = orientMatchScore(f, raw[0], raw[1]);
        f.result = oriented;
        this.updateLeagueTable(f.home, oriented[0], oriented[1]);
        this.updateLeagueTable(f.away, oriented[1], oriented[0]);
      }
      // Đá xong cặp của mình → các cặp còn lại trong vòng này tự resolve luôn
      this._resolveRoundRest(rIdx, mIdx);
      this.state.leagueRoundIdx = rIdx + 1;
      this.state.phase='idle'; this.state._matchContext=null;
      this.renderLeagueView();
    } else if (mode === 'cup') {
      if (ctx && ctx.type === 'cup-group') {
        const group = this.state.cupGroups[ctx.groupIdx];
        const match = group.matches[ctx.matchIdx];
        const raw = this.state._lastMatchScore;
        const oriented = orientMatchScore(match, raw[0], raw[1]);
        match.result = oriented;
        this._updateCupGroupTable(ctx.groupIdx, match.home, oriented[0], oriented[1]);
        this._updateCupGroupTable(ctx.groupIdx, match.away, oriented[1], oriented[0]);
        this.state.cupGroupMatchPtr++;
        // Auto-simulate AI matches in same round
        const playerGroup = this.state.cupGroups[ctx.groupIdx];
        let roundIdx = -1;
        if (playerGroup && playerGroup.rounds) {
          for (let r = 0; r < playerGroup.rounds.length; r++) {
            if (playerGroup.rounds[r].includes(ctx.matchIdx)) { roundIdx = r; break; }
          }
        }
        if (roundIdx >= 0) this._simulateGroupRound(roundIdx);
        this.state.phase='idle'; this.state._matchContext=null;
        this.renderGroupStage();
      } else if (ctx && ctx.type === 'cup-knockout') {
        const round = this.state.cupKnockoutRounds[ctx.roundIdx];
        const match = round.matches[ctx.matchIdx];
        const raw = this.state._lastMatchScore;
        match.result = orientMatchScore(match, raw[0], raw[1]);
        // Chỉ simulate các trận AI còn lại trong cùng vòng (ví dụ đá Tứ kết xong, hiện hết Tứ kết)
        this._simulateKnockoutRound(ctx.roundIdx);
        this.state.phase='idle'; this.state._matchContext=null;
        this.renderKnockoutStage();
      } else {
        this.showMenu();
      }
    }
  }

  // ===== AI =====
  aiPickZone(){
    if(Math.random()<AI_ACCURACY){
      const corners=['top-left','top-right','bot-left','bot-right'];
      const edges=['top-center','mid-left','mid-right','bot-center'];
      const r=Math.random();
      if(r<0.5)return corners[Math.floor(Math.random()*corners.length)];
      else if(r<0.75)return edges[Math.floor(Math.random()*edges.length)];
    }
    return ZONES[Math.floor(Math.random()*ZONES.length)];
  }

  playerDefendZone(){
    if(Math.random()<0.25)return this.aiPickZone();
    return ZONES[Math.floor(Math.random()*ZONES.length)];
  }

  // ===== ANIMATIONS =====
  // Banner kết quả: VÀO!!! / KHÔNG VÀO!!! — màu theo lợi/hại cho đội nhà
  // team='mine': đội nhà sút. team='theirs': đối thủ sút.
  // Đội nhà sút vào = tốt (xanh), bị bắt = xấu (đỏ).
  // Đối thủ sút vào = xấu (đỏ), bị bắt = tốt (xanh).
  showShotResultBanner(isGoal,team){
    const box=document.getElementById('pt-turn-box');
    if(!box)return;
    const goodForUs=team==='theirs' ? !isGoal : isGoal;
    box.innerHTML=isGoal?'VÀO!!!':'KHÔNG VÀO!!!';
    box.className='pt-turn-box '+(goodForUs?'result-good':'result-bad');
    box.style.display='';
  }

  async animateShot(zoneId,aiZone,isGoal,styleOverride){
    const zones=document.querySelectorAll('.pt-zone');
    zones.forEach(z=>z.classList.remove('zone-shot','zone-save','zone-goal','zone-keeper-save'));
    // Thủ môn (đội bạn) phản ứng trễ 1 nhịp sau khi bóng được sút
    const keeper=document.getElementById('pt-keeper');
    if(keeper){keeper.classList.remove('mine');keeper.classList.add('theirs');}
    // LowPerf: ép 'default' để keeper dive khớp thời gian bay của _animateBallToZone
    const _trailStyle=this._lowPerf?'default':(styleOverride||this._pickTrailStyle());
    // Đợi pre-warm sprite (dye mask pixel nặng) hoàn tất TRƯỚC khi bóng bay —
    // tránh lag cú sút đầu do _hairLayerCache miss màu tóc random.
    await this._waitShotPrewarm();
    setTimeout(()=>this._keeperDive(aiZone,isGoal&&zoneId!==aiZone?'diving':'save',FLIGHT_MS_BY_STYLE[_trailStyle]||900), KEEPER_REACT_DELAY_MS);
    this._shooterKick();
    this._animateBallToZone(zoneId,()=>{
      const el=document.querySelector(`[data-zone="${zoneId}"]`);
      if(el){el.classList.add(isGoal?'zone-goal':'zone-shot');if(!isGoal)setTimeout(()=>el.classList.add('zone-save'),300)}
      // Show 🧤 in save zone
      if(!isGoal){
        const saveEl=document.querySelector(`[data-zone="${aiZone}"]`);
        if(saveEl)setTimeout(()=>{saveEl.classList.remove('zone-shot','zone-save','zone-goal');saveEl.classList.add('zone-keeper-save')},400);
      }
      // Cập nhật tỉ số TRƯỚC — tránh renderStatusBar ghi đè banner
      if(isGoal){this.state.scores[0]++;this.renderStatusBar();this._bumpScoreEl('pt-sb-you');}
      else{this.renderStatusBar();}
      // Banner kết quả HIỆN SAU, không bị renderStatusBar xoá mất
      this.showShotResultBanner(isGoal,'mine');
      this._shooterResult(isGoal);
      // Lưới rung khi bóng vào lưới
      if(isGoal) this._rippleNet();
    },'mine',_trailStyle);
  }

  async animateAIShot(zoneId,saveZone,isGoal,styleOverride){
    const zones=document.querySelectorAll('.pt-zone');
    zones.forEach(z=>z.classList.remove('zone-shot','zone-save','zone-goal','zone-keeper-save'));
    // Thủ môn (đội mình) phản ứng trễ 1 nhịp sau khi bóng được sút
    const keeper=document.getElementById('pt-keeper');
    if(keeper){keeper.classList.remove('theirs');keeper.classList.add('mine');}
    // LowPerf: ép 'default' để keeper dive khớp thời gian bay của _animateBallToZone
    const _trailStyle=this._lowPerf?'default':(styleOverride||this._pickTrailStyle());
    // Đợi pre-warm sprite (dye mask pixel nặng) hoàn tất TRƯỚC khi bóng bay —
    // tránh lag cú sút đầu do _hairLayerCache miss màu tóc random.
    await this._waitShotPrewarm();
    setTimeout(()=>this._keeperDive(saveZone,isGoal?'diving':'save',FLIGHT_MS_BY_STYLE[_trailStyle]||900), KEEPER_REACT_DELAY_MS);
    this._shooterKick();
    this._animateBallToZone(zoneId,()=>{
      const el=document.querySelector(`[data-zone="${zoneId}"]`);
      if(el){el.classList.add(isGoal?'zone-goal':'zone-shot');if(!isGoal)setTimeout(()=>el.classList.add('zone-save'),300)}
      // Show 🧤 in save zone
      if(!isGoal){
        const saveEl=document.querySelector(`[data-zone="${saveZone}"]`);
        if(saveEl)setTimeout(()=>{saveEl.classList.remove('zone-shot','zone-save','zone-goal');saveEl.classList.add('zone-keeper-save')},400);
      }
      // Cập nhật tỉ số TRƯỚC — tránh renderStatusBar ghi đè banner
      if(isGoal){this.state.scores[1]++;this.renderStatusBar();this._bumpScoreEl('pt-sb-ai');}
      else{this.renderStatusBar();}
      // Banner kết quả HIỆN SAU, không bị renderStatusBar xoá mất
      this.showShotResultBanner(isGoal,'theirs');
      this._shooterResult(isGoal);
      // Lưới rung khi bóng vào lưới
      if(isGoal) this._rippleNet();
    },'theirs',_trailStyle);
  }

  // Lưới rung khi bóng vào lưới
  _rippleNet(){
    const net=document.getElementById('pt-goal-net');
    if(!net) return;
    net.classList.remove('ripple');
    void net.offsetWidth;
    net.classList.add('ripple');
  }

  // Vị trí Y của bóng — bám đúng vào chấm phạt đền (.pt-penalty-spot) trên sân,
  // không tính gián tiếp qua vị trí cầu thủ nữa (2 hệ tọa độ trước đây lệch nhau).
  _ballStartY(pitch,pRect){
    const spot=document.getElementById('pt-penalty-spot');
    if(spot){
      const spRect=spot.getBoundingClientRect();
      if(spRect.height>0) return (spRect.top-pRect.top)+spRect.height/2;
    }
    return pRect.height*0.78;
  }

  // Vị trí X của bóng — cũng bám theo chấm phạt đền (luôn ở giữa sân theo chiều ngang).
  _ballStartX(pitch,pRect){
    const spot=document.getElementById('pt-penalty-spot');
    if(spot){
      const spRect=spot.getBoundingClientRect();
      if(spRect.width>0) return (spRect.left-pRect.left)+spRect.width/2;
    }
    return pRect.width/2;
  }

  // Reset ball to penalty spot position
  _resetBall(){
    const ball=document.getElementById('pt-ball');
    if(!ball)return;
    const pitch=document.getElementById('pt-pitch');
    if(!pitch)return;
    const pRect=pitch.getBoundingClientRect();
    if(pRect.width===0)return;
    const x=this._ballStartX(pitch,pRect);
    const y=this._ballStartY(pitch,pRect);
    ball.style.transition='none';
    // Dùng transform (translate) thay vì left/top để trình duyệt chỉ cần
    // composite lại layer này (GPU), không phải tính lại layout mỗi frame
    // → hết giật/lag khi bóng di chuyển.
    ball.style.left='0';
    ball.style.top='0';
    ball.style.transform=`translate(calc(-50% + ${x}px), calc(-50% + ${y}px)) scale(1) rotate(0deg)`;
    ball.style.opacity='1';
    ball.style.display='';
    ball.classList.remove('ball-fx-wind-mine','ball-fx-wind-theirs','ball-fx-fire','ball-fx-ice','ball-fx-leaf','ball-fx-rainbow','ball-fx-dark','ball-fx-thunder','ball-fx-light','ball-fx-clone','ball-fx-butterfly','ball-fx-blackhole','ball-fx-dragon');
  }

  // Tạo vệt gió theo đường bay của bóng — 3 đường lệch tâm banh, 2 đường ngoài ngắn hơn
  _spawnWindStreak(pitch,x,y,angleDeg,team){
    const colorCls=team==='theirs'?'wind-theirs':'wind-mine';
    const rad=angleDeg*Math.PI/180;
    const nx=-Math.sin(rad), ny=Math.cos(rad); // hướng vuông góc với đường bay
    const lines=[
      {off:0,   len:1,   side:false}, // đường giữa, dài nhất
      {off:-5,  len:0.55,side:true},  // đường ngoài trái, ngắn hơn
      {off:5,   len:0.55,side:true}   // đường ngoài phải, ngắn hơn
    ];
    lines.forEach(ln=>{
      const s=document.createElement('div');
      s.className='pt-wind-streak '+colorCls+(ln.side?' side':'');
      // Lệch tâm banh một chút thay vì trùng tâm tuyệt đối
      const ox=x+nx*ln.off+3;
      const oy=y+ny*ln.off-2;
      s.style.left=ox+'px';
      s.style.top=oy+'px';
      s.style.setProperty('--wr',angleDeg+'deg');
      s.style.setProperty('--len',ln.len);
      pitch.appendChild(s);
      setTimeout(()=>s.remove(),450);
    });
    // ===== Hạt neon gió xoáy — xanh-trắng bay cuốn theo chiều gió (mới) =====
    const neonCount=4+Math.floor(Math.random()*3);
    for(let i=0;i<neonCount;i++){
      const n=document.createElement('div');
      n.className='pt-wind-neon';
      const spread=20+Math.random()*30;
      const aOff=(Math.random()-0.5)*60;
      const aDeg=angleDeg+aOff;
      const aRad=aDeg*Math.PI/180;
      n.style.left=(x+Math.cos(aRad)*spread)+'px';
      n.style.top=(y+Math.sin(aRad)*spread)+'px';
      n.style.setProperty('--wn-delay',String(Math.random()*0.15));
      n.style.setProperty('--wn-scale',String(0.4+Math.random()*1.2));
      // Drift theo hướng gió + xoáy nhẹ
      const drift=10+Math.random()*20;
      n.style.setProperty('--wn-dx',String(Math.cos(aRad+0.5)*drift));
      n.style.setProperty('--wn-dy',String(Math.sin(aRad+0.5)*drift));
      pitch.appendChild(n);
      setTimeout(()=>n.remove(),700);
    }
  }

  // Hạt lửa — cháy đỏ/cam/vàng, bay lên rồi tắt dần
  _spawnFireTrail(pitch,x,y){
    for(let i=0;i<2;i++){
      const p=document.createElement('div');
      p.className='pt-trail-fire';
      p.style.left=(x+(Math.random()-0.5)*8)+'px';
      p.style.top=(y+(Math.random()-0.5)*8)+'px';
      pitch.appendChild(p);
      setTimeout(()=>p.remove(),520);
    }
    // Tàn lửa neon đỏ-vàng-đen bay xung quanh (6-10 hạt)
    const emberCount=4+Math.floor(Math.random()*3);
    const emberColors=['#ef4444','#fb923c','#fde68a','#dc2626','#000000'];
    for(let i=0;i<emberCount;i++){
      const n=document.createElement('div');
      n.className='pt-fire-ember';
      const angle=Math.random()*360;
      const dist=6+Math.random()*24;
      n.style.left=(x+Math.cos(angle*Math.PI/180)*dist)+'px';
      n.style.top=(y+Math.sin(angle*Math.PI/180)*dist)+'px';
      n.style.setProperty('--ember-delay',String(Math.random()*0.15));
      n.style.setProperty('--ember-scale',String(0.4+Math.random()*1.2));
      n.style.setProperty('--ember-color',emberColors[Math.floor(Math.random()*emberColors.length)]);
      const driftX=(Math.random()-0.5)*40, driftY=-(Math.random()*30+10);
      n.style.setProperty('--ember-dx',driftX+'px');
      n.style.setProperty('--ember-dy',driftY+'px');
      pitch.appendChild(n);
      setTimeout(()=>n.remove(),700);
    }
  }

  // Mảnh băng — trắng/xanh cyan lấp lánh, xoay khi tan + hạt lấp lánh đi kèm
  _spawnIceTrail(pitch,x,y){
    // Mảnh băng chính — hình thoi (giữ nguyên)
    const p=document.createElement('div');
    p.className='pt-trail-ice';
    p.style.left=(x+(Math.random()-0.5)*10)+'px';
    p.style.top=(y+(Math.random()-0.5)*10)+'px';
    pitch.appendChild(p);
    setTimeout(()=>p.remove(),570);
    // Hạt lấp lánh (giữ nguyên)
    const sp=document.createElement('div');
    sp.className='pt-trail-ice-sparkle';
    sp.style.left=(x+(Math.random()-0.5)*16)+'px';
    sp.style.top=(y+(Math.random()-0.5)*16)+'px';
    pitch.appendChild(sp);
    setTimeout(()=>sp.remove(),500);
    // ===== Tinh thể băng neon — 8-12 hạt toả xung quanh (mới) =====
    const crystalCount=5+Math.floor(Math.random()*3);
    const crystalSizes=[4,5,7];
    for(let i=0;i<crystalCount;i++){
      const n=document.createElement('div');
      n.className='pt-ice-crystal';
      const angle=Math.random()*360;
      const dist=5+Math.random()*28;
      n.style.left=(x+Math.cos(angle*Math.PI/180)*dist)+'px';
      n.style.top=(y+Math.sin(angle*Math.PI/180)*dist)+'px';
      const size=crystalSizes[Math.floor(Math.random()*crystalSizes.length)];
      n.style.width=size+'px'; n.style.height=size+'px';
      n.style.setProperty('--cr-delay',String(Math.random()*0.2));
      n.style.setProperty('--cr-scale',String(0.4+Math.random()*1.2));
      n.style.setProperty('--cr-rot',String(Math.floor(Math.random()*360)));
      pitch.appendChild(n);
      setTimeout(()=>n.remove(),800);
    }
    // ===== Icon băng ❄️ bay xung quanh (giống lá 🍃) =====
    const iconCount=2+Math.floor(Math.random()*2);
    for(let i=0;i<iconCount;i++){
      const ic=document.createElement('div');
      ic.className='pt-ice-icon';
      ic.textContent='❄️';
      ic.style.left=(x+(Math.random()-0.5)*40)+'px';
      ic.style.top=(y+(Math.random()-0.5)*40)+'px';
      ic.style.setProperty('--ii-delay',String(Math.random()*0.15));
      ic.style.setProperty('--ii-x',String((Math.random()-0.5)*35));
      ic.style.setProperty('--ii-y',String((-12-Math.random()*24)));
      pitch.appendChild(ic);
      setTimeout(()=>ic.remove(),800);
    }
    // ===== Vệt đóng băng — mảnh băng loang (mới) =====
    for(let i=0;i<3;i++){
      const f=document.createElement('div');
      f.className='pt-ice-frost';
      const fa=Math.random()*360;
      const fd=4+Math.random()*20;
      f.style.left=(x+Math.cos(fa*Math.PI/180)*fd)+'px';
      f.style.top=(y+Math.sin(fa*Math.PI/180)*fd)+'px';
      const fs=6+Math.floor(Math.random()*15);
      f.style.width=fs+'px'; f.style.height=fs+'px';
      f.style.setProperty('--fr-rot',String(Math.floor(Math.random()*120)-60));
      f.style.setProperty('--fr-delay',String(Math.random()*0.15));
      pitch.appendChild(f);
      setTimeout(()=>f.remove(),650);
    }
  }

  // Lá cây bay theo sau bóng, xoay lật như bị gió cuốn — rắc 2 lá + quầng
  // gió xanh mờ mỗi lượt để trông như cả chùm lá bị cuốn theo bóng
  _spawnLeafTrail(pitch,x,y){
    const leaves=['🍃','🍂'];
    // Quầng lá xanh (giữ nguyên)
    const glow=document.createElement('div');
    glow.className='pt-trail-leaf-glow';
    glow.style.left=x+'px';
    glow.style.top=y+'px';
    pitch.appendChild(glow);
    setTimeout(()=>glow.remove(),550);
    // Lá cây — tăng từ 2 lên 3-5
    const leafCount=3+Math.floor(Math.random()*2);
    for(let i=0;i<leafCount;i++){
      const p=document.createElement('span');
      p.className='pt-trail-leaf';
      p.textContent=leaves[Math.floor(Math.random()*leaves.length)];
      p.style.left=(x+(Math.random()-0.5)*20)+'px';
      p.style.top=(y+(Math.random()-0.5)*20)+'px';
      p.style.fontSize=(16+Math.random()*12)+'px';
      const delay=Math.random()*0.15;
      p.style.animationDelay=delay+'s';
      pitch.appendChild(p);
      setTimeout(()=>p.remove(),800);
    }
    // ===== Hạt neon xanh-vàng — linh hồn lá bay xung quanh (mới) =====
    const spiritCount=4+Math.floor(Math.random()*3);
    for(let i=0;i<spiritCount;i++){
      const n=document.createElement('div');
      n.className='pt-leaf-spirit';
      const angle=Math.random()*360;
      const dist=4+Math.random()*26;
      n.style.left=(x+Math.cos(angle*Math.PI/180)*dist)+'px';
      n.style.top=(y+Math.sin(angle*Math.PI/180)*dist)+'px';
      n.style.setProperty('--sp-delay',String(Math.random()*0.18));
      n.style.setProperty('--sp-scale',String(0.4+Math.random()*1.3));
      const driftX=(Math.random()-0.5)*30, driftY=-(Math.random()*25+8);
      n.style.setProperty('--sp-dx',driftX+'px');
      n.style.setProperty('--sp-dy',driftY+'px');
      pitch.appendChild(n);
      setTimeout(()=>n.remove(),700);
    }
  }

  // Vệt cầu vồng — cùng hình dạng vệt gió nhưng màu tăng dần theo --hue mỗi
  // lần rắc hạt, tạo cảm giác 1 dải cầu vồng nối đuôi theo đường bay của bóng
  _spawnRainbowTrail(pitch,x,y,angleDeg){
    if(this._rainbowHue===undefined) this._rainbowHue=0;
    const hue=this._rainbowHue;
    this._rainbowHue=(this._rainbowHue+28)%360;
    const rad=angleDeg*Math.PI/180;
    const nx=-Math.sin(rad), ny=Math.cos(rad);
    const lines=[
      {off:0,   len:1,    side:false, rotOff:0},
      {off:-12, len:0.65, side:true,  rotOff:-6},
      {off:12,  len:0.65, side:true,  rotOff:6}
    ];
    lines.forEach(ln=>{
      const s=document.createElement('div');
      s.className='pt-trail-rainbow'+(ln.side?' side':'');
      const ox=x+nx*ln.off+3;
      const oy=y+ny*ln.off-2;
      s.style.left=ox+'px';
      s.style.top=oy+'px';
      s.style.setProperty('--wr',(angleDeg+(ln.rotOff||0))+'deg');
      s.style.setProperty('--len',ln.len);
      s.style.setProperty('--hue',hue);
      pitch.appendChild(s);
      setTimeout(()=>s.remove(),480);
    });
    // ===== Hạt neon cầu vồng đa sắc — bay xung quanh (mới) =====
    const neonCount=4+Math.floor(Math.random()*3);
    const rbHues=[0,30,55,130,210,280];
    for(let i=0;i<neonCount;i++){
      const n=document.createElement('div');
      n.className='pt-rainbow-neon';
      const spread=10+Math.random()*28;
      const aOff=(Math.random()-0.5)*50;
      const aDeg=angleDeg+aOff;
      const aRad=aDeg*Math.PI/180;
      n.style.left=(x+Math.cos(aRad)*spread)+'px';
      n.style.top=(y+Math.sin(aRad)*spread)+'px';
      n.style.setProperty('--rb-hue',String(rbHues[Math.floor(Math.random()*rbHues.length)]));
      n.style.setProperty('--rn-delay',String(Math.random()*0.15));
      n.style.setProperty('--rn-scale',String(0.4+Math.random()*1.2));
      const drift=8+Math.random()*18;
      n.style.setProperty('--rn-dx',String(Math.cos(aRad+0.8)*drift));
      n.style.setProperty('--rn-dy',String(Math.sin(aRad+0.8)*drift-6));
      pitch.appendChild(n);
      setTimeout(()=>n.remove(),700);
    }
  }

  // Khói bạc-đen cuộn theo sau bóng — dùng cho cú sút hắc ám
  _spawnSmokeTrail(pitch,x,y){
    // Bụi đen — 2 cụm lửa tối bùng lên (giống .pt-trail-fire)
    for(let i=0;i<2;i++){
      const p=document.createElement('div');
      p.className='pt-dark-flame';
      p.style.left=(x+(Math.random()-0.5)*12)+'px';
      p.style.top=(y+(Math.random()-0.5)*12)+'px';
      pitch.appendChild(p);
      setTimeout(()=>p.remove(),550);
    }
    // ===== Tàn hắc ám — đen-đỏ, lõi đen, giống .pt-fire-ember =====
    const emberColors=['#000000','#dc2626','#6b21a8','#000000'];
    const emberCount=4+Math.floor(Math.random()*3);
    for(let i=0;i<emberCount;i++){
      const n=document.createElement('div');
      n.className='pt-dark-ember';
      const angle=Math.random()*360;
      const dist=5+Math.random()*22;
      n.style.left=(x+Math.cos(angle*Math.PI/180)*dist)+'px';
      n.style.top=(y+Math.sin(angle*Math.PI/180)*dist)+'px';
      n.style.setProperty('--ember-color',emberColors[i%emberColors.length]);
      n.style.setProperty('--ember-delay',String(Math.random()*0.15));
      n.style.setProperty('--ember-scale',String(0.4+Math.random()*1.3));
      const driftX=(Math.random()-0.5)*40, driftY=-(Math.random()*28+10);
      n.style.setProperty('--ember-dx',driftX+'px');
      n.style.setProperty('--ember-dy',driftY+'px');
      pitch.appendChild(n);
      setTimeout(()=>n.remove(),700);
    }
  }

  // Tia sét — lóe sáng vàng-trắng dọc theo đường zíc-zắc
  _spawnThunderTrail(pitch,x,y){
    const p=document.createElement('span');
    p.className='pt-trail-thunder';
    p.textContent='⚡';
    p.style.left=(x+(Math.random()-0.5)*8)+'px';
    p.style.top=(y+(Math.random()-0.5)*8)+'px';
    pitch.appendChild(p);
    setTimeout(()=>p.remove(),380);
    // Neon đen-vàng — 5-7 hạt glow toả xung quanh tia sét
    const neonCount=4+Math.floor(Math.random()*2);
    for(let i=0;i<neonCount;i++){
      const n=document.createElement('div');
      n.className='pt-thunder-neon';
      const angle=Math.random()*360;
      const dist=10+Math.random()*22;
      n.style.left=(x+Math.cos(angle*Math.PI/180)*dist)+'px';
      n.style.top=(y+Math.sin(angle*Math.PI/180)*dist)+'px';
      n.style.setProperty('--neon-delay',String(Math.random()*0.2));
      n.style.setProperty('--neon-scale',String(0.5+Math.random()*1));
      pitch.appendChild(n);
      setTimeout(()=>n.remove(),600);
    }
  }

  // Tia sáng — 3 tia trắng-vàng neon toả từ bóng như bánh xe chia đều 3
  // phần: tia giữa theo đúng hướng bay mặc định (bay thẳng), 2 tia còn lại
  // hợp với tia giữa 1 góc 120° và -120°
  _spawnLightBurst(pitch,x,y,angleDeg){
    // 5 tia sáng — trung tâm + 4 tia phụ toả đều xung quanh
    const rays=[
      {rot:0,   side:false},
      {rot:80,  side:true},
      {rot:-80, side:true},
      {rot:150, side:true},
      {rot:-150,side:true}
    ];
    rays.forEach(r=>{
      const s=document.createElement('div');
      s.className='pt-light-ray'+(r.side?' side':'');
      s.style.left=x+'px';
      s.style.top=y+'px';
      s.style.setProperty('--wr',(angleDeg+r.rot)+'deg');
      pitch.appendChild(s);
      setTimeout(()=>s.remove(),430);
    });
    // ===== Lens flare — vòng hào quang đồng tâm xoay tròn (mới) =====
    const flare=document.createElement('div');
    flare.className='pt-light-lensflare';
    flare.style.left=x+'px';
    flare.style.top=y+'px';
    // 3 vòng tròn đồng tâm với kích thước khác nhau
    const ringSizes=[28,44,62];
    ringSizes.forEach(size=>{
      const ring=document.createElement('div');
      ring.className='pt-light-lensflare-ring';
      ring.style.width=size+'px';
      ring.style.height=size+'px';
      flare.appendChild(ring);
    });
    pitch.appendChild(flare);
    setTimeout(()=>flare.remove(),530);
    // ===== Hạt neon lấp lánh — trắng-vàng toả ra mọi hướng =====
    const sparkleCount=6+Math.floor(Math.random()*4);
    for(let i=0;i<sparkleCount;i++){
      const n=document.createElement('div');
      n.className='pt-light-neon';
      const angle=Math.random()*360;
      const dist=8+Math.random()*30;
      const aRad=angle*Math.PI/180;
      n.style.left=(x+Math.cos(aRad)*dist)+'px';
      n.style.top=(y+Math.sin(aRad)*dist)+'px';
      const delay=Math.random()*0.12;
      n.style.setProperty('--ln-delay',String(delay));
      n.style.setProperty('--ln-scale',String(0.5+Math.random()*1.5));
      // Drift nhẹ ra xa dần
      const drift=6+Math.random()*14;
      n.style.setProperty('--ln-dx',String(Math.cos(aRad+0.2)*drift));
      n.style.setProperty('--ln-dy',String(Math.sin(aRad+0.2)*drift));
      pitch.appendChild(n);
      setTimeout(()=>n.remove(),700);
    }
    // ===== Tàn dư va chạm — đỏ/cam/vàng/trắng bắn ra từ điểm giao tia =====
    const emberColors=['#ef4444','#fb923c','#facc15','#ffffff'];
    const emberCount=4+Math.floor(Math.random()*3);
    for(let i=0;i<emberCount;i++){
      const e=document.createElement('div');
      e.className='pt-light-ember';
      const angle=Math.random()*360;
      const aRad=angle*Math.PI/180;
      const dist=4+Math.random()*10;
      e.style.left=(x+Math.cos(aRad)*dist)+'px';
      e.style.top=(y+Math.sin(aRad)*dist)+'px';
      e.style.setProperty('--em-color',emberColors[i%emberColors.length]);
      e.style.setProperty('--em-delay',String(Math.random()*0.1));
      e.style.setProperty('--em-scale',String(0.6+Math.random()*1.2));
      const drift=10+Math.random()*20;
      e.style.setProperty('--em-dx',String(Math.cos(aRad+0.3)*drift));
      e.style.setProperty('--em-dy',String(Math.sin(aRad+0.3)*drift));
      pitch.appendChild(e);
      setTimeout(()=>e.remove(),700);
    }
    // ===== Icon sao ⭐ bay xung quanh =====
    const starCount=2+Math.floor(Math.random()*3);
    for(let i=0;i<starCount;i++){
      const ic=document.createElement('div');
      ic.className='pt-light-icon';
      ic.textContent='⭐';
      ic.style.left=(x+(Math.random()-0.5)*55)+'px';
      ic.style.top=(y+(Math.random()-0.5)*55)+'px';
      ic.style.setProperty('--li-delay',String(Math.random()*0.15));
      ic.style.setProperty('--li-x',String((Math.random()-0.5)*45));
      ic.style.setProperty('--li-y',String((-12-Math.random()*28)));
      pitch.appendChild(ic);
      setTimeout(()=>ic.remove(),800);
    }
  }

  // Bươm bướm — nhiều hạt màu hồng/tím/cam bay rập rờn
  _spawnButterflyTrail(pitch,x,y){
    const colors=['#ffffff','#fce7f3','#fbcfe8','#f9a8d4','#ec4899'];
    for(let i=0;i<4;i++){
      const p=document.createElement('div');
      p.className='pt-trail-butterfly';
      p.style.left=(x+(Math.random()-0.5)*18)+'px';
      p.style.top=(y+(Math.random()-0.5)*18)+'px';
      p.style.background=`radial-gradient(circle, ${colors[i%colors.length]} 30%, transparent 70%)`;
      p.style.setProperty('--bf-sx',((Math.random()-0.5)*30).toFixed(1));
      p.style.setProperty('--bf-sy',((-10-Math.random()*20)).toFixed(1));
      pitch.appendChild(p);
      setTimeout(()=>p.remove(),600);
    }
    // ===== Neon hồng-trắng — cánh sen lấp lánh (mới) =====
    const neonCount=4+Math.floor(Math.random()*3);
    for(let i=0;i<neonCount;i++){
      const n=document.createElement('div');
      n.className='pt-butterfly-neon';
      const angle=Math.random()*360;
      const dist=5+Math.random()*28;
      const aRad=angle*Math.PI/180;
      n.style.left=(x+Math.cos(aRad)*dist)+'px';
      n.style.top=(y+Math.sin(aRad)*dist)+'px';
      const isPink=Math.random()>0.5;
      n.style.setProperty('--bn-color',isPink?'#ec4899':'#ffffff');
      n.style.setProperty('--bn-delay',String(Math.random()*0.18));
      n.style.setProperty('--bn-scale',String(0.4+Math.random()*1.4));
      const drift=6+Math.random()*20;
      n.style.setProperty('--bn-dx',String(Math.cos(aRad+0.3)*drift));
      n.style.setProperty('--bn-dy',String(Math.sin(aRad+0.3)*drift));
      pitch.appendChild(n);
      setTimeout(()=>n.remove(),800);
    }
    // Thả thêm icon hoa sen bay xung quanh
    const iconCount=2+Math.floor(Math.random()*2);
    for(let j=0;j<iconCount;j++){
      const b=document.createElement('span');
      b.className='pt-trail-butterfly-icon';
      b.textContent=Math.random()>0.5?'🦋':'🪷';
      b.style.left=(x+(Math.random()-0.5)*40)+'px';
      b.style.top=(y+(Math.random()-0.5)*40)+'px';
      pitch.appendChild(b);
      setTimeout(()=>b.remove(),700);
    }
  }
  _spawnButterflyAntennae(pitch,x,y,angleDeg){
    [-18,18].forEach(offsetDeg=>{
      const s=document.createElement('div');
      s.className='pt-butterfly-antenna';
      s.style.left=x+'px';
      s.style.top=y+'px';
      s.style.setProperty('--ar',(angleDeg+offsetDeg)+'deg');
      pitch.appendChild(s);
      setTimeout(()=>s.remove(),420);
    });
  }

  // Hố đen — xoáy hạt tím/đen cuốn vào lỗ sâu
  _spawnBlackholeTrail(pitch,x,y){
    const colors=['#000000','#0c4a6e','#06b6d4','#a855f7','#d8b4fe','#ffffff'];
    for(let i=0;i<3;i++){
      const p=document.createElement('div');
      p.className='pt-trail-blackhole';
      p.style.left=(x+(Math.random()-0.5)*20)+'px';
      p.style.top=(y+(Math.random()-0.5)*20)+'px';
      p.style.background=`radial-gradient(circle, ${colors[i%colors.length]} 40%, transparent 80%)`;
      p.style.setProperty('--bh-sx',((Math.random()-0.5)*24).toFixed(1));
      p.style.setProperty('--bh-sy',((-6-Math.random()*12)).toFixed(1));
      pitch.appendChild(p);
      setTimeout(()=>p.remove(),500);
    }
  }

  // Rồng thiên — vảy vàng rơi + hạt lửa vàng/xanh ngọc + rồng con bay lượn
  _spawnDragonTrail(pitch,x,y){
    const colors=['#fbbf24','#f59e0b','#fde68a','#22d3ee','#a5f3fc','#ffffff'];
    for(let i=0;i<5;i++){
      const p=document.createElement('div');
      p.className='pt-trail-dragon';
      p.style.left=(x+(Math.random()-0.5)*20)+'px';
      p.style.top=(y+(Math.random()-0.5)*20)+'px';
      p.style.background=`radial-gradient(circle, ${colors[i%colors.length]} 40%, transparent 80%)`;
      p.style.setProperty('--dr-sx',((Math.random()-0.5)*30).toFixed(1));
      p.style.setProperty('--dr-sy',((-8-Math.random()*16)).toFixed(1));
      pitch.appendChild(p);
      setTimeout(()=>p.remove(),560);
    }
    // Hạt neon vàng-xanh toả xung quanh
    const neonCount=3+Math.floor(Math.random()*2);
    for(let i=0;i<neonCount;i++){
      const n=document.createElement('div');
      n.className='pt-dragon-neon';
      const angle=Math.random()*360;
      const dist=8+Math.random()*20;
      n.style.left=(x+Math.cos(angle*Math.PI/180)*dist)+'px';
      n.style.top=(y+Math.sin(angle*Math.PI/180)*dist)+'px';
      n.style.setProperty('--dn-color',Math.random()>0.5?'#fbbf24':'#22d3ee');
      n.style.setProperty('--dn-delay',String(Math.random()*0.15));
      n.style.setProperty('--dn-scale',String(0.5+Math.random()*1.1));
      pitch.appendChild(n);
      setTimeout(()=>n.remove(),450);
    }
    // Rồng con bay lượn theo bóng
    if(Math.random()<0.7){
      const d=document.createElement('span');
      d.className='pt-trail-dragon-icon';
      d.textContent='🐉';
      d.style.left=(x+(Math.random()-0.5)*10)+'px';
      d.style.top=(y+(Math.random()-0.5)*10)+'px';
      d.style.setProperty('--dr-rot',String(Math.random()*360)+'deg');
      pitch.appendChild(d);
      setTimeout(()=>d.remove(),620);
    }
  }

  // Hạt ma trơi tím — cho cú sút phân thân, bay lập loè rồi tắt
  _spawnCloneTrail(pitch,x,y){
    const p=document.createElement('div');
    p.className='pt-trail-clone';
    p.style.left=(x+(Math.random()-0.5)*12)+'px';
    p.style.top=(y+(Math.random()-0.5)*12)+'px';
    pitch.appendChild(p);
    setTimeout(()=>p.remove(),600);
  }

  // Bật/tắt chế độ hiệu suất thấp — lưu localStorage + cập nhật nút
  _toggleLowPerf(){
    this._lowPerf = !this._lowPerf;
    try{ localStorage.setItem('vt_penalty_lowperf', this._lowPerf ? '1' : '0'); }catch(e){}
    this._renderLowPerfToggle();
  }

  _renderLowPerfToggle(){
    const btn = document.getElementById('pt-lowperf-btn');
    if(btn) btn.classList.toggle('on', !!this._lowPerf);
  }

  // Chọn hiệu ứng cú sút — random từ danh sách đã chọn, fallback random toàn bộ
  _pickTrailStyle(){
    // Chế độ hiệu suất thấp: luôn dùng đường sút mặc định (thẳng, không hiệu ứng)
    if(this._lowPerf) return 'default';
    const selected = this.state._effectSelected || [];
    const owned = this.state._effectOwned || [];
    // Lọc chỉ lấy hiệu ứng hợp lệ
    const valid = selected.filter(id => PT_EFFECTS.find(e=>e.id===id));
    if(valid.length > 0){
      return valid[Math.floor(Math.random()*valid.length)];
    }
    // Không chọn gì → đường sút mặc định (trắng nhạt, thẳng, không hiệu ứng)
    return 'default';
  }

  // Màu tóc CỐ ĐỊNH theo đội — không random nữa: seed 0 = đội nhà (TRẮNG),
  // seed 1 = đối thủ (ĐEN). Chỉ 2 màu nên _hairLayerCache nhuộm đúng 1 lần
  // rồi cache vĩnh viễn → không còn miss màu tóc random lúc sút (hết lag đầu).
  // Lớp MP override nhưng cũng chỉ trả 1 trong 2 màu này → 2 client luôn khớp.
  _pickShooterHair(seed){
    return seed ? HAIR_AWAY_HEX : HAIR_HOME_HEX;
  }

  // Điều phối hiệu ứng bay theo đúng kiểu đã chọn cho cú sút hiện tại
  _spawnBallTrail(pitch,x,y,angleDeg,team,style){
    if(style==='default') return; // mặc định: không rắc hạt, chỉ đường trắng nhạt thẳng
    if(style==='fire')    return this._spawnFireTrail(pitch,x,y);
    if(style==='ice')     return this._spawnIceTrail(pitch,x,y);
    if(style==='leaf')    return this._spawnLeafTrail(pitch,x,y);
    if(style==='rainbow') return this._spawnRainbowTrail(pitch,x,y,angleDeg);
    if(style==='dark')    return this._spawnSmokeTrail(pitch,x,y);
    if(style==='thunder') return this._spawnThunderTrail(pitch,x,y);
    if(style==='light')   return this._spawnLightBurst(pitch,x,y,angleDeg);
    if(style==='clone')     return this._spawnCloneTrail(pitch,x,y);
    if(style==='butterfly') return this._spawnButterflyTrail(pitch,x,y);
    if(style==='blackhole') return this._spawnBlackholeTrail(pitch,x,y);
    if(style==='dragon')    return this._spawnDragonTrail(pitch,x,y);
    return this._spawnWindStreak(pitch,x,y,angleDeg,team);
  }

  // Gán ánh sáng bao quanh bóng khớp với kiểu hiệu ứng đang bay; luôn gỡ các
  // class cũ trước để không bị chồng hiệu ứng của lần sút trước
  _setBallFx(ball,style,team){
    ball.classList.remove('ball-fx-wind-mine','ball-fx-wind-theirs','ball-fx-fire','ball-fx-ice','ball-fx-leaf','ball-fx-rainbow','ball-fx-dark','ball-fx-thunder','ball-fx-light','ball-fx-clone','ball-fx-butterfly','ball-fx-blackhole','ball-fx-dragon');
    if(style==='default'||!style) return; // mặc định: bóng sạch, không ánh sáng
    if(style==='wind'){
      ball.classList.add(team==='theirs'?'ball-fx-wind-theirs':'ball-fx-wind-mine');
    }else{
      ball.classList.add('ball-fx-'+style);
    }
  }

  // ===== ĐƯỜNG BAY LIÊN TỤC (SVG path) =====
  // Thay vì rắc từng đoạn vệt rời rạc (dễ trông đứt quãng), vẽ 1 đường path
  // duy nhất nối tất cả các điểm bóng đi qua — luôn liền mạch dù animation
  // chạy ở tốc độ khung hình nào. Mỗi kiểu hiệu ứng có 1 gradient màu riêng
  // chạy dọc theo cả đường bay (từ chấm 11m tới điểm rơi) để trông rực rỡ,
  // rõ ràng hơn hẳn so với các đoạn ngắn mờ dần trước đây.
  _trailGradientStops(style){
    switch(style){
      case 'fire':    return [['0%','#000000'],['20%','#7f1d1d'],['45%','#ef4444'],['70%','#fb923c'],['100%','#fde68a']];
      case 'ice':     return [['0%','#000000'],['20%','#0e7490'],['50%','#67e8f9'],['80%','#a5f3fc'],['100%','#ffffff']];
      case 'leaf':    return [['0%','#000000'],['20%','#365314'],['50%','#84cc16'],['75%','#bef264'],['100%','#f0fdf4']];
      case 'rainbow': return [['0%','#000000'],['15%','#f43f5e'],['30%','#fb923c'],['45%','#facc15'],['60%','#4ade80'],['78%','#38bdf8'],['100%','#a78bfa']];
      case 'dark':    return [['0%','#000000'],['40%','#dc2626'],['70%','#6b21a8'],['100%','#000000']];
      case 'thunder': return [['0%','#000000'],['25%','#78350f'],['50%','#facc15'],['75%','#fef9c3'],['100%','#ffffff']];
      case 'light':   return [['0%','#b45309'],['35%','#fbbf24'],['70%','#fef08a'],['100%','#ffffff']];
      case 'clone':     return [['0%','#4c1d95'],['40%','#7b2ff7'],['75%','#b48cfa'],['100%','#ffffff']];
      case 'butterfly': return [['0%','#ffffff'],['30%','#fbcfe8'],['60%','#f9a8d4'],['100%','#ec4899']];
      case 'blackhole': return [['0%','#000000'],['25%','#0c4a6e'],['50%','#06b6d4'],['75%','#a855f7'],['100%','#ffffff']];
      case 'dragon':    return [['0%','#000000'],['20%','#0e7490'],['45%','#f59e0b'],['75%','#fde68a'],['100%','#ffffff']];
      case 'default': return [['0%','#e2e8f0'],['35%','#f8fafc'],['70%','#f1f5f9'],['100%','#ffffff']]; // trắng nhạt nhẹ nhàng
      default:        return null; // wind dùng màu đặc theo team, không cần gradient
    }
  }

  // Tạo 1 đường path SVG (glow + lõi) độc lập — dùng chung cho cả đường bay
  // chính lẫn đường bay của "bóng phân thân" (kiểu hắc ám), để có thể vẽ 2
  // đường tách biệt xoáy vào nhau thay vì chỉ 1 đường duy nhất.
  _createTrailLineObj(pitch,style,team,startX,startY,endX,endY){
    const svgNS='http://www.w3.org/2000/svg';
    const svg=document.createElementNS(svgNS,'svg');
    svg.setAttribute('class','pt-trail-line-svg');
    svg.style.position='absolute';
    svg.style.inset='0';
    svg.style.width='100%';
    svg.style.height='100%';
    svg.style.zIndex='8';
    svg.style.pointerEvents='none';
    svg.style.overflow='visible';

    let stroke;
    const stops=this._trailGradientStops(style);
    if(stops){
      const gradId='pt-trail-grad-'+(this._trailGradSeq=(this._trailGradSeq||0)+1);
      const defs=document.createElementNS(svgNS,'defs');
      const grad=document.createElementNS(svgNS,'linearGradient');
      grad.setAttribute('id',gradId);
      grad.setAttribute('gradientUnits','userSpaceOnUse');
      grad.setAttribute('x1',startX); grad.setAttribute('y1',startY);
      grad.setAttribute('x2',endX); grad.setAttribute('y2',endY);
      stops.forEach(([off,color])=>{
        const st=document.createElementNS(svgNS,'stop');
        st.setAttribute('offset',off);
        st.setAttribute('stop-color',color);
        grad.appendChild(st);
      });
      defs.appendChild(grad);
      svg.appendChild(defs);
      stroke=`url(#${gradId})`;
    }else{
      stroke='#38bdf8';
    }

    // Nhóm glow ngoài — to, mờ, tạo hào quang. KHÔNG dùng filter blur: SVG filter
    // buộc trình duyệt render lại toàn bộ khối mỗi khi path thay đổi theo frame
    // (rất tốn GPU) — thay bằng nét rộng + opacity thấp, vẫn ra hào quang mà rẻ hơn.
    const glowGroup=document.createElementNS(svgNS,'g');
    glowGroup.setAttribute('opacity','0.35');

    // Nhóm lõi — sáng rõ
    const coreGroup=document.createElementNS(svgNS,'g');
    coreGroup.setAttribute('opacity','0.95');

    // POOL phân đoạn CỐ ĐỊNH: tạo path 1 lần duy nhất, mỗi frame chỉ set lại
    // thuộc tính d trên các path có sẵn — KHÔNG còn createElement + xoá innerHTML
    // từng frame như cũ (chính là nguồn gây O(n²) DOM churn → giật hình).
    const TIERS=4;
    const CORE_W=[3,8,16,22];
    const GLOW_W=[9,18,30,36];
    const mkPath=(w)=>{
      const p=document.createElementNS(svgNS,'path');
      p.setAttribute('fill','none');
      p.setAttribute('stroke',stroke);
      p.setAttribute('stroke-width',String(w));
      p.setAttribute('stroke-linecap','round');
      p.setAttribute('d','');
      return p;
    };
    const glowSegs=[], coreSegs=[];
    for(let t=0;t<TIERS;t++){
      const gs=mkPath(GLOW_W[t]); glowGroup.appendChild(gs); glowSegs.push(gs);
      const cs=mkPath(CORE_W[t]); coreGroup.appendChild(cs); coreSegs.push(cs);
    }

    svg.appendChild(glowGroup);
    svg.appendChild(coreGroup);
    pitch.appendChild(svg);

    return {svg,glowSegs,coreSegs,stroke,points:[{x:startX,y:startY}]};
  }

  _updateTrailLineObj(tl,x,y){
    if(!tl) return;
    tl.points.push({x,y});
    let pts=tl.points;
    // Decimate: giữ tối đa ~30 điểm — path không phình vô hạn, chi phí mỗi frame
    // chỉ là O(1) thay vì rebuild toàn bộ từng frame (O(n²) khi điểm tăng dần).
    if(pts.length>30){
      const dec=[];
      for(let i=0;i<pts.length;i+=2) dec.push(pts[i]);
      const last=pts[pts.length-1];
      if(dec[dec.length-1]!==last) dec.push(last);
      tl.points=dec; pts=dec;
    }
    const n=pts.length;
    if(n<2) return;
    const TIERS=tl.glowSegs.length;
    // Tier 0 = đuôi (mảnh), tier cuối = đầu sát bóng (dày) — giữ hiệu ứng vuốt
    // nhỏ dần về đuôi, nhưng chỉ set thuộc tính trên các path có sẵn trong pool.
    for(let t=0;t<TIERS;t++){
      const from=Math.floor((t/TIERS)*(n-1));
      const to=Math.max(from+1, Math.floor(((t+1)/TIERS)*(n-1)));
      let d='';
      for(let i=from;i<=to && i<n;i++){
        const p=pts[i];
        d+=(i===from?`M ${p.x.toFixed(1)} ${p.y.toFixed(1)}`:` L ${p.x.toFixed(1)} ${p.y.toFixed(1)}`);
      }
      tl.glowSegs[t].setAttribute('d',d);
      tl.coreSegs[t].setAttribute('d',d);
    }
  }

  _finishTrailLineObj(tl){
    if(!tl) return;
    tl.svg.style.transition='opacity 0.35s ease-out';
    tl.svg.style.opacity='0';
    setTimeout(()=>tl.svg.remove(),380);
  }

  // Đường bay chính (theo bóng thật)
  _startTrailLine(pitch,style,team,startX,startY,endX,endY){
    // Dọn đường path của lượt trước nếu vì lý do gì đó chưa kịp remove
    if(this._trailLine){ this._trailLine.svg.remove(); this._trailLine=null; }
    this._trailLine=this._createTrailLineObj(pitch,style,team,startX,startY,endX,endY);
  }
  _updateTrailLine(x,y){ this._updateTrailLineObj(this._trailLine,x,y); }
  _finishTrailLine(){
    const tl=this._trailLine;
    this._trailLine=null;
    this._finishTrailLineObj(tl);
  }

  // Đường bay của "bóng phân thân" — chỉ dùng cho kiểu hắc ám, để 2 đường
  // luôn nhìn rõ tách biệt trong lúc xoáy vào nhau, rồi hợp nhất tại điểm rơi
  _startShadowTrailLine(pitch,style,team,startX,startY,endX,endY){
    if(this._trailLineShadow){ this._trailLineShadow.svg.remove(); this._trailLineShadow=null; }
    this._trailLineShadow=this._createTrailLineObj(pitch,style,team,startX,startY,endX,endY);
  }
  _updateShadowTrailLine(x,y){ this._updateTrailLineObj(this._trailLineShadow,x,y); }
  _finishShadowTrailLine(){
    const tl=this._trailLineShadow;
    this._trailLineShadow=null;
    this._finishTrailLineObj(tl);
  }

  // Độ lệch vuông góc so với đường thẳng chấm 11m → điểm rơi, theo từng kiểu
  // hiệu ứng — đây là phần quyết định HÌNH DẠNG đường bay (zíc-zắc, xoáy,
  // chữ S, vòng cung, nảy...), khác với _trailGradientStops chỉ lo màu sắc.
  _trailOffset(style,raw){
    switch(style){
      case 'wind':    return 28*Math.sin(raw*3*2*Math.PI);                 // gió: xoáy tròn đều như lò xo, biên độ không đổi suốt đường bay
      case 'dark':    return 34*(1-raw)*Math.sin(raw*3*2*Math.PI);         // hắc ám: 2 đường xoáy đối pha, thu hẹp dần rồi hợp nhất tại điểm rơi
      case 'rainbow': return 100*Math.sin(Math.PI*raw); // cầu vồng: vòng cung cao, rõ nét
      case 'leaf':    return 18*(1-raw)*Math.abs(Math.sin(raw*4*Math.PI)); // lá cây: nảy nảy nảy, biên độ giảm dần
      case 'fire':    return 42*Math.sin(raw*2*Math.PI);                  // lửa: 1 chu kỳ sin biên độ lớn = rõ hình chữ S
      case 'thunder':{
        const tw=raw*4;
        return 22*(2*Math.abs(2*(tw-Math.floor(tw+0.5)))-1);              // sấm sét: sóng tam giác = zíc-zắc góc nhọn
      }
      case 'butterfly': return 0; // bươm bướm: bóng chính bay thẳng = thân, 2 cánh tách ra từ giữa
      case 'blackhole': return 0; // hố đen: bóng đi thẳng, teleport ở giữa
      case 'ice':
      case 'light':
      case 'clone':
      default: return 0;                                                   // băng giá & ánh sáng: bay thẳng tuyệt đối, không lệch
    }
  }

  // Tốc độ tiến theo phương chính: băng giá & sấm sét bay đều tốc độ không
  // đổi (đúng chất "thẳng"/"tia chớp"), các kiểu còn lại ease-out cho mượt.
  _trailForward(style,raw){
    if(style==='ice'||style==='thunder'||style==='fire'||style==='light'||style==='clone'||style==='blackhole') return raw;
    if(style==='butterfly') return raw; // bướm bay đều tốc độ
    return 1-Math.pow(1-raw,3);
  }

  // Animate ball from penalty spot to target zone
  _animateBallToZone(zoneId, callback, team, preTrailStyle){
    const ball=document.getElementById('pt-ball');
    if(!ball)return callback();
    const pitch=document.getElementById('pt-pitch');
    const zone=document.querySelector(`[data-zone="${zoneId}"]`);
    if(!zone||!pitch)return callback();

    const pRect=pitch.getBoundingClientRect();
    const zRect=zone.getBoundingClientRect();
    // Ball starts right in front of the shooter (penalty spot)
    const startX=this._ballStartX(pitch,pRect);
    const startY=this._ballStartY(pitch,pRect);
    // Target: center of the zone
    const endX=zRect.left-pRect.left+zRect.width/2;
    const endY=zRect.top-pRect.top+zRect.height/2;
    const angleDeg=Math.atan2(endY-startY,endX-startX)*180/Math.PI;
    // Vector đơn vị dọc/vuông góc đường bay — dùng để lệch bóng ra khỏi
    // đường thẳng đúng theo hình dạng riêng của từng kiểu hiệu ứng.
    const dx=endX-startX, dy=endY-startY;
    const dist=Math.hypot(dx,dy)||1;
    const nx=-dy/dist, ny=dx/dist;

    // Reset position — luôn dùng transform (translate/scale/rotate), KHÔNG
    // dùng left/top để animate: left/top buộc trình duyệt reflow+repaint mỗi
    // frame (rất dễ giật trên máy yếu/mobile), còn transform chỉ cần composite
    // trên GPU nên mượt hơn hẳn.
    ball.style.left='0';
    ball.style.top='0';
    ball.style.opacity='1';
    ball.style.transition='none';
    ball.style.display='';
    const setBallTransform=(x,y,scale,rotDeg)=>{
      ball.style.transform=`translate(calc(-50% + ${x}px), calc(-50% + ${y}px)) scale(${scale}) rotate(${rotDeg}deg)`;
    };
    setBallTransform(startX,startY,1,0);
    void ball.offsetWidth;

    // Dọn bóng phân thân còn sót lại từ cú sút "hắc ám" trước (nếu vì lý do
    // gì đó chưa kịp remove) trước khi tạo cú sút mới.
    if(this._shadowBall){ this._shadowBall.remove(); this._shadowBall=null; }
    if(this._trailLineShadow){ this._trailLineShadow.svg.remove(); this._trailLineShadow=null; }
    if(this._bhExitTrail){ this._finishTrailLineObj(this._bhExitTrail); this._bhExitTrail=null; }

    // Tự điều khiển animation bằng requestAnimationFrame thay vì CSS transition
    // + setInterval riêng lẻ (2 timeline khác nhau chạy độc lập là nguyên nhân
    // chính gây giật hình/giật đường bay) — giờ tất cả đồng bộ theo đúng 1 vòng
    // rAF, luôn khớp với frame vẽ thực tế của trình duyệt.
    // LowPerf: ép 'default' dù MP có sync hiệu ứng từ client kia (gs.shotEffect)
    // — nếu không, các nhánh dark/light/clone/butterfly/blackhole vẫn tạo bóng phụ.
    const trailStyle=this._lowPerf ? 'default' : (preTrailStyle||this._pickTrailStyle());
    const flightMs=FLIGHT_MS_BY_STYLE[trailStyle]||900;
    const t0=performance.now();
    let lastAccentT=-1;
    this._setBallFx(ball,trailStyle,team);
    // Chế độ hiệu suất thấp: bỏ trail SVG đường bay (giảm DOM + setAttribute/frame)
    if(!this._lowPerf) this._startTrailLine(pitch,trailStyle,team,startX,startY,endX,endY);

    // "Hắc ám" — phân thân ra 2 quả bóng, xoáy đối pha rồi hợp nhất lại tại
    // điểm rơi (biên độ lệch giảm dần về 0 đúng lúc raw→1).
    let shadowBall=null;
    if(trailStyle==='dark'){
      shadowBall=document.createElement('div');
      shadowBall.className='pt-ball pt-ball-shadow';
      shadowBall.textContent=ball.textContent;
      shadowBall.style.left='0';
      shadowBall.style.top='0';
      shadowBall.style.transition='none';
      shadowBall.style.transform=`translate(calc(-50% + ${startX}px), calc(-50% + ${startY}px)) scale(1) rotate(0deg)`;
      pitch.appendChild(shadowBall);
      this._shadowBall=shadowBall;
      // Vẽ riêng 1 đường path thứ 2 cho bóng phân thân — để nhìn rõ 2 đường
      // bay tách biệt luôn xoáy vào nhau, thay vì chỉ 1 đường duy nhất
      this._startShadowTrailLine(pitch,trailStyle,team,startX,startY,endX,endY);
    }

    // "Ánh sáng" — 3 quả bóng từ 3 hướng cách đều 120°, hợp nhất tại khung thành
    let lightBalls=null; // [{el,trail,sx,sy}]
    if(trailStyle==='light'){
      const angleToGoal=Math.atan2(endY-startY, endX-startX);
      const a60=60*Math.PI/180;
      const dirs=[
        {rot: a60},
        {rot:-a60},
      ];
      lightBalls=dirs.map(d=>{
        const sx=endX+dist*Math.cos(angleToGoal+d.rot);
        const sy=endY+dist*Math.sin(angleToGoal+d.rot);
        const eb=document.createElement('div');
        eb.className='pt-ball pt-ball-light-shadow';
        eb.textContent=ball.textContent;
        eb.style.left='0';
        eb.style.top='0';
        eb.style.transition='none';
        eb.style.transform=`translate(calc(-50% + ${sx}px), calc(-50% + ${sy}px)) scale(1) rotate(0deg)`;
        pitch.appendChild(eb);
        const trail=this._createTrailLineObj(pitch,trailStyle,team,sx,sy,endX,endY);
        return {el:eb, trail, sx, sy};
      });
    }

    // "Phân thân" — 3 bóng bay 3 hướng, 2 clone mờ dần biến mất
    let cloneBalls=null; // [{el,trail,endX,endY}]
    if(trailStyle==='clone'){
      const allZones=[...document.querySelectorAll('.pt-zone')];
      const mainZoneEl=document.querySelector(`[data-zone="${zoneId}"]`);
      const others=allZones.filter(z=>z!==mainZoneEl);
      // Tính tâm từng zone rồi ưu tiên chọn cặp CÁCH XA NHAU (vẫn có yếu tố
      // ngẫu nhiên) — tránh trường hợp 2 clone rơi vào 2 ô sát nhau khiến
      // đường bay chồng/dính vào nhau.
      const pts=others.map(z=>{
        const r=z.getBoundingClientRect();
        return {zone:z, x:r.left-pRect.left+r.width/2, y:r.top-pRect.top+r.height/2};
      });
      let bestPair=null,bestScore=-1;
      for(let i=0;i<pts.length;i++){
        for(let j=i+1;j<pts.length;j++){
          const dist=Math.hypot(pts[i].x-pts[j].x,pts[i].y-pts[j].y);
          const score=dist+Math.random()*40; // nhiễu ngẫu nhiên để không luôn ra 1 cặp cố định
          if(score>bestScore){bestScore=score;bestPair=[pts[i],pts[j]];}
        }
      }
      const shuffled=bestPair.map(p=>p.zone);
      cloneBalls=shuffled.map(targetZone=>{
        const tRect=targetZone.getBoundingClientRect();
        const tzEndX=tRect.left-pRect.left+tRect.width/2;
        const tzEndY=tRect.top-pRect.top+tRect.height/2;
        const eb=document.createElement('div');
        eb.className='pt-ball pt-ball-clone-shadow';
        eb.textContent=ball.textContent;
        eb.style.left='0';
        eb.style.top='0';
        eb.style.transition='none';
        eb.style.transform=`translate(calc(-50% + ${startX}px), calc(-50% + ${startY}px)) scale(1) rotate(0deg)`;
        pitch.appendChild(eb);
        const trail=this._createTrailLineObj(pitch,trailStyle,team,startX,startY,tzEndX,tzEndY);
        return {el:eb, trail, endX: tzEndX, endY: tzEndY};
      });
    }

    // "Bươm bướm" — bóng chính bay thẳng làm thân, tại ~35% tách ra 2 cánh
    // vẽ hình cánh bướm rồi hợp lại tại khung thành thành râu.
    let wingBalls=null; // [{el,trail,side,startX,startY}]
    let wingSpawned=false;

    // "Hố đen" — 2 cổng xuyên không: bóng bay vào cổng 1, biến mất, xuất hiện từ cổng 2
    let portalEntered=false, portalExited=false;
    let portal1El=null, portal2El=null;
    let portal1X, portal1Y, portal2X, portal2Y;
    const portal1Raw=0.2, portal2Raw=0.65; // teleport timing
    if(trailStyle==='blackhole'){
      portal1X=startX+dx*0.15; portal1Y=startY+dy*0.15;
      portal2X=startX+dx*0.65; portal2Y=startY+dy*0.65;
      const createPortal=(x,y,cls)=>{
        const e=document.createElement('div'); e.className=cls;
        e.style.left=x+'px'; e.style.top=y+'px';
        e.style.transform='translate(-50%,-50%)';
        // Lớp xoáy conic-gradient — tạo cảm giác xoắn ốc hút vào
        const vortex=document.createElement('div');
        vortex.className='pt-blackhole-vortex';
        e.appendChild(vortex);
        // Lớp xoáy trong — quay ngược chiều tạo chiều sâu
        const inner=document.createElement('div');
        inner.className='pt-blackhole-vortex-inner';
        e.appendChild(inner);
        // Vòng quỹ đạo — dashed ring
        const orbit=document.createElement('div');
        orbit.className='pt-blackhole-orbit';
        e.appendChild(orbit);
        // Hạt mảnh vụn quay quanh hố đen (8 hạt)
        const debrisColors=['#06b6d4','#a855f7','#ffffff','#0ea5e9','#c084fc','#38bdf8','#d8b4fe','#6ee7b7'];
        for(let i=0;i<8;i++){
          const d=document.createElement('div');
          d.className='pt-blackhole-debris';
          const a=(i/8)*360;
          d.style.setProperty('--start-angle',a+'deg');
          d.style.setProperty('--orbit-speed',String(1.2+Math.random()*2));
          d.style.setProperty('--orbit-radius',String(28+Math.random()*10));
          d.style.animationDelay=(Math.random()*2)+'s';
          d.style.color=debrisColors[i%debrisColors.length];
          e.appendChild(d);
        }
        pitch.appendChild(e);
        return e;
      };
      portal1El=createPortal(portal1X,portal1Y,'pt-blackhole-portal entry');
      portal2El=createPortal(portal2X,portal2Y,'pt-blackhole-portal exit');
    }

    const step=(now)=>{
      const raw=Math.min(1,(now-t0)/flightMs);
      const fwd=this._trailForward(trailStyle,raw);
      const off=this._trailOffset(trailStyle,raw);
      let x=startX+dx*fwd+nx*off;
      let y=startY+dy*fwd+ny*off;
      const scale=1+0.3*raw;
      const rot=(trailStyle==='thunder'?360:720)*raw;
      setBallTransform(x,y,scale,rot);
      if(shadowBall){
        const sx=startX+dx*fwd-nx*off;
        const sy=startY+dy*fwd-ny*off;
        shadowBall.style.transform=`translate(calc(-50% + ${sx}px), calc(-50% + ${sy}px)) scale(${scale}) rotate(${-rot}deg)`;
        this._updateShadowTrailLine(sx,sy);
      }
      // 2 bóng phụ ánh sáng — bay thẳng về khung thành
      if(lightBalls){
        lightBalls.forEach(b=>{
          const f=raw; // linear
          const bx=b.sx+(endX-b.sx)*f;
          const by=b.sy+(endY-b.sy)*f;
          b.el.style.transform=`translate(calc(-50% + ${bx}px), calc(-50% + ${by}px)) scale(${scale}) rotate(${-rot}deg)`;
          this._updateTrailLineObj(b.trail,bx,by);
        });
      }
      // Bươm bướm — vẽ cánh: bóng chính = thân, tại ~35% tách 2 cánh bay vòng
      // ra ngoài rồi khép lại ở khung thành tạo thành râu bướm.
      if(trailStyle==='butterfly'){
        if(raw>=0.35 && !wingSpawned){
          wingSpawned=true;
          const LOBES=[
            {id:'fore',path:'M0,0 C14,-6 20,-20 4,-24 C-6,-20 -6,-6 0,0 Z',w:24,h:26,amp:1,phase:0},
            {id:'hind',path:'M0,0 C12,4 16,16 4,20 C-4,16 -4,4 0,0 Z',w:20,h:22,amp:0.6,phase:0.9},
          ];
          wingBalls=[1,-1].flatMap(side=>LOBES.map(lobe=>{
            const eb=document.createElement('div');
            eb.className='pt-ball-butterfly-wing';
            eb.innerHTML=`<svg viewBox="-8 -26 28 52" width="${lobe.w}" height="${lobe.h}">
              <path d="${lobe.path}" fill="url(#pt-wing-grad-${side>0?'r':'l'}-${lobe.id})" stroke="rgba(255,255,255,0.55)" stroke-width="1.1"/>
              <defs><linearGradient id="pt-wing-grad-${side>0?'r':'l'}-${lobe.id}" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stop-color="#ffffff"/><stop offset="100%" stop-color="#ec4899"/>
              </linearGradient></defs>
            </svg>`;
            eb.style.left='0';
            eb.style.top='0';
            eb.style.transition='none';
            eb.style.transform=`translate(calc(-50% + ${x}px), calc(-50% + ${y}px)) scale(${scale}) scaleX(${side})`;
            pitch.appendChild(eb);
            const trail=this._createTrailLineObj(pitch,trailStyle,team,x,y,endX,endY);
            return {el:eb,trail,side,startX:x,startY:y,amp:lobe.amp,phase:lobe.phase};
          }));
        }
        if(wingBalls){
          const wingRaw=Math.min(1,(raw-0.35)/0.65);
          const envelope=Math.sin(wingRaw*Math.PI);
          const flapFreq=6;
          wingBalls.forEach(w=>{
            const ws=envelope*w.amp*60*Math.sin(wingRaw*Math.PI);
            const wingFlap=0.55+0.45*Math.abs(Math.sin((wingRaw*flapFreq+w.phase)*Math.PI));
            const wx=w.startX+(endX-w.startX)*wingRaw+ws*w.side;
            const wy=w.startY+(endY-w.startY)*wingRaw-6*envelope*w.amp;
            w.el.style.transform=`translate(calc(-50% + ${wx}px), calc(-50% + ${wy}px)) scale(${scale}) scaleX(${w.side*wingFlap})`;
            this._updateTrailLineObj(w.trail,wx,wy);
          });
          // 2 râu bướm — tỉa ra khi bóng sắp chạm đích
          if(raw>=0.9 && !this._antennaeSpawned){
            this._antennaeSpawned=true;
            this._spawnButterflyAntennae(pitch,endX,endY,angleDeg);
          }
        } else {
          this._antennaeSpawned=false;
        }
      }

      // 2 clone — bay về zone riêng, mờ dần từ 40%→70% rồi biến mất
      if(cloneBalls){
        const cloneOpacity=raw<0.4?1:raw<0.7?1-(raw-0.4)/0.3:0;
        cloneBalls.forEach(b=>{
          const f=raw;
          const cx=startX+(b.endX-startX)*f;
          const cy=startY+(b.endY-startY)*f;
          b.el.style.opacity=String(cloneOpacity);
          b.el.style.transform=`translate(calc(-50% + ${cx}px), calc(-50% + ${cy}px)) scale(${scale}) rotate(${-rot}deg)`;
          this._updateTrailLineObj(b.trail,cx,cy);
          if(cloneOpacity<=0&&b.trail.svg.style.opacity!=='0'){
            b.trail.svg.style.transition='opacity 0.2s ease-out';
            b.trail.svg.style.opacity='0';
          }
        });
      }
      // "Hố đen" — teleport: bay vào cổng 1, biến mất, xuất hiện từ cổng 2
      // Vệt cũ (start→portal1) giữ nguyên, tạo vệt RIÊNG cho đoạn sau cổng 2
      if(trailStyle==='blackhole' && portal1El && portal2El){
        if(raw < portal1Raw){
          // Phase 1: bay từ start đến portal1 (vệt vẽ đến portal1)
          const t=raw/portal1Raw;
          x=startX+(portal1X-startX)*t;
          y=startY+(portal1Y-startY)*t;
          const sc=1-0.6*t;
          setBallTransform(x,y,sc,rot);
          ball.style.opacity=String(1-0.3*t);
          portal1El.style.setProperty('--portal-scale',String(0.5+0.5*raw));
          portal1El.style.opacity=String(Math.min(1,raw*3));
        }else if(raw < portal2Raw){
          // Phase 2: trong cổng — ẩn bóng, giữ x,y không đổi (trail đứng yên)
          x=portal1X; y=portal1Y;
          ball.style.opacity='0';
          ball.style.transform='translate(-50%,-50%) scale(0)';
          portal1El.style.setProperty('--portal-scale','1.3');
          portal2El.style.setProperty('--portal-scale',String(0.5+1.5*(raw-portal1Raw)/(portal2Raw-portal1Raw)));
          portal2El.style.opacity=String(Math.min(1,3*(raw-portal1Raw)/(portal2Raw-portal1Raw)));
        }else{
          // Phase 3: xuất hiện từ cổng 2
          if(!portalExited){
            portalExited=true;
            // Tạo vệt RIÊNG từ portal2 — giữ nguyên vệt cũ (start→portal1)
            this._bhExitTrail = this._createTrailLineObj(pitch,trailStyle,team,portal2X,portal2Y,endX,endY);
            // Thêm điểm giả tại portal2 để vệt đầu ra dày (k bị nhọn)
            if(this._bhExitTrail){
              for(let d=0;d<20;d++) this._bhExitTrail.points.push({x:portal2X,y:portal2Y});
            }
          }
          const t=(raw-portal2Raw)/(1-portal2Raw);
          x=portal2X+(endX-portal2X)*t;
          y=portal2Y+(endY-portal2Y)*t;
          const sc=0.4+0.6*(1+0.3*t);
          setBallTransform(x,y,sc,rot);
          ball.style.opacity=String(0.6+0.4*t);
          portal2El.style.setProperty('--portal-scale',String(1.3-0.3*t));
          // Cập nhật vệt exit
          if(this._bhExitTrail) this._updateTrailLineObj(this._bhExitTrail,x,y);
        }
      }

      // Vẽ nối thêm điểm vào đường path — luôn liền mạch theo đúng khung hình
      // thực tế, không còn đứt quãng như cách rắc từng đoạn rời trước đây.
      // Hố đen: Phase 2 thì trail đã giậm chân ở portal1, Phase 3 dùng vệt riêng
      // Chế độ hiệu suất thấp: bỏ luôn phần này (không tạo hạt, không set path).
      if(!this._lowPerf){
        if(trailStyle!=='blackhole' || raw<portal1Raw) this._updateTrailLine(x,y);
        // Hạt điểm nhấn (lửa/băng/lá/hắc ám/sấm sét) rắc thưa hơn để tô thêm
        // chi tiết trên nền đường path liên tục, không đóng vai trò chính nữa.
        const bhGap = trailStyle==='blackhole' && raw>=portal1Raw && raw<portal2Raw;
        if((trailStyle==='wind'||trailStyle==='rainbow'||trailStyle==='fire'||trailStyle==='ice'||trailStyle==='leaf'||trailStyle==='dark'||trailStyle==='thunder'||trailStyle==='light'||trailStyle==='clone'||trailStyle==='butterfly'||trailStyle==='blackhole') && !bhGap && (raw-lastAccentT>=0.22 || raw>=1)){
          lastAccentT=raw;
          this._spawnBallTrail(pitch,x,y,angleDeg,team,trailStyle);
        }
      }
      if(raw<1){
        requestAnimationFrame(step);
      }else{
        if(shadowBall){ shadowBall.remove(); this._shadowBall=null; this._finishShadowTrailLine(); }
        if(lightBalls){
          lightBalls.forEach(b=>{
            b.el.remove();
            b.trail.svg.style.transition='opacity 0.35s ease-out';
            b.trail.svg.style.opacity='0';
            setTimeout(()=>{if(b.trail.svg.parentNode)b.trail.svg.remove();},380);
          });
          lightBalls=null;
        }
        if(cloneBalls){
          cloneBalls.forEach(b=>{
            b.el.remove();
            if(b.trail.svg.parentNode) b.trail.svg.remove();
          });
          cloneBalls=null;
        }
        if(wingBalls){
          wingBalls.forEach(w=>{
            w.el.remove();
            w.trail.svg.style.transition='opacity 0.35s ease-out';
            w.trail.svg.style.opacity='0';
            setTimeout(()=>{if(w.trail.svg.parentNode)w.trail.svg.remove();},380);
          });
          wingBalls=null;
        }
        if(portal1El){ portal1El.remove(); portal1El=null; }
        if(portal2El){ portal2El.remove(); portal2El=null; }
        if(this._bhExitTrail){ this._finishTrailLineObj(this._bhExitTrail); this._bhExitTrail=null; }
        this._finishTrailLine();
        setTimeout(callback,20);
      }
    };
    requestAnimationFrame(step);
  }

  // Thủ môn thuộc đội KHÔNG sút ở lượt hiện tại.
  // GIẢM LAG: không nhuộm theo quốc gia nữa — cố định 2 màu:
  // đội nhà (player sút, đối thủ bắt) = 'away' → ĐEN; AI sút (đội nhà bắt) = 'home' → TRẮNG.
  _defendingKeeperSide(){
    return this.state.currentShooter==='player' ? 'away' : 'home';
  }

  _keeperDive(zone,cls,flightMs){
    const keeper=document.getElementById('pt-keeper');
    applyKeeperSprite(keeper,zone);
    applyKeeperKit(keeper, zone, this._defendingKeeperSide());
    keeper.style.setProperty('--flip',keeper.dataset.flip==='1'?-1:1);
    const keeperMs=(flightMs||900)*1.5;
    keeper.style.setProperty('--dive-ms',keeperMs+'ms');
    const targetZone=document.querySelector(`.pt-zone[data-zone="${zone}"]`);
    let kx=0,ky=0;
    if(targetZone){
      const kRect=keeper.getBoundingClientRect();
      const zRect=targetZone.getBoundingClientRect();
      kx=(zRect.left+zRect.width/2)-(kRect.left+kRect.width/2);
      ky=(zRect.top+zRect.height/2)-(kRect.top+kRect.height/2);
    }else{
      const zi=ZONES.indexOf(zone);
      const col=zi%3,row=Math.floor(zi/3);
      kx=(col-1)*40;ky=(row-1)*30;
    }
    // Chỉnh tay thêm cho từng pose nếu ảnh gốc không canh giữa đẹp (VD: top-center bay hơi cao/nhỏ)
    const posCfg=GK_POSITIONS[zone];
    if(posCfg){
      kx+=posCfg.offsetX||0;
      ky+=posCfg.offsetY||0;
    }
    // Bỏ transition "all" của trạng thái nghỉ để animation keyframe dưới đây
    // toàn quyền điều khiển transform — tránh 2 nguồn cùng ghi đè gây giật.
    keeper.style.transition='none';
    keeper.style.setProperty('--dx',kx+'px');keeper.style.setProperty('--dy',ky+'px');
    keeper.style.animationDuration=keeperMs+'ms';
    keeper.classList.remove('diving','save');void keeper.offsetWidth;
    keeper.classList.add(cls);
  }

  resetKeeperPos(){
    const k=document.getElementById('pt-keeper');
    if(!k)return;
    // Freeze vị trí hiện tại + set transition TRƯỚC KHI xoá animation class
    const curTransform=getComputedStyle(k).transform;
    k.style.transition='transform 0.5s cubic-bezier(0.34,1.56,0.64,1)';
    k.style.transform=curTransform;
    void k.offsetWidth; // force reflow để browser ghi nhận transition
    // Giờ mới xoá class — transition sẽ animate từ vị trí đang bay về giữa
    k.classList.remove('diving','save');
    applyKeeperSprite(k,'mid-stand');
    applyKeeperKit(k, 'mid-stand', this._defendingKeeperSide());
    k.style.setProperty('--flip',1);
    k.style.transform='translate(0,0) scale(var(--gk-scale,1))';
    k.style.setProperty('--dx','0px');k.style.setProperty('--dy','0px');
  }

  // ===== Shooter sprite (foreground, whichever team is currently shooting) =====
  _shooterKick(){
    const s=document.getElementById('pt-shooter');
    if(!s)return;
    this.state._shooterPose='kick';
    renderShooterSprite('kick', this.state._shooterKit);
    s.classList.remove('kick','celebrate','disappoint');
    void s.offsetWidth;
    s.classList.add('kick');
  }

  _shooterResult(isGoal){
    const s=document.getElementById('pt-shooter');
    if(!s)return;
    const pose = isGoal?'celebrate':'disappoint';
    this.state._shooterPose=pose;
    renderShooterSprite(pose, this.state._shooterKit);
    s.classList.remove('kick','celebrate','disappoint');
    void s.offsetWidth;
    s.classList.add(pose);
  }

  resetShooterPos(side='left'){
    const s=document.getElementById('pt-shooter');
    if(!s)return;
    s.style.display='';
    s.classList.remove('kick','celebrate','disappoint','pos-left','pos-right');
    s.classList.add(side==='right'?'pos-right':'pos-left');
    // Áo/quần + số áo + tên đội đổi theo đội đang sút (trái = đội mình, phải = đối thủ)
    const team = side==='right' ? this.state.aiCountry : this.state.playerCountry;
    const nameEl=document.getElementById('pt-jersey-name');
    const numEl=document.getElementById('pt-jersey-number');
    const flagEl=document.getElementById('pt-shooter-flag');
    if(nameEl) nameEl.textContent = team ? abbr3(team) : '';
    if(numEl) numEl.textContent = String(randomJerseyNumber());
    if(flagEl) flagEl.innerHTML = team ? flagImg(team.code, team.name, 13) : '';
    this.state._shooterPose='mid-stand';
    if(!team){ renderShooterSprite('mid-stand', null); return; }
    // Token chống trường hợp promise của lượt trước (đội kia) resolve trễ rồi
    // ghi đè nhầm màu áo lên sprite của đội đang hiện tại.
    const reqId = ++this._shooterReq;
    // Màu tóc random riêng cho MỖI cầu thủ/lượt sút (không dùng chung với cache màu cờ của đội,
    // để tránh 2 cầu thủ cùng đội bị lấy đúng 1 object cache và dính chung màu tóc).
    const hairHex = this._pickShooterHair(side==='right' ? 1 : 0);
    const cached = flagColorCache[team.code];
    if(cached){
      // Đã có sẵn màu cờ (nhờ prefetch ở showMatch) → nhuộm màu ngay, không
      // hiện ảnh trắng gốc rồi mới đổi màu sau (tránh chớp trắng).
      const kit = {...cached, hair:hairHex};
      this.state._shooterKit = kit;
      renderShooterSprite('mid-stand', kit);
      // Pre-warm kick/celebrate/disappoint với ĐÚNG màu tóc của cú sút này.
      // showMatch pre-warm dùng màu random khác → _hairLayerCache miss khi sút
      // → _dyeMaskLayer chạy pixel đồng bộ đúng lúc bóng bay (lag cú sút đầu).
      // LƯU promise để animateShot AWAIT — đảm bảo dye xong trước khi bóng bay.
      this._shotPrewarmP = this._prewarmShotPoses(kit);
      return;
    }
    // Chưa có cache: hiện ảnh gốc tạm trong lúc chờ tải màu cờ, TUYỆT ĐỐI
    // không dùng lại _shooterKit cũ (của đội trước đó) kẻo tô nhầm màu đội kia.
    renderShooterSprite('mid-stand', null);
    // Gán promise NGAY (không đợi resolve) → animateShot await sẽ chờ cả
    // getFlagColors lẫn prewarm hoàn tất. Vá khe hở: đội không có trong KIT_COLORS
    // nếu sút trước khi màu cờ resolve thì trước đây _shotPrewarmP undefined → vẫn lag.
    this._shotPrewarmP = getFlagColors(team.code).then((kitRaw)=>{
      if(reqId!==this._shooterReq) return; // đội đang hiện đã đổi trong lúc chờ → bỏ kết quả cũ
      const kit = {...kitRaw, hair:hairHex};
      this.state._shooterKit = kit;
      if(this.state._shooterPose==='mid-stand') renderShooterSprite('mid-stand', kit);
      return this._prewarmShotPoses(kit);
    });
  }

  // Làm nóng trước các pose sẽ dùng lúc sút (kick/celebrate/disappoint) với
  // ĐÚNG màu áo + màu tóc của lượt sút sắp diễn ra — tránh tính pixel đồng bộ
  // ngay giữa animation cú sút đầu tiên gây giật.
  async _waitShotPrewarm(){
    // Chờ pre-warm hoàn tất trước khi bóng bay, NHƯNG không bao giờ kẹt vĩnh viễn:
    // nếu getFlagColors treo (mạng chậm, không timeout) thì sau 1.5s cú sút
    // vẫn diễn ra bình thường — prewarm thất bại chỉ mất lợi ích chống lag, không block game.
    try{ await Promise.race([this._shotPrewarmP||Promise.resolve(), new Promise(r=>setTimeout(r,1500))]); }catch(e){}
  }
  _prewarmShotPoses(kit){
    if(!kit) return Promise.resolve();
    // Trả về Promise.all để animateShot có thể AWAIT — đảm bảo mọi tính toán
    // pixel (dye mask) đã xong TRƯỚC khi bóng bay, không rơi vào giữa đường bay.
    return Promise.all([
      _getSplitShooterLayers('kick', kit.primary, kit.secondary, kit.hair, kit.socks).catch(()=>{}),
      _getSplitShooterLayers('celebrate', kit.primary, kit.secondary, kit.hair, kit.socks).catch(()=>{}),
      _getSplitShooterLayers('disappoint', kit.primary, kit.secondary, kit.hair, kit.socks).catch(()=>{}),
    ]);
  }

  // ===== RENDER — Status Bar with 5-shot circles =====
  // Hiệu ứng "nhảy" số tỉ số — chỉ gọi đúng lúc điểm vừa tăng
  _bumpScoreEl(id){
    const el=document.getElementById(id);
    if(!el)return;
    el.classList.remove('pt-score-bump');
    void el.offsetWidth;
    el.classList.add('pt-score-bump');
  }

  // Nhấp nháy bóng đổ đen theo viền — bóng khi SÚT, thủ môn khi BẮT
  _setRoleBlink(on, which){
    const ball=document.getElementById('pt-ball');
    const keeper=document.getElementById('pt-keeper');
    if(ball) ball.classList.toggle('role-blink', !!(on && which==='ball'));
    if(keeper) keeper.classList.toggle('role-blink', !!(on && which==='keeper'));
  }

  renderStatusBar(){
    // Blink theo lượt: đang SÚT thì nhấp nháy bóng, đang BẮT thì nhấp nháy thủ môn
    const _p=this.state.phase;
    this._setRoleBlink((_p==='shooting'||_p==='defending') && !this.state.shotLocked, _p==='defending' ? 'keeper' : 'ball');
    const pc=this.state.playerCountry,ac=this.state.aiCountry;
    // Flags + names — chỉ cập nhật khi ĐỔI ĐỘI (mỗi trận 1 lần). renderStatusBar
    // được gọi nhiều lần mỗi lượt sút; bỏ qua write DOM thừa khi đội không đổi
    // giúp giảm layout/repaint đáng kể trên máy yếu.
    const teamKey=pc.code+'|'+ac.code;
    if(this._sbTeamKey!==teamKey){
      this._sbTeamKey=teamKey;
      document.getElementById('pt-sb-pflag').innerHTML=flagImg(pc.code, pc.name, 24);
      document.getElementById('pt-sb-pname').textContent=pc.name;
      document.getElementById('pt-sb-aflag').innerHTML=flagImg(ac.code, ac.name, 24);
      document.getElementById('pt-sb-aname').textContent=ac.name;
    }
    // Score
    document.getElementById('pt-sb-you').textContent=this.state.scores[0];
    document.getElementById('pt-sb-ai').textContent=this.state.scores[1];

    // Build shot circles: 5 per team, filled by history order (reset mỗi khi vào loạt luân lưu mới)
    const baseP=this.state._dotsBaseP||0, baseA=this.state._dotsBaseA||0;
    const pHistory=this.state.history.filter(s=>s.shooter==='player'||s.shooter==='p2').slice(baseP);
    const aHistory=this.state.history.filter(s=>s.shooter==='ai').slice(baseA);
    const maxSlots=Math.max(5,pHistory.length,aHistory.length);

    const dotHtml=(arr)=>{
      let h='';
      for(let i=0;i<maxSlots;i++){
        if(i<arr.length){
          const shot=arr[i];
          // Chỉ chấm MỚI NHẤT mới phát animation "pop" — các chấm cũ giữ nguyên, không bị replay hiệu ứng
          const popCls=(i===arr.length-1)?' pt-dot-pop':'';
          h+=`<span class="pt-dot ${shot.result==='goal'?'pt-dot-goal':'pt-dot-miss'}${popCls}"></span>`;
        }else{
          h+=`<span class="pt-dot pt-dot-empty"></span>`;
        }
      }
      return h;
    };
    document.getElementById('pt-sb-pdots').innerHTML=dotHtml(pHistory);
    document.getElementById('pt-sb-adots').innerHTML=dotHtml(aHistory);

    // Turn banner — chữ to giữa sân
    const box=document.getElementById('pt-turn-box');
    if(this.state.phase==='idle'){
      box.style.display='none';
    }else if(this.state.phase==='finished'){
      const r=this.state._lastMatchResult;
      box.innerHTML=r==='win'?'THẮNG':r==='lose'?'THUA':'HÒA';
      box.className='pt-turn-box '+(r==='win'?'result-good':r==='lose'?'result-bad':'result-draw');
      box.style.display='';
    }else if(this.state.phase==='defending'){
      box.innerHTML='THỦ MÔN';
      box.className='pt-turn-box keeper-turn';
      box.style.display='';
    }else{
      box.innerHTML='SÚT!!!';
      box.className='pt-turn-box shoot-turn';
      box.style.display='';
    }

    const sb=document.getElementById('pt-statusbar');
    sb.classList.remove('result-win','result-lose','result-draw');
    if(this.state.phase==='finished'){
      sb.classList.add(this.state._lastMatchResult==='win'?'result-win':this.state._lastMatchResult==='lose'?'result-lose':'result-draw');
    }

    if(this.state._mode)this.saveProgress();
  }



  // ===== SAVE / RESUME PROGRESS =====
  // Debounce: saveProgress có thể được gọi nhiều lần liên tiếp (mỗi lượt sút /
  // mỗi lần renderStatusBar / chuyển màn) — chỉ thực sự ghi localStorage 1 lần
  // sau khi đã yên ~500ms để tránh JSON.stringify + setItem hàng chục lần/trận.
  saveProgress(){
    if(this._saveTimer) clearTimeout(this._saveTimer);
    this._saveTimer = setTimeout(()=>{ this._saveTimer=null; this._writeProgress(); }, 500);
  }

  _writeProgress(){
    // MP sync qua Firestore, không dùng localStorage progress — bỏ ghi vô ích
    if(this.mpMode !== undefined) return;
    const mode=this.state._mode;
    const configId = mode==='league' ? (this.state.league&&this.state.league.id)
                    : mode==='cup' ? (this.state.cupConfig&&this.state.cupConfig.id)
                    : null;
    const key = saveKeyFor(mode, configId);
    if(!key)return; // 'nhanh' không lưu tiến trình
    try{
      const s=this.state;
      const data={
        modeId:s.modeId, playerCountry:s.playerCountry, aiCountry:s.aiCountry,
        tournamentId:s.tournament?s.tournament.id:null,
        leagueId:s.league?s.league.id:null, is2Player:s.is2Player,
        round:s.round, maxRounds:s.maxRounds, scores:s.scores, history:s.history,
        currentShooter:s.currentShooter, phase:s.phase, _pendingAiZone:s._pendingAiZone,
        leagueTeams:s.leagueTeams, leagueTable:s.leagueTable,
        leagueRounds:s.leagueRounds, leagueRoundIdx:s.leagueRoundIdx,
        cupConfigId:s.cupConfig?s.cupConfig.id:null, cupTeams:s.cupTeams, cupGroups:s.cupGroups,
        cupGroupMatchQueue:s.cupGroupMatchQueue, cupGroupMatchPtr:s.cupGroupMatchPtr,
        cupQualifiers:s.cupQualifiers, cupPhase:s.cupPhase, cupKnockoutRounds:s.cupKnockoutRounds,
        cupKnockoutMatchPtr:s.cupKnockoutMatchPtr, cupKnockoutDisplayRoundIdx:s.cupKnockoutDisplayRoundIdx,
        _mode:s._mode, _matchContext:s._matchContext, _matchLabel:s._matchLabel,
        _lastMatchResult:s._lastMatchResult, _lastMatchScore:s._lastMatchScore,
        savedAt:Date.now(),
      };
      localStorage.setItem(key, JSON.stringify(data));
    }catch(e){}
  }

  loadProgress(mode, configId){
    const key = saveKeyFor(mode, configId);
    if(!key)return null;
    try{
      const raw=localStorage.getItem(key);
      return raw?JSON.parse(raw):null;
    }catch(e){return null}
  }

  clearProgress(mode, configId){
    const key = saveKeyFor(mode, configId);
    if(!key)return;
    // Hủy timer debounce còn treo — nếu không, timer 500ms sẽ ghi LẠI tiến trình
    // cũ ngay sau khi ta vừa xóa nó (endLeague/endCup gọi saveProgress trước đó).
    if(this._saveTimer){ clearTimeout(this._saveTimer); this._saveTimer=null; }
    try{localStorage.removeItem(key)}catch(e){}
  }

  // Khi người chơi đổi đội khác với đội đang lưu trong tiến trình của Cup/League
  // đang chọn → xoá tiến trình cũ để nút Play không còn ở chế độ "Tiếp tục"
  // (nếu không, bấm Play sẽ restore về đội cũ — ví dụ luôn ra Việt Nam dù đã
  // chọn đội khác). Tiến trình mới sẽ được lưu lại khi vào giải.
  _invalidateProgressForTeamChange(){
    const mode=this.state.modeId;
    if(mode!=='cup'&&mode!=='league')return;
    const configId = mode==='league' ? this.state.league.id : this.state.tournament.id;
    const d=this.loadProgress(mode, configId);
    if(!d || d._mode!==mode)return;
    if(!d.playerCountry || !this.state.playerCountry)return;
    if(d.playerCountry.code !== this.state.playerCountry.code){
      this.clearProgress(mode, configId);
      this._updateContinueCard();
      this._updatePlayButton();
    }
  }

  restoreProgress(mode, configId){
    const d=this.loadProgress(mode, configId);
    if(!d||!d._mode)return false;
    Object.assign(this.state,{
      modeId:d.modeId, playerCountry:d.playerCountry, aiCountry:d.aiCountry,
      tournament: d.tournamentId ? (cupById(d.tournamentId)||this.state.tournament) : this.state.tournament,
      league: d.leagueId ? (leagueById(d.leagueId)||this.state.league) : this.state.league,
      is2Player:d.is2Player,
      round:d.round, maxRounds:d.maxRounds, scores:d.scores, history:d.history,
      currentShooter:d.currentShooter, phase:d.phase, _pendingAiZone:d._pendingAiZone,
      shotLocked:false,
      leagueTeams:d.leagueTeams, leagueTable:d.leagueTable,
      leagueRounds:d.leagueRounds||[], leagueRoundIdx:d.leagueRoundIdx||0,
      cupConfig: d.cupConfigId ? (cupById(d.cupConfigId)||null) : null,
      cupTeams:d.cupTeams, cupGroups:d.cupGroups, cupGroupMatchQueue:d.cupGroupMatchQueue,
      cupGroupMatchPtr:d.cupGroupMatchPtr, cupQualifiers:d.cupQualifiers, cupPhase:d.cupPhase,
      cupKnockoutRounds:d.cupKnockoutRounds, cupKnockoutMatchPtr:d.cupKnockoutMatchPtr,
      cupKnockoutDisplayRoundIdx:d.cupKnockoutDisplayRoundIdx,
      _mode:d._mode, _matchContext:d._matchContext, _matchLabel:d._matchLabel,
      _lastMatchResult:d._lastMatchResult, _lastMatchScore:d._lastMatchScore,
    });

    // Khôi phục teamType theo giải đang tiếp tục (Quốc Gia / CLB)
    const restoredRegion = (this.state.cupConfig&&this.state.cupConfig.region) || (this.state.tournament&&this.state.tournament.region) || (this.state.league&&this.state.league.region);
    this.state.teamType = restoredRegion==='clubs' ? 'club' : 'national';
    this.renderTeamType();
    this.renderTournaments();
    this.renderLeagues();

    document.querySelectorAll('.pt-mode-btn').forEach(x=>x.classList.toggle('selected',x.dataset.mode===this.state.modeId));
    if(this.state.tournament){
      document.querySelectorAll('#pt-tournament-row .pt-tournament-btn').forEach(x=>x.classList.toggle('selected',x.dataset.id===this.state.tournament.id));
      const tp=document.getElementById('pt-tournament-panel');
      if(tp)tp.style.display=this.state.modeId==='cup'?'':'none';
    }
    if(this.state.league){
      document.querySelectorAll('#pt-league-row .pt-tournament-btn').forEach(x=>x.classList.toggle('selected',x.dataset.id===this.state.league.id));
      const lp=document.getElementById('pt-league-panel');
      if(lp)lp.style.display=this.state.modeId==='league'?'':'none';
    }
    this.renderFlags();

    const inMatch = this.state._matchContext && ['shooting','defending','finished'].includes(this.state.phase);
    if(this.state._mode==='league'){
      inMatch ? this.resumeMatchScreen() : this.renderLeagueView();
    }else if(this.state._mode==='cup'){
      if(inMatch) this.resumeMatchScreen();
      else if(this.state.cupPhase==='transition') this.renderTransition();
      else if(this.state.cupPhase==='knockout') this.renderKnockoutStage();
      else this.renderGroupStage();
    }else{
      this.showMenu();
    }
    return true;
  }

  resumeMatchScreen(){
    this.showScreen('pt-game');
    const mi=document.getElementById('pt-match-info');
    mi.style.display=this.state._matchContext?'':'none';
    document.getElementById('pt-match-label').innerHTML=this.state._matchLabel||'';
    this.renderStatusBar();
    this.resetKeeperPos();
    this.resetShooterPos();
    this._resetBall();
    if(this.state.phase==='finished'){
      this._displayResultOverlay();
    }else{
      document.getElementById('pt-actions').style.display='none';
      document.getElementById('pt-match-done-btn').style.display='none';
    }
  }

  _updateContinueCard(){
    this._updateContinueCardFor('league');
    this._updateContinueCardFor('cup');
  }

  // Mỗi giải (5 League + 5 Cup = 10 tiến trình riêng) chỉ hiện thẻ "tiếp tục"
  // khi người chơi ĐANG chọn đúng mode + đúng giải đó — không hiện tràn lan ngay khi vào menu.
  _updateContinueCardFor(mode){
    const card=document.getElementById('pt-continue-card-'+mode);
    if(!card)return;
    if(this.state.modeId!==mode){card.style.display='none';return}
    const configId = mode==='league' ? this.state.league.id : this.state.tournament.id;
    const d=this.loadProgress(mode, configId);
    if(d && d._mode===mode){
      card.style.display='';
      const lgCfg = leagueById(configId);
      const cupCfg = cupById(configId);
      const modeName = mode==='league' ? `${lgCfg.icon||'📊'} ${lgCfg.name||'League'}` : `🏆 ${cupCfg.name||'Cúp'}`;
      const pc=d.playerCountry||{},ac=d.aiCountry||{},sc=d.scores||[0,0];
      const desc=document.getElementById('pt-continue-desc-'+mode);
      if(desc)desc.innerHTML=`${modeName} · ${flagImg(pc.code,pc.name,14)} ${pc.name||''} vs ${flagImg(ac.code,ac.name,14)} ${ac.name||''} · ${sc[0]}-${sc[1]}`;
    }else{
      card.style.display='none';
    }
  }

  // Đổi nhãn nút "Đá Penalty!" thành "Tiếp tục (x-y)" khi giải đang chọn có tiến trình dở dang
  _updatePlayButton(){
    const btn=document.getElementById('pt-play-btn');
    if(!btn)return;
    const mode=this.state.modeId;
    const m=MODES.find(x=>x.id===mode);
    let label=m?m.label:'Đá Penalty!';
    let hasContinue=false;
    if(mode==='league'||mode==='cup'){
      const configId = mode==='league' ? this.state.league.id : this.state.tournament.id;
      const d=this.loadProgress(mode, configId);
      if(d && d._mode===mode){
        hasContinue=true;
        const sc=d.scores||[0,0];
        const cfgName = mode==='league' ? (leagueById(configId)||{}).name : (cupById(configId)||{}).name;
        label=`▶️ Tiếp tục ${cfgName||''} (${sc[0]}-${sc[1]})`;
      }
    }
    btn.innerHTML=`<svg class="pt-play-icon" viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M8 5v14l11-7z"/></svg><span>${label}</span>`;
    btn.dataset.continue=hasContinue?'1':'';
  }


  // ===== NEW MATCH (Đá lại) =====
  newMatch(){
    this._hideResultShooters();
    document.getElementById('pt-result-overlay').style.display='none';
    // Clear any residual zone effects from previous match
    document.querySelectorAll('.pt-zone').forEach(z=>z.classList.remove('zone-shot','zone-save','zone-goal','zone-keeper-save'));
    this.state.round=0;this.state.scores=[0,0];this.state.history=[];
    this.state._dotsBaseP=0;this.state._dotsBaseA=0;
    this.state.phase='idle';this.state.shotLocked=false;this.state.maxRounds=5;
    const pc=this.state.playerCountry,ac=this.state.aiCountry||this.randomCountry(pc.code);
    this.state.aiCountry=ac;
    this.renderStatusBar();
    this.startRound();
    document.getElementById('pt-match-done-btn').style.display='none';
    document.getElementById('pt-actions').style.display='none';
  }

  quitToMenu(){
    document.getElementById('pt-result-overlay').style.display='none';
    this.showMenu();
  }
}

if(!new URLSearchParams(location.search).get('room')){
   const penaltyGame=new PenaltyGame();
   window.penaltyGame=penaltyGame;
 }