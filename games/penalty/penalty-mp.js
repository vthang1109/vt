// ===================== PENALTY SHOOTOUT — MULTIPLAYER (Đồng đội) =====================
// Kế thừa PenaltyGame (penalty.js) để tái dùng 100% engine render/animation/sprite.
// Hỗ trợ 3 chế độ: Quick (giao hữu), Cup, League.
// Cấu trúc: 2 người chơi cùng đội, 1 sút 1 bắt — vai cố định trong trận,
// luân phiên sút/bắt giữa các trận đấu.
// Tiến trình Cup/League được chủ phòng quản lý local, chỉ match state đồng bộ Firestore.
import { PenaltyGame, simAIPenalty, orientMatchScore, sfx, toggle as soundToggle, REWARD_BOOST } from './penalty.js';
import { auth, db, addPoints } from '../../points.js';
import {
  doc, getDoc, updateDoc, deleteDoc, onSnapshot, arrayRemove
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import {
  getAllCountries, countryByCode, getFlagColors, _getSplitShooterLayers,
  HAIR_HOME_HEX, HAIR_AWAY_HEX, getTopCountries, shuffle, flagImg, abbr3,
  CUP_TOURNAMENTS, LEAGUE_LIST, buildRoundRobin, prewarmKeeperKit,
  getRegionCountries, clubByCode, getAllClubs, getCupsByType, getLeaguesByType,
  cupById, leagueById, clubCountry, CLUB_MAP
} from './penalty-countries.js';
import { initRoomChat, getMyNickname, showRoomDeletedPopup } from '../../room-chat.js';

const ROOM_ID = new URLSearchParams(location.search).get('room');

class PenaltyMP extends PenaltyGame {

  _init(){
    if(!ROOM_ID){
      document.body.innerHTML='<div style="color:#fff;padding:60px;text-align:center">⚠️ Thiếu mã phòng.</div>';
      return;
    }
    this._lastSeq = undefined;
    this._lastPhaseShown = null;
    this._finishedHandled = false;
    this._mpLeagueRewarded = false; // chong cong diem 2 lan khi giai ket thuc (ca 2 nguoi deu nhan)
    this._mpCupRewarded = false;
    this.mpMatchCount = 0; // dem so tran da bat dau — luan phien vai sut/bat moi tran
    // MP-specific state (local, not in Firestore)
    this.mpMode = 'quick';
    this.mpTeamType = 'national'; // 'national' | 'club' — tab Quốc Gia / CLB
    this.mpCupConfig = null;
    this.mpLeagueConfig = null;
    this.mpLeagueTeams = [];
    this.mpLeagueTable = {};
    this.mpLeagueRounds = [];
    this.mpLeagueRoundIdx = 0;
    this.mpCupTeams = [];
    this.mpCupGroups = [];
    this.mpCupGroupMatchQueue = [];
    this.mpCupGroupMatchPtr = 0;
    this.mpCupQualifiers = [];
    this.mpCupPhase = null;
    this.mpCupKnockoutRounds = [];
    this.mpCupKnockoutMatchPtr = 0;
    this.mpCupKnockoutDisplayRoundIdx = 0;
    this._mpCupEnded = false;
    this.mpMatchContext = null;

    onAuthStateChanged(auth, async (u)=>{
      if(!u){ location.href='../../index.html'; return; }
      this.uid = u.uid;
      this.roomId = ROOM_ID;
      if(window.TopNav && window.TopNav.setLeaveAction){
        window.TopNav.setLeaveAction(async ()=>{ window.__navigated=true; await this.quitRoom(); });
      }
      this._bindMPEvents();
      this._watchRoom();
      const myName = await getMyNickname(db, this.uid, u.email);
      initRoomChat({ db, roomId: this.roomId, uid: this.uid, getName: ()=>myName });
    });
    window.addEventListener('pagehide', ()=>{ if(!window.__navigated) this.quitRoom().catch(()=>{}); });
  }

  _bindMPEvents(){
    document.getElementById('pt-goal-grid').addEventListener('click', e=>{
      const z=e.target.closest('.pt-zone'); if(!z) return;
      if(this.state.shotLocked) return;
      if(this.myRole==='shooter' && this.state.phase==='shooting'){
        this._doPlayerShoot(z.dataset.zone);
      } else if(this.myRole==='keeper' && this.state.phase==='defending'){
        this._doPlayerDefend(z.dataset.zone);
      }
    });

    document.getElementById('pt-flag-grid').addEventListener('click', e=>{
      const b=e.target.closest('.pt-flag-btn'); if(!b) return;
      document.querySelectorAll('.pt-flag-btn').forEach(x=>x.classList.remove('selected'));
      b.classList.add('selected');
      const found=countryByCode(b.dataset.code)||clubByCode(b.dataset.code);
      if(found){
        this.state.playerCountry=found;
        this._updateCountryPicker();
        this.closeCountryPopup();
      }
    });
    document.getElementById('pt-country-search').addEventListener('input', e=>this.renderFlags(e.target.value));
    document.getElementById('pt-country-modal-close').addEventListener('click', ()=>this.closeCountryPopup());
    document.getElementById('pt-country-modal').addEventListener('click', e=>{
      if(e.target===e.currentTarget) this.closeCountryPopup();
    });

    // Chế độ hiệu suất thấp — kế thừa _toggleLowPerf/_renderLowPerfToggle từ cha
    const lpBtn=document.getElementById('pt-lowperf-btn');
    if(lpBtn) lpBtn.addEventListener('click',()=>this._toggleLowPerf());
    this._renderLowPerfToggle();

    // Âm thanh bật/tắt — kế thừa _renderSoundToggle từ cha
    const sndBtn=document.getElementById('pt-sound-btn');
    if(sndBtn) sndBtn.addEventListener('click',()=>{ soundToggle(); sfx.click(); this._renderSoundToggle(); });
    this._renderSoundToggle();

    // Hiệu ứng cú sút — mỗi người chọn riêng từ modal (kế thừa PenaltyGame).
    // Client đang sút ghi shotEffect lên gameState → cả 2 bên animate cùng hiệu ứng.
    const effPanel=document.getElementById('pt-effect-panel');
    if(effPanel) effPanel.addEventListener('click',()=>this.openEffectModal());
    const effGrid=document.getElementById('pt-effect-modal-grid');
    if(effGrid) effGrid.addEventListener('click',e=>{
      const btn=e.target.closest('.pt-effect-modal-btn');
      if(btn) return this._handleEffectModalClick(btn.dataset.effectId);
      const sug=e.target.closest('.pt-effect-suggestion span');
      if(sug && sug.dataset.effectId) return this._handleEffectModalClick(sug.dataset.effectId);
      const cb=e.target.closest('.pt-select-all-cb');
      if(cb) return this._handleSelectAll(cb.checked);
    });
    const effApply=document.getElementById('pt-effect-apply-btn');
    if(effApply) effApply.addEventListener('click',()=>this._applyEffectSelection());
    const effClose=document.getElementById('pt-effect-modal-close');
    if(effClose) effClose.addEventListener('click',()=>this.closeEffectModal());
    const effCancel=document.getElementById('pt-effect-modal-cancel');
    if(effCancel) effCancel.addEventListener('click',()=>this.closeEffectModal());
    const effModal=document.getElementById('pt-effect-modal');
    if(effModal) effModal.addEventListener('click',e=>{
      if(e.target===e.currentTarget) this.closeEffectModal();
    });
    // Confirm mua hiệu ứng
    const bcBtn=document.getElementById('pt-buy-confirm-btn');
    if(bcBtn) bcBtn.addEventListener('click',()=>this._confirmBuy());
    const bcCancel=document.getElementById('pt-buy-confirm-cancel');
    if(bcCancel) bcCancel.addEventListener('click',()=>this._cancelBuy());
    const bcClose=document.getElementById('pt-buy-confirm-close');
    if(bcClose) bcClose.addEventListener('click',()=>this._cancelBuy());
    const bcModal=document.getElementById('pt-buy-confirm-modal');
    if(bcModal) bcModal.addEventListener('click',e=>{
      if(e.target===e.currentTarget) this._cancelBuy();
    });
    this.renderEffectsPanel();

    document.getElementById('pt-mp-mode-row').addEventListener('click', e=>{
      const b=e.target.closest('.pt-mp-mode-btn'); if(!b) return;
      if(!this.isHost) return;
      document.querySelectorAll('.pt-mp-mode-btn').forEach(x=>x.classList.remove('selected'));
      b.classList.add('selected');
      this.mpMode = b.dataset.mode;
      document.getElementById('pt-mp-cup-pick').style.display = this.mpMode==='cup' ? '' : 'none';
      document.getElementById('pt-mp-league-pick').style.display = this.mpMode==='league' ? '' : 'none';
      // Loc lai danh sach quoc gia theo khu vuc cua Cup/League moi chon
      this.renderFlags();
    });

    // Team type (Quốc Gia / CLB)
    const ttRow=document.getElementById('pt-teamtype-row');
    if(ttRow) ttRow.addEventListener('click', e=>{
      const b=e.target.closest('.pt-teamtype-tab'); if(!b) return;
      this.setTeamType(b.dataset.teamtype);
    });

    document.getElementById('pt-mp-cup-pick').addEventListener('click', e=>{
      const b=e.target.closest('.pt-mp-pick-btn'); if(!b) return;
      if(!this.isHost) return;
      document.querySelectorAll('#pt-mp-cup-pick .pt-mp-pick-btn').forEach(x=>x.classList.remove('selected'));
      b.classList.add('selected');
      this.mpCupConfig = cupById(b.dataset.id) || getCupsByType(this.mpTeamType||'national')[0];
      // Cap nhat danh sach quoc gia theo khu vuc cua cup moi chon
      this.renderFlags();
    });

    document.getElementById('pt-mp-league-pick').addEventListener('click', e=>{
      const b=e.target.closest('.pt-mp-pick-btn'); if(!b) return;
      if(!this.isHost) return;
      document.querySelectorAll('#pt-mp-league-pick .pt-mp-pick-btn').forEach(x=>x.classList.remove('selected'));
      b.classList.add('selected');
      this.mpLeagueConfig = leagueById(b.dataset.id) || getLeaguesByType(this.mpTeamType||'national')[0];
      // Cap nhat danh sach quoc gia theo khu vuc cua league moi chon
      this.renderFlags();
    });

    document.getElementById('pt-mp-start-btn').addEventListener('click', ()=>this._hostStartMatch());
    document.getElementById('pt-mp-match-done-btn').addEventListener('click', ()=>this._onMPMatchDone());
    document.getElementById('pt-league-next').addEventListener('click', ()=>this._mpPlayLeagueMatch());
    document.getElementById('pt-group-next').addEventListener('click', ()=>this._mpPlayGroupMatch());
    document.getElementById('pt-transition-next').addEventListener('click', ()=>this._mpAdvanceToKnockout());
    document.getElementById('pt-knockout-next').addEventListener('click', ()=>this._mpPlayKnockoutMatch());

    // Lịch sử thành tích (kế thừa modal từ PenaltyGame)
    const hb=document.getElementById('pt-history-btn');
    if(hb) hb.addEventListener('click', ()=>this.openHistoryModal());
    const hc=document.getElementById('pt-history-modal-close');
    if(hc) hc.addEventListener('click', ()=>this.closeHistoryModal());
    const hClose=document.getElementById('pt-history-close');
    if(hClose) hClose.addEventListener('click', ()=>this.closeHistoryModal());
    const hcl=document.getElementById('pt-history-clear');
    if(hcl) hcl.addEventListener('click', (e)=>{e.stopPropagation();this.clearHistory();});
    const hm=document.getElementById('pt-history-modal');
    if(hm) hm.addEventListener('click', e=>{if(e.target===e.currentTarget)this.closeHistoryModal();});
  }

  // ===== FIRESTORE =====
  _watchRoom(){
    onSnapshot(doc(db,'rooms',this.roomId), (snap)=>{
      if(!snap.exists()){ showRoomDeletedPopup(); return; }
      const r=snap.data();
      const stillIn=(r.members||[]).includes(this.uid);
      if(!stillIn){
        window.__navigated=true; // da roi roi — khong de pagehide goi quitRoom lai
        if(window.openInfoModal) window.openInfoModal('🚫 Bạn đã bị kick','Chủ phòng đã đưa bạn ra khỏi phòng.', ()=>location.href='../../app/rooms.html');
        else location.href='../../app/rooms.html';
        return;
      }
      this.room=r;
      // Hien ma phong tren thanh nav (giong cac game MP khac)
      if(window.TopNav && window.TopNav.setRoomId && r.code) window.TopNav.setRoomId(r.code, '<img src="../../assets/icons/wc.png" style="height:14px;width:14px;vertical-align:middle;border-radius:2px">');
      if(r.gameType!=='penalty' || !r.gameState) return;
      this._onGameState(r);
    }, (err)=>console.error('penalty-mp snapshot error', err));
  }

  _onGameState(r){
    const gs=r.gameState;
    this._gs=gs;
    this.isHost = r.hostUid===this.uid;
    const members = r.members||[];
    this.teammateUid = members.find(m=>m!==this.uid) || null;
    this.myRole = gs.shooterUid===this.uid ? 'shooter' : (gs.keeperUid===this.uid ? 'keeper' : 'spectator');
    // gameState ban dau (khi tao phong) KHONG co truong mpMode — neu gan
    // 'quick' moi snapshot se xoa mat lua chon Cup/League cua host.
    // Chi cap nhat khi gameState thuc su ghi ro mpMode.
    if(gs.mpMode) this.mpMode = gs.mpMode;

    // LUU Y: phai copy mang, khong duoc gan chung tham chieu voi gs.scores.
    // animateShot/animateAIShot cua lop cha tang this.state.scores[0]++ o cho
    // bong roi xuong dat — neu gan tham chieu, no se lam hong gs.scores cua
    // snapshot, khi _finalizeShotPhase doc gs.scores lai cong +1 lan nua
    // => moi ban thang bi tinh x2.
    this.state.scores = gs.scores ? [...gs.scores] : [0,0];
    this.state.history = gs.history ? [...gs.history] : [];
    this.state.round = gs.round || 0;
    this.state.maxRounds = gs.maxRounds || 5;
    // Luân lưu tử thần (knock-out hòa 5-5): cột chấm được đặt lại từ lượt số 6
    // — đồng bộ từ gameState để cả 2 client hiển thị giống nhau.
    // Thông báo 1 lần cho CẢ 2 client khi bước vào luân lưu tử thần (hòa 5-5 knock-out)
    if((gs.dotsBaseP||0) > 0 && this._lastDotsBaseP === 0 && this.state.phase!=='finished'){
      window.showToast?.('⚽ Hòa 5-5! Vào loạt luân lưu tử thần — ai thắng lượt này đi tiếp!','info');
    }
    this._lastDotsBaseP = gs.dotsBaseP || 0;
    this.state._dotsBaseP = gs.dotsBaseP || 0;
    this.state._dotsBaseA = gs.dotsBaseA || 0;
    this.state._mode = this.mpMode;
    // Chỉ đồng bộ đội từ gameState khi ĐANG TRONG TRẬN THỰC SỰ (phase
    // shooting/anim-shot/defending/anim-defend/finished). Ở màn hình setup lẫn
    // màn hình giải đấu (tournament), gameState vẫn giữ playerCountry CŨ từ
    // trận trước (VD 'vn') — nếu ghi đè ở đây, host vừa chọn đội khác (VD
    // Brazil) sẽ bị reset về đội cũ ngay khi snapshot mới đến (guest join /
    // chat / presence / màn hình giải) → vào trận vẫn là Việt Nam.
    const _ptMatchPhase = ['shooting','anim-shot','defending','anim-defend','finished'].includes(gs.phase);
    if(_ptMatchPhase){
      if(gs.playerCountry) this.state.playerCountry = countryByCode(gs.playerCountry) || clubByCode(gs.playerCountry) || getAllCountries()[0];
      if(gs.aiCountry) this.state.aiCountry = countryByCode(gs.aiCountry) || clubByCode(gs.aiCountry) || this.randomCountry(gs.playerCountry);
    }
    if(gs.mpMatchContext) this.mpMatchContext = gs.mpMatchContext;
    // Luan phien vai sut/bat moi tran — khoi phuc bo dem tu gameState de sau
    // khi host reload giua tran van tiep tuc dung thu tu (khong lap lai nguoi sut).
    if(typeof gs.mpMatchCount === 'number') this.mpMatchCount = gs.mpMatchCount;

    // Phat hien TRAN MOI (Cup/League): host bat dau tran ke tiep lam seq
    // reset ve 1 (nho hon seq cua tran vua choi). Khi do phai reset
    // _lastPhaseShown de _onGameState hien lai man hinh game cho 2 nguoi
    // choi — neu khong, ca host lan guest se ke't man hinh bang xep hang.
    if(this._lastSeq !== undefined && gs.seq !== undefined && gs.seq < this._lastSeq){
      this._lastPhaseShown = null;
    }

    if(gs.phase==='setup'){
      this._lastPhaseShown=null;
      this._showSetupScreen();
      return;
    }

    // MAN HINH GIAI DAU (Cup/League): ca 2 nguoi choi deu render bang dau /
    // bang xep hang tu snapshot dong bo tren Firestore (gameState.mpTournament).
    if(gs.phase==='tournament'){
      this._lastPhaseShown='tournament';
      if(gs.mpTournament) this._mpHydrateTournament(gs.mpTournament);
      this._showMPTournamentView(gs.mpTournamentView);
      return;
    }

    if(this._lastPhaseShown!=='game'){
      this.showScreen('pt-game');
      document.getElementById('pt-match-info').style.display='';
      let label = gs.matchLabel || '🏟️ Giao hữu (2 người)';
      document.getElementById('pt-match-label').innerHTML = label;
      this._populateStandFlags([this.state.playerCountry, this.state.aiCountry]);
      this._prefetchKits();
      this._lastPhaseShown='game';
    }

    this._handleRoundState(gs);
  }

  _prefetchKits(){
    [this.state.playerCountry, this.state.aiCountry].forEach(team=>{
      if(!team) return;
      // Tóc cố định 2 màu (nhà trắng / khách đen) — pre-warm cả 2 cho cache nóng
      // trước lượt sút đầu, không còn phụ thuộc random.
      getFlagColors(team.code).then(kit=>{
        if(!kit) return;
        ['mid-stand','kick','celebrate','disappoint'].forEach(pose=>{
          [HAIR_HOME_HEX, HAIR_AWAY_HEX].forEach(hairHex=>{
            _getSplitShooterLayers(pose, kit.primary, kit.secondary, hairHex, kit.socks).catch(()=>{});
          });
        });
      });
      // Pre-warm áo thủ môn WebP cho cả 2 đội — tránh _gkColorizeWhite chạy
      // đồng bộ đúng lúc cú sút đang bay (nguyên nhân giật mỗi lượt sút).
      prewarmKeeperKit().catch(()=>{});
    });
  }

  // Màu tóc CỐ ĐỊNH theo đội — giống hệt SP nên 2 client luôn khớp không cần
  // băm seq nữa: seed 0 = đội nhà (TRẮNG), seed 1 = đối thủ (ĐEN).
  _pickShooterHair(seed = 0){
    return seed ? HAIR_AWAY_HEX : HAIR_HOME_HEX;
  }

  // ===== SETUP SCREEN =====
  _showSetupScreen(){
    this.showScreen('pt-menu');
    document.getElementById('pt-match-info').style.display='none';
    this.renderEffectsPanel(); // cập nhật thanh hiệu ứng cú sút khi vào màn hình chờ
    const hostBox=document.getElementById('pt-mp-setup-host');
    const guestBox=document.getElementById('pt-mp-setup-guest');
    if(this.isHost){
      hostBox.style.display='';
      guestBox.style.display='none';
      if(!this.state.playerCountry) this.state.playerCountry = this.mpTeamType==='club' ? (getAllClubs()[0]||getAllCountries()[0]) : (getAllCountries().find(c=>c.code==='vn')||getAllCountries()[0]);
      this._updateCountryPicker();
      this.renderTeamType();
      this._renderMPModes();
      // Tu chua tren man hinh setup: neu dang chon nham doi ngoai khu vuc cua
      // Cup/League thi renderFlags (override) tu dong chuyen ve doi hop le.
      this.renderFlags();
    }else{
      hostBox.style.display='none';
      guestBox.style.display='';
    }
  }

  _renderMPModes(){
    // GIU NGUYEN lua chon cua host (khong reset ve 'quick' moi snapshot setup —
    // neu reset, moi lan co snapshot moi (guest join, chat, presence) host se
    // mat chon Cup/League va chi choi duoc Giao huu).
    const cups = getCupsByType(this.mpTeamType||'national');
    const cupEl = document.getElementById('pt-mp-cup-pick');
    cupEl.innerHTML = cups.map((t,i) =>
      `<button class="pt-mp-pick-btn ${this.mpCupConfig&&t.id===this.mpCupConfig.id?'selected':(i===0&&!this.mpCupConfig?'selected':'')}" data-id="${t.id}">${t.icon} ${t.name}</button>`
    ).join('');
    if(!this.mpCupConfig || !cups.find(c=>c.id===this.mpCupConfig.id)) this.mpCupConfig = cups[0]||CUP_TOURNAMENTS[0];

    const lgs = getLeaguesByType(this.mpTeamType||'national');
    const lgEl = document.getElementById('pt-mp-league-pick');
    lgEl.innerHTML = lgs.map((l,i) =>
      `<button class="pt-mp-pick-btn ${this.mpLeagueConfig&&l.id===this.mpLeagueConfig.id?'selected':(i===0&&!this.mpLeagueConfig?'selected':'')}" data-id="${l.id}">${l.icon} ${l.name}</button>`
    ).join('');
    if(!this.mpLeagueConfig || !lgs.find(l=>l.id===this.mpLeagueConfig.id)) this.mpLeagueConfig = lgs[0]||LEAGUE_LIST[0];

    if(this.mpMode!=='cup' && this.mpMode!=='league') this.mpMode = 'quick';
    document.querySelectorAll('.pt-mp-mode-btn').forEach(b=>b.classList.toggle('selected', b.dataset.mode===this.mpMode));
    cupEl.style.display = this.mpMode==='cup' ? '' : 'none';
    document.getElementById('pt-mp-league-pick').style.display = this.mpMode==='league' ? '' : 'none';
  }

  // ===== FLAG PICKER (override) =====
  // Parent renderFlags loc theo state.modeId + state.tournament/state.league,
  // nhung MP luu che do/config o mpMode/mpCupConfig/mpLeagueConfig va khong
  // bao gio dong bo sang state → mac dinh parent hien thi MOI quoc gia, cho
  // phep chon doi khong thuoc khu vuc cua Cup/League. Override de dong bo
  // che do MP sang state truoc khi delegate cho parent (parent tu dong chuyen
  // ve quoc gia hop le cua khu vuc neu dang chon nham).
  renderFlags(query){
    this.state.teamType = this.mpTeamType || 'national';
    this.state.modeId = this.mpMode==='cup' ? 'cup' : (this.mpMode==='league' ? 'league' : 'nhanh');
    if(this.mpMode==='cup') this.state.tournament = this.mpCupConfig || getCupsByType(this.mpTeamType||'national')[0];
    if(this.mpMode==='league') this.state.league = this.mpLeagueConfig || getLeaguesByType(this.mpTeamType||'national')[0];
    super.renderFlags(query);
  }

  renderTeamType(){
    const c=document.getElementById('pt-teamtype-row');
    if(!c)return;
    const t=this.mpTeamType||'national';
    c.innerHTML=[
      {id:'national',icon:'🌍',name:'Quốc Gia'},
      {id:'club',icon:'⚽',name:'CLB'},
    ].map(x=>`<button class="pt-teamtype-tab ${x.id===t?'selected':''}" data-teamtype="${x.id}">${x.icon} ${x.name}</button>`).join('');
  }

  setTeamType(type){
    if(!type || type===this.mpTeamType) return;
    this.mpTeamType = type;
    this.renderTeamType();
    this._renderMPModes();
    this.renderFlags();
  }

  // ===== HOST START =====
  async _hostStartMatch(){
    if(!this.isHost || !this.room) return;
    const members=this.room.members||[];
    if(members.length<2){ window.showToast?.('Cần đủ 2 người trong đội!','warn'); return; }
    const pc=this.state.playerCountry || getAllCountries()[0];
    const ac=this.randomCountry(pc.code);

    if(this.mpMode === 'quick'){
      await this._hostStartQuickMatch(members, pc, ac);
    } else if(this.mpMode === 'league'){
      await this._hostStartLeague(members, pc, ac);
    } else if(this.mpMode === 'cup'){
      await this._hostStartCup(members, pc, ac);
    }
  }

  async _hostStartQuickMatch(members, pc, ac){
    this.mpMatchContext = { type:'quick' };
    const m = members.slice(0,2);
    // Vai co dinh trong tran; moi tran moi luan phien nguoi sut / nguoi bat
    const swap = (this.mpMatchCount % 2) === 1;
    this.mpMatchCount++;
    const shooterUid = swap ? m[1] : m[0];
    const keeperUid = swap ? m[0] : m[1];
    await updateDoc(doc(db,'rooms',this.roomId), {
      gameState: {
        mpMode:'quick',
        phase:'shooting', seq:1, players: m,
        shooterUid, keeperUid, mpMatchCount: this.mpMatchCount,
        round:1, maxRounds:5, scores:[0,0], history:[],
        playerCountry: pc.code, aiCountry: ac.code,
        playerZone:null, keeperAiZone:null, pendingAiZone:null, keeperZone:null,
        matchLabel: '🏟️ Giao hữu (2 người)',
        mpMatchContext: { type:'quick' }
      }
    });
  }

  // ===== LEAGUE (MP) =====
  async _hostStartLeague(members, pc, ac){
    this.mpMatchCount = 0; // giai moi — bat dau vai sut cho thanh vien dau
    this._mpLeagueRewarded = false; // giai moi — reset co cong diem
    const config = this.mpLeagueConfig || LEAGUE_LIST[0];
    const pool = config.clubs ? config.clubs.map(code=>CLUB_MAP[code]).filter(Boolean) : (config.region ? getRegionCountries(config.region) : getAllCountries());
    // Dam bao doi minh thuoc khu vuc cua giai — neu chon nham (vi du Brazil
    // cho giai EU) thi tu dong doi sang doi hop le trong khu vuc.
    if(!pool.find(c=>c.code===pc.code)){
      pc = pool.find(c=>c.code==='vn') || pool[0] || getAllCountries()[0];
      this.state.playerCountry = pc;
      this._updateCountryPicker();
      window.showToast?.(`⚠️ Đội không tham gia ${config.name} — đã chọn ${pc.name}`, 'warn');
    }
    const n = config.teamCount || 8;
    const top = getTopCountries(pool, n-1, pc.code);
    const teams = [pc, ...shuffle(top)];
    this.mpLeagueTeams = teams;
    this.mpLeagueRounds = buildRoundRobin(teams.length);
    this.mpLeagueRoundIdx = 0;
    this.mpLeagueTable = {};
    teams.forEach((t,i)=>{
      this.mpLeagueTable[i] = {name:t.name, flag:t.flag, code:t.code, p:0,w:0,d:0,l:0,gf:0,ga:0,gd:0,pts:0};
    });
    this.mpMatchContext = null;
    this.mpLeagueRoundIdx = 0;
    // KHONG mo phong AI truoc — giai cung tien hanh dong bo theo VONG: sau khi
    // doi choi da xong tran cua minh o vong nao thi cac tran AI con lai trong
    // vong do moi duoc mo phong (xem _onMPMatchDone). Tranh tinh trang cac doi
    // khac da da het ca mua trong khi doi choi moi vao.
    await this._mpWriteTournamentView('league');
  }

  _mpUpdateLeagueTable(teamIdx, scored, conceded){
    const row = this.mpLeagueTable[teamIdx];
    if(!row) return;
    row.p++; row.gf+=scored; row.ga+=conceded; row.gd=row.gf-row.ga;
    if(scored>conceded){ row.w++; row.pts+=3; }
    else if(scored===conceded){ row.d++; row.pts+=1; }
    else row.l++;
  }

  async _mpStartLeagueMatch(members, pc){
    const rounds = this.mpLeagueRounds;
    let rIdx = this.mpLeagueRoundIdx;
    if(rIdx >= rounds.length){ const endedOk = await this._mpEndLeague(); if(endedOk) await this._mpWriteTournamentView('league'); return; }
    const round = rounds[rIdx];
    const pMatchIdx = round.findIndex(f => f.result===null && (f.home===0 || f.away===0));
    if(pMatchIdx === -1){
      this._mpResolveRoundRest(rIdx, -1);
      this.mpLeagueRoundIdx = rIdx+1;
      // Dong bo len Firestore de guest cung thay bang xep hang cap nhat
      await this._mpWriteTournamentView('league');
      this._mpRenderLeagueView();
      return;
    }
    const f = round[pMatchIdx];
    const home = this.mpLeagueTeams[f.home], away = this.mpLeagueTeams[f.away];
    const opp = f.home===0 ? away : home;
    const label = `${this.mpLeagueConfig.icon} ${this.mpLeagueConfig.name} · Vòng ${rIdx+1}`;
    this.mpMatchContext = { type:'league', roundIdx:rIdx, matchIdx:pMatchIdx };
    await this._hostStartMPMatch(members, pc, opp, label, this.mpMatchContext);
  }

  _mpResolveRoundRest(rIdx, excludeIdx){
    const round = this.mpLeagueRounds[rIdx];
    if(!round) return;
    round.forEach((f,i)=>{
      if(i===excludeIdx || f.result!==null) return;
      const [h,a] = simAIPenalty();
      f.result = [h,a];
      this._mpUpdateLeagueTable(f.home, h, a);
      this._mpUpdateLeagueTable(f.away, a, h);
    });
  }

  async _mpEndLeague(){
    const config = this.mpLeagueConfig;
    const table = this.mpLeagueTable || {};
    const entries = Object.entries(table).sort((a,b)=>b[1].pts-a[1].pts||(b[1].gd-a[1].gd));
    if(entries.length === 0){
      // State league bi mat (host reload) — reset ve setup thay vi crash
      this.mpMatchContext = null;
      await updateDoc(doc(db,'rooms',this.roomId), { 'gameState.phase':'setup' });
      this.showMenu();
      return false;
    }
    const winner = parseInt(entries[0][0]);
    const isWin = winner === 0;
    const rank = entries.findIndex(e=>parseInt(e[0])===0)+1;
    this._mpRenderLeagueView(); // header vô địch được render khi allDone
    window.showToast?.(`🏆 ${config.name} kết thúc! ${isWin ? 'Vô địch!' : 'Hạng '+rank}`);
    // NOT: addPoints() — điểm được cộng ở _mpRenderLeagueView (cả 2 người đều nhận)
    return true;
  }

  _mpRenderLeagueView(){
    const config = this.mpLeagueConfig || LEAGUE_LIST[0];
    const table = this.mpLeagueTable || {};
    const teams = this.mpLeagueTeams || [];
    const rounds = this.mpLeagueRounds || [];
    if(teams.length === 0 || rounds.length === 0){ this._mpResetTournament(); return; }
    const totalMatches = rounds.reduce((s,r)=>s+r.length,0);
    const played = rounds.reduce((s,r)=>s+r.filter(f=>f.result!==null).length,0);
    const roundIdx = this.mpLeagueRoundIdx;

    document.getElementById('pt-overview-header').innerHTML=`
      <span class="pt-ov-icon">${config.icon}</span>
      <span class="pt-ov-title">${config.name} · ${teams.length} đội</span>
      <span class="pt-ov-sub">Vòng ${Math.min(roundIdx+1,rounds.length)}/${rounds.length} · Trận ${played}/${totalMatches}</span>
    `;

    const entries=Object.entries(table).sort((a,b)=>b[1].pts-a[1].pts||(b[1].gd-a[1].gd));
    let html=`<table class="pt-lt"><thead><tr><th>#</th><th>Đội</th><th>TR</th><th>THB</th><th>BT</th><th>HS</th><th>Đ</th></tr></thead><tbody>`;
    entries.forEach(([idx,row],i)=>{
      const t=teams[parseInt(idx)];
      if(!t) return;
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

    const allDone = roundIdx >= rounds.length;
    document.getElementById('pt-league-next').style.display = allDone ? 'none' : '';
    if(allDone){
      // Hiển thị header vô địch cho cả host lẫn guest
      const ended = Object.entries(table).sort((a,b)=>b[1].pts-a[1].pts||(b[1].gd-a[1].gd));
      const winnerIdx = ended[0] ? parseInt(ended[0][0]) : -1;
      const isWin = winnerIdx === 0;
      const rank = ended.findIndex(e=>parseInt(e[0])===0)+1;
      document.getElementById('pt-overview-header').innerHTML =
        `<span class="pt-ov-icon">🏆</span><span class="pt-ov-title">${config.name} · ${isWin?'Vô địch!':'Hạng '+rank}</span>`;
      // Thưởng CẢ 2 người khi giải kết thúc — mỗi client cộng điểm cho tài khoản của mình
      if(!this._mpLeagueRewarded){
        this._mpLeagueRewarded = true;
        const pts = (isWin ? (config.pointsWin||200) : (config.pointsLose||50)) * REWARD_BOOST;
        addPoints('Vt Football '+config.name, isWin?'Vô địch '+config.name:'Hết '+config.name, pts).catch(()=>{});
        // Ghi lịch sử thành tích — giải kết thúc
        this._recordHistory({
          ts: Date.now(),
          kind: 'tournament',
          mode: 'league',
          mp: true,
          result: isWin ? 'champion' : 'rank',
          rank: rank,
          player: { code: this.state.playerCountry.code, name: this.state.playerCountry.name },
          label: config.name
        });
      }
    }
    this._setTournamentBackVisible(allDone);
    this.showScreen('pt-league-view');
  }

  async _mpPlayLeagueMatch(){
    if(!this.isHost) return;
    const members = this.room.members||[];
    const pc = this.state.playerCountry;
    await this._mpStartLeagueMatch(members, pc);
  }

  // ===== CUP (MP) =====
  async _hostStartCup(members, pc, ac){
    this.mpMatchCount = 0; // giai moi — bat dau vai sut cho thanh vien dau
    this._mpCupRewarded = false; // giai moi — reset co cong diem
    const config = this.mpCupConfig || CUP_TOURNAMENTS[0];
    let basePool = config.region ? getRegionCountries(config.region) : getAllCountries();
    if(config.country) basePool = basePool.filter(c=>clubCountry(c.code)===config.country);
    if(config.rankMin!=null||config.rankMax!=null) basePool = basePool.filter(c=>(config.rankMin==null||c.rank>=config.rankMin)&&(config.rankMax==null||c.rank<=config.rankMax));
    // Dam bao doi minh thuoc khu vuc cua giai — neu chon nham thi tu dong doi
    // sang doi hop le trong khu vuc (khong cho doi ngoai khu vuc tham gia cup).
    if(!basePool.find(c=>c.code===pc.code)){
      pc = basePool.find(c=>c.code==='vn') || basePool[0] || getAllCountries()[0];
      this.state.playerCountry = pc;
      this._updateCountryPicker();
      window.showToast?.(`⚠️ Đội không tham gia ${config.name} — đã chọn ${pc.name}`, 'warn');
    }
    // Pool xếp theo rank (bỏ shuffle) để chia hạt giống bên dưới
    const pool = getTopCountries(basePool, config.teamCount - 1, pc.code)
      .sort((a,b)=>(a.rank!=null?a.rank:999)-(b.rank!=null?b.rank:999));
    const numGroups = config.groups;
    const totalTeams = config.teamCount;
    const teamsPerGroup = Math.ceil(totalTeams / numGroups);
    const teams = [pc];
    for(let i=0; i<totalTeams-1; i++){
      if(i < pool.length) teams.push(pool[i]);
      else {
        const fillerNames = ['Đội bóng tự do','FC All Stars','Đội Sao','United FC','Rising Stars','Phoenix FC','Spartak','Dynamo','Galácticos','Invincibles','Thunder FC','Eagles FC','Tigers FC','Lions FC','Warriors FC','Dragons FC'];
        teams.push({code:`gen_${i}`, name: fillerNames[i % fillerNames.length], flag: '🏳️'});
      }
    }
    this.mpCupTeams = teams;
    this.mpCupPhase = 'group';
    // Xếp hạt giống (pot seeding) — mỗi bảng nhận 1 đội từ mỗi pot theo rank
    const seeded = teams.map((t,i)=>({i, rank:(t&&t.rank!=null)?t.rank:999})).sort((a,b)=>a.rank-b.rank);
    const groupAlloc = Array.from({length:numGroups},()=>[]);
    const numPots = Math.ceil(seeded.length/numGroups);
    for(let p=0;p<numPots;p++){
      // Xáo nhẹ TRONG pot: vẫn đảm bảo mỗi bảng 1 đội mạnh từ mỗi pot (hạt giống),
      // nhưng cặp đấu cụ thể thay đổi mỗi lần chơi (không lặp y hệt từng trận).
      const pot=shuffle(seeded.slice(p*numGroups,(p+1)*numGroups));
      pot.forEach((e,j)=>{ if(groupAlloc[(j+p)%numGroups].length<teamsPerGroup) groupAlloc[(j+p)%numGroups].push(e.i); });
    }
    seeded.forEach(e=>{
      if(!groupAlloc.some(g=>g.includes(e.i))){
        const g=groupAlloc.findIndex(x=>x.length<teamsPerGroup);
        if(g>=0) groupAlloc[g].push(e.i);
      }
    });
    const groups = [];
    const groupNames = 'ABCDEFGH'.split('');
    for(let g=0; g<numGroups; g++){
      const groupTeams = groupAlloc[g];
      const roundFixtures = this._generateRoundRobinRounds(groupTeams);
      const matches = [];
      const rounds = [];
      roundFixtures.forEach((round, rIdx)=>{
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
    this.mpCupGroups = groups;
    const allMatches = [];
    for(let g=0; g<groups.length; g++){
      for(let m=0; m<groups[g].matches.length; m++){ allMatches.push({ groupIdx: g, matchIdx: m }); }
    }
    const pg = groups.findIndex(g => g.teams.includes(0));
    const playerM = allMatches.filter(m => m.groupIdx === pg);
    const aiM = allMatches.filter(m => m.groupIdx !== pg);
    this.mpCupGroupMatchQueue = [...playerM, ...aiM];
    this.mpCupGroupMatchPtr = 0;
    this.mpCupQualifiers = [];
    this.mpCupKnockoutRounds = [];
    this.mpCupKnockoutMatchPtr = 0;
    this.mpCupKnockoutDisplayRoundIdx = 0;
    this._mpCupEnded = false; // reset khi bat dau cup moi
    this.mpCupGroupMatchPtr = 0;
    this.mpCupPhase = 'group';
    // KHONG mo phong AI truoc — cac bang se tien hanh dong bo theo VONG:
    // sau khi doi choi da xong tran cua minh o vong nao thi vong do moi duoc
    // mo phong cho TAT CA cac bang (giong che do choi don). Tranh tinh trang
    // "cac bang khac da da het 3 tran con bang cua minh moi da 2".
    await this._mpWriteTournamentView('cup-group');
  }

  // Mo phong tat ca tran AI chua co ket qua trong MOT vong cu the (o moi bang).
  // Duoc goi sau khi doi choi da xong tran cua minh o vong do de cac bang cung
  // tien do, khong con tinh trang cac bang khac ve dich truoc.
  _mpSimulateGroupRound(roundIdx){
    const groups = this.mpCupGroups;
    if(!groups) return 0;
    let simmed = 0;
    for(let g=0; g<groups.length; g++){
      const group = groups[g];
      const round = group.rounds && group.rounds[roundIdx];
      if(!round) continue;
      const isPlayerGroup = group.teams.includes(0);
      round.forEach(mi => {
        const m = group.matches[mi];
        if(!m || m.result !== null) return;
        // Khong mo phong tran con cho cua doi choi (phai da truc tiep)
        if(isPlayerGroup && (m.home===0 || m.away===0)) return;
        const [hGoal, aGoal] = simAIPenalty();
        m.result = [hGoal, aGoal];
        this._mpUpdateCupGroupTable(g, m.home, hGoal, aGoal);
        this._mpUpdateCupGroupTable(g, m.away, aGoal, hGoal);
        simmed++;
      });
    }
    return simmed;
  }

  _mpUpdateCupGroupTable(groupIdx, teamIdx, scored, conceded){
    const row = this.mpCupGroups[groupIdx].table[teamIdx];
    if(!row) return;
    row.p++; row.gf+=scored; row.ga+=conceded; row.gd=row.gf-row.ga;
    if(scored>conceded){ row.w++; row.pts+=3; }
    else if(scored===conceded){ row.d++; row.pts+=1; }
    else row.l++;
  }

  async _mpPlayGroupMatch(){
    if(!this.isHost) return;
    const members = this.room.members||[];
    const pc = this.state.playerCountry;
    const queue = this.mpCupGroupMatchQueue || [];
    let ptr = this.mpCupGroupMatchPtr || 0;
    while(ptr < queue.length){
      const item = queue[ptr];
      const group = this.mpCupGroups && this.mpCupGroups[item.groupIdx];
      const match = group && group.matches && group.matches[item.matchIdx];
      if(!match) break;
      if(match.result === null) break;
      ptr++;
    }
    if(ptr >= queue.length){ this._mpRenderGroupStage(); return; }
    this.mpCupGroupMatchPtr = ptr;
    const item = queue[ptr];
    const group = this.mpCupGroups && this.mpCupGroups[item.groupIdx];
    const match = group && group.matches && group.matches[item.matchIdx];
    if(!group || !match){ this._mpResetTournament(); return; }
    const teams = this.mpCupTeams;
    const config = this.mpCupConfig || CUP_TOURNAMENTS[0];

    if(match.home === 0 || match.away === 0){
      const opp = match.home === 0 ? teams[match.away] : teams[match.home];
      const label = `${config.icon} ${config.name} · Bảng ${group.name}`;
      this.mpMatchContext = { type:'cup-group', groupIdx: item.groupIdx, matchIdx: item.matchIdx };
      await this._hostStartMPMatch(members, pc, opp, label, this.mpMatchContext);
    } else {
      // Tran AI: mo phong CA VONG cua tran nay (dong bo o moi bang) thay vi chi
      // 1 tran — giu cac bang luon cung tien trinh.
      let roundIdx = -1;
      if(group && group.rounds){
        for(let r=0; r<group.rounds.length; r++){
          if(group.rounds[r].includes(item.matchIdx)){ roundIdx = r; break; }
        }
      }
      if(roundIdx >= 0) this._mpSimulateGroupRound(roundIdx);
      else {
        const [hGoal, aGoal] = simAIPenalty();
        match.result = [hGoal, aGoal];
        this._mpUpdateCupGroupTable(item.groupIdx, match.home, hGoal, aGoal);
        this._mpUpdateCupGroupTable(item.groupIdx, match.away, aGoal, hGoal);
      }
      this.mpCupGroupMatchPtr = ptr + 1;
      await this._mpWriteTournamentView('cup-group');
      this._mpRenderGroupStage();
    }
  }

  _mpSortGroupTable(group){
    const entries = Object.entries(group.table).map(([ti, row]) => ({ teamIdx: parseInt(ti), ...row }));
    return entries.sort((a,b) => b.pts-a.pts || b.gd-a.gd || b.gf-a.gf);
  }

  _mpBuildGroupTableHtml(group){
    const teams = this.mpCupTeams || [];
    const config = this.mpCupConfig || CUP_TOURNAMENTS[0];
    const sorted = this._mpSortGroupTable(group);
    const groupComplete = group.matches.every(m => m.result !== null);
    let html = `<table class="pt-gt"><thead><tr><th>#</th><th>Đội</th><th>TR</th><th>THB</th><th>BT</th><th>HS</th><th>Đ</th></tr></thead><tbody>`;
    sorted.forEach((row, i)=>{
      const ti = row.teamIdx, t = teams[ti];
      if(!t) return;
      const isPlayer = ti === 0;
      const qualZone = i < config.advancePerGroup;
      const eliminatedClass = !qualZone && groupComplete ? 'pt-gt-eliminated' : '';
      html += `<tr class="${isPlayer?'pt-gt-player':''} ${qualZone?'pt-gt-qual':eliminatedClass}">
        <td>${i+1}</td><td class="pt-gt-name">${flagImg(t.code, t.name)} ${t.name}</td>
        <td>${row.p}</td>
        <td class="pt-gt-thb"><span class="pt-thb-w">${row.w}</span><span class="pt-thb-d">${row.d}</span><span class="pt-thb-l">${row.l}</span></td>
        <td class="pt-gt-gold">${row.gf}</td><td class="pt-gt-gold">${row.gd}</td><td class="pt-gt-pts pt-gt-gold">${row.pts}</td>
      </tr>`;
    });
    html += `</tbody></table>`;
    return html;
  }

  _mpRenderGroupStage(){
    const groups = this.mpCupGroups || [], teams = this.mpCupTeams || [], config = this.mpCupConfig || CUP_TOURNAMENTS[0];
    if(groups.length === 0){ this._mpResetTournament(); return; }
    let html = `<div class="pt-overview-header">
      <span class="pt-ov-icon">${config.icon}</span>
      <span class="pt-ov-title">${config.name} · Vòng bảng</span>
      <span class="pt-ov-sub">${groups.length} bảng</span>
    </div>`;
    let gridOpen = false;
    groups.forEach((group, gIdx)=>{
      if(gIdx % 2 === 0){ html += '<div class="pt-groups-row">'; gridOpen = true; }
      html += `<div class="pt-group-block ${group.teams.includes(0)?'pt-group-player':''}">
        <div class="pt-group-name">Bảng ${group.name}</div>${this._mpBuildGroupTableHtml(group)}`;
      let grh = '';
      group.matches.forEach(m => {
        if(m.result){
          const h = teams[m.home], a = teams[m.away];
          grh += `<div class="pt-gm-item ${m.home===0||m.away===0?'pt-gm-player':''}">${flagImg(h.code, h.name, 14)} ${m.result[0]}-${m.result[1]} ${flagImg(a.code, a.name, 14)}</div>`;
        } else { grh += `<div class="pt-gm-item pt-gm-pending">—</div>`; }
      });
      html += `<div class="pt-group-results">${grh}</div></div>`;
      if(gIdx % 2 === 1 || gIdx === groups.length - 1){ html += '</div>'; gridOpen = false; }
    });
    if(gridOpen) html += '</div>';
    document.getElementById('pt-group-view-content').innerHTML = html;

    const allDone = groups.every(g => g.matches.every(m => m.result !== null));
    if(allDone){
      this.mpCupPhase = 'transition';
      this._mpGetQualifiers();
      this._mpRenderTransition();
    } else {
      this.mpCupPhase = 'group';
      this._setTournamentBackVisible(false);
      this.showScreen('pt-cup-group-view');
      document.getElementById('pt-group-next').style.display = '';
    }
  }

  _mpGetQualifiers(){
    const groups = this.mpCupGroups, config = this.mpCupConfig || CUP_TOURNAMENTS[0], qualifiers = [], thirds = [];
    groups.forEach(group => {
      const sorted = this._mpSortGroupTable(group);
      for(let i=0; i<config.advancePerGroup; i++){ if(sorted[i]) qualifiers.push({ teamIdx: sorted[i].teamIdx, groupName: group.name, groupPos: i }); }
      if(config.extraQualifiers && sorted[config.advancePerGroup]){
        thirds.push({ teamIdx: sorted[config.advancePerGroup].teamIdx, groupName: group.name, groupPos: config.advancePerGroup, pts: sorted[config.advancePerGroup].pts, gd: sorted[config.advancePerGroup].gd });
      }
    });
    if(config.extraQualifiers && thirds.length > 0){
      thirds.sort((a,b) => b.pts-a.pts || b.gd-a.gd);
      thirds.slice(0, config.extraQualifiers).forEach(t => qualifiers.push(t));
    }
    this.mpCupQualifiers = qualifiers;
    return qualifiers;
  }

  _mpRenderTransition(){
    const groups = this.mpCupGroups || [], config = this.mpCupConfig || CUP_TOURNAMENTS[0];
    if(groups.length === 0){ this._mpResetTournament(); return; }
    let html = `<div class="pt-overview-header"><span class="pt-ov-icon">⚡</span><span class="pt-ov-title">${config.name} · Kết thúc vòng bảng</span><span class="pt-ov-sub">${this.mpCupQualifiers.length} đội đi tiếp</span></div>`;
    let gridOpen = false;
    groups.forEach((group, gIdx) => {
      if(gIdx % 2 === 0){ html += '<div class="pt-groups-row">'; gridOpen = true; }
      html += `<div class="pt-group-block ${group.teams.includes(0)?'pt-group-player':''}"><div class="pt-group-name">Bảng ${group.name}</div>${this._mpBuildGroupTableHtml(group)}</div>`;
      if(gIdx % 2 === 1 || gIdx === groups.length - 1){ html += '</div>'; gridOpen = false; }
    });
    if(gridOpen) html += '</div>';
    document.getElementById('pt-transition-content').innerHTML = html;
    // Bi loai o vong bang → cho phep quay ve chon che do thay vi chi roi phong
    const eliminated = !(this.mpCupQualifiers || []).some(q => q.teamIdx === 0);
    this._setTournamentBackVisible(eliminated);
    this.showScreen('pt-cup-transition');
  }

  async _mpAdvanceToKnockout(){
    if(!this.isHost) return;
    const config = this.mpCupConfig || CUP_TOURNAMENTS[0], teams = this.mpCupTeams || [];
    // Đề phòng qualifiers bị rỗng (state lệch / host reload) — tính lại từ bảng
    // để không rơi vào khung đấu trống gây kẹt "không đá tiếp được".
    let qualifiers = this.mpCupQualifiers || [];
    if(!qualifiers.length) qualifiers = this._mpGetQualifiers();
    const roundNames = config.knockoutRoundNames, groupNames = this.mpCupGroups.map(g => g.name);
    const firstRoundMatches = [];

    if(config.id === 'worldcup' && qualifiers.length === 16){
      for(let i=0; i<8; i++){
        const w = qualifiers.find(q => q.groupName === groupNames[i] && q.groupPos === 0);
        const ru = qualifiers.find(q => q.groupName === groupNames[i%2===0 ? i+1 : i-1] && q.groupPos === 1);
        if(w && ru) firstRoundMatches.push({ home: w.teamIdx, away: ru.teamIdx });
      }
    } else if(qualifiers.length === 8 && groupNames.length >= 4){
      const pairs = [[0,1],[2,3],[1,0],[3,2]];
      pairs.forEach(([wi, rui]) => {
        const w = qualifiers.find(q => q.groupName === groupNames[wi] && q.groupPos === 0);
        const ru = qualifiers.find(q => q.groupName === groupNames[rui] && q.groupPos === 1);
        if(w && ru) firstRoundMatches.push({ home: w.teamIdx, away: ru.teamIdx });
      });
    } else {
      for(let i=0; i<qualifiers.length; i+=2){ if(i+1 < qualifiers.length) firstRoundMatches.push({ home: qualifiers[i].teamIdx, away: qualifiers[i+1].teamIdx }); }
    }

    const knockoutRounds = [];
    let currentMatches = firstRoundMatches.map(m => ({ home: m.home, away: m.away, result: null }));
    for(let r=0; r<roundNames.length; r++){
      knockoutRounds.push({ name: roundNames[r], matches: currentMatches });
      if(r < roundNames.length-1){
        const nextMatches = [];
        for(let i=0; i<currentMatches.length; i+=2){
          if(i+1 < currentMatches.length) nextMatches.push({ home: null, away: null, from: [r, i, r, i+1], result: null });
          else nextMatches.push({ home: null, away: null, from: [r, i], result: null });
        }
        currentMatches = nextMatches;
      }
    }
    this.mpCupKnockoutRounds = knockoutRounds;
    this.mpCupKnockoutMatchPtr = 0;
    this.mpCupKnockoutDisplayRoundIdx = 0;
    this.mpCupPhase = 'knockout';
    this._mpSimulateAIKnockoutRounds();
    await this._mpWriteTournamentView('cup-knockout');
    this._mpRenderKnockoutStage();
  }

  _mpResolveMatch(roundIdx, matchIdx){
    const round = this.mpCupKnockoutRounds[roundIdx];
    if(!round || !round.matches[matchIdx]) return null;
    const m = round.matches[matchIdx];
    if(m.home !== null && m.away !== null) return m;
    if(m.from){
      const pm1 = this.mpCupKnockoutRounds[m.from[0]].matches[m.from[1]];
      if(pm1 && pm1.result){ m.home = pm1.result[0] > pm1.result[1] ? pm1.home : pm1.away; }
      if(m.from.length >= 4){
        const pm2 = this.mpCupKnockoutRounds[m.from[2]].matches[m.from[3]];
        if(pm2 && pm2.result){ m.away = pm2.result[0] > pm2.result[1] ? pm2.home : pm2.away; }
      }
    }
    return m;
  }

  _mpSimulateAIKnockoutRounds(){
    const rounds = this.mpCupKnockoutRounds;
    for(let r=0; r<rounds.length; r++){
      for(let m=0; m<rounds[r].matches.length; m++){
        const match = rounds[r].matches[m];
        if(match.result !== null) continue;
        this._mpResolveMatch(r, m);
        if(match.home === null || match.home === undefined || match.away === null || match.away === undefined) continue;
        if(match.home === 0 || match.away === 0) continue;
        // Knock-out không được hòa: mô phỏng lại cho tới khi có người thắng
        let hGoal, aGoal;
        do { [hGoal, aGoal] = simAIPenalty(); } while(hGoal===aGoal);
        match.result = [hGoal, aGoal];
      }
    }
  }

  _mpRenderKnockoutStage(){
    const config = this.mpCupConfig || CUP_TOURNAMENTS[0], rounds = this.mpCupKnockoutRounds || [], teams = this.mpCupTeams || [];
    if(rounds.length === 0){ this._mpResetTournament(); return; }
    const totalMatches = rounds.reduce((s,r) => s+r.matches.length, 0);
    const playedMatches = rounds.reduce((s,r) => s+r.matches.filter(m => m.result!==null).length, 0);
    document.getElementById('pt-knockout-header').innerHTML = `<span class="pt-ov-icon">${config.icon}</span><span class="pt-ov-title">${config.name} · Vòng loại trực tiếp</span><span class="pt-ov-sub">${playedMatches}/${totalMatches} trận</span>`;
    const displayIdx = Math.min(this.mpCupKnockoutDisplayRoundIdx || 0, rounds.length-1);
    let ds, de;
    if(displayIdx >= rounds.length-2){ ds = Math.max(0, rounds.length-2); de = rounds.length; }
    else { ds = displayIdx; de = displayIdx + 1; }
    let html = '<div class="pt-knockout-bracket">';
    rounds.slice(ds, de).forEach((round, offset) => {
      const rIdx = ds + offset;
      html += `<div class="pt-kr-round"><div class="pt-kr-round-name">${round.name}</div><div class="pt-kr-matches">`;
      round.matches.forEach((m, mIdx) => {
        this._mpResolveMatch(rIdx, mIdx);
        const isDone = m.result !== null;
        const hTeam = m.home!==null && m.home!==undefined ? teams[m.home] : null;
        const aTeam = m.away!==null && m.away!==undefined ? teams[m.away] : null;
        const hasPlayer = m.home === 0 || m.away === 0;
        let resStr = isDone ? `${m.result[0]}-${m.result[1]}` : 'vs';
        html += `<div class="pt-kr-match ${isDone?'done':''} ${hasPlayer?'pt-kr-player':''}">
          <div class="pt-kr-teams">
            <span class="pt-kr-team ${m.home===0?'pt-highlight':''} ${isDone&&m.result[0]>m.result[1]?'pt-kr-winner':''}">${hTeam ? flagImg(hTeam.code, hTeam.name)+' '+abbr3(hTeam) : '⚪ TBD'}</span>
            <span class="pt-kr-vs">${resStr}</span>
            <span class="pt-kr-team pt-kr-team-away ${m.away===0?'pt-highlight':''} ${isDone&&m.result[1]>m.result[0]?'pt-kr-winner':''}">${aTeam ? abbr3(aTeam)+' '+flagImg(aTeam.code, aTeam.name) : 'TBD ⚪'}</span>
          </div>
        </div>`;
      });
      html += `</div></div>`;
    });
    html += '</div>';
    document.getElementById('pt-knockout-bracket').innerHTML = html;

    const allDone = rounds.every(r => r.matches.every(m => m.result !== null));
    if(allDone){
      document.getElementById('pt-knockout-next').style.display = 'none';
      // Thưởng CẢ 2 người khi Cúp kết thúc — mỗi client cộng điểm cho tài khoản của mình
      if(!this._mpCupRewarded){
        this._mpCupRewarded = true;
        const lastRound = rounds[rounds.length-1];
        const finalMatch = lastRound && lastRound.matches[0];
        let isWin = false;
        if(finalMatch && finalMatch.result){
          const winner = finalMatch.result[0] > finalMatch.result[1] ? finalMatch.home : finalMatch.away;
          isWin = winner === 0;
        }
        const pts = (isWin ? (config.pointsWin||600) : (config.pointsLose||120)) * REWARD_BOOST;
        addPoints('Vt Football '+config.name, isWin?'Vô địch '+config.name:'Á quân '+config.name, pts).catch(()=>{});
        // Ghi lịch sử thành tích — Cúp kết thúc (dùng chung _estimateCupRank từ PenaltyGame)
        this._recordHistory({
          ts: Date.now(),
          kind: 'tournament',
          mode: 'cup',
          mp: true,
          result: isWin ? 'champion' : 'rank',
          rank: this._estimateCupRank(rounds, isWin, finalMatch),
          player: { code: this.state.playerCountry.code, name: this.state.playerCountry.name },
          label: config.name
        });
      }
      // Chỉ host hiện toast — tránh guest chạy lại _mpEndCup
      if(this.isHost && !this._mpCupEnded){ this._mpCupEnded = true; this._mpEndCup(); }
    }
    else { document.getElementById('pt-knockout-next').style.display = ''; document.getElementById('pt-knockout-next').textContent = '⚽ Đá trận tiếp'; }
    // Bi loai (thua tran knock-out) hoac giai da xong → duoc phep quay ve chon che do
    const playerEliminated = this._mpIsKnockoutPlayerEliminated();
    this._setTournamentBackVisible(allDone || playerEliminated);
    this.showScreen('pt-cup-knockout-view');
  }

  async _mpPlayKnockoutMatch(){
    if(!this.isHost) return;
    const members = this.room.members||[], pc = this.state.playerCountry;
    const rounds = this.mpCupKnockoutRounds, teams = this.mpCupTeams, config = this.mpCupConfig || CUP_TOURNAMENTS[0];
    // Tim tran co nguoi choi (home/away === 0) dang cho — uu tien tran nay
    for(let r=0; r<rounds.length; r++){
      for(let m=0; m<rounds[r].matches.length; m++){
        const match = rounds[r].matches[m];
        if(match.result !== null) continue;
        this._mpResolveMatch(r, m);
        if(match.home === null || match.home === undefined || match.away === null || match.away === undefined) continue;
        if(match.home === 0 || match.away === 0){
          const opp = match.home === 0 ? teams[match.away] : teams[match.home];
          const label = `${config.icon} ${config.name} · ${rounds[r].name}`;
          this.mpMatchContext = { type:'cup-knockout', roundIdx: r, matchIdx: m };
          this.mpCupKnockoutDisplayRoundIdx = r;
          await this._hostStartMPMatch(members, pc, opp, label, this.mpMatchContext);
          return;
        }
      }
    }
    // Khong con tran cua nguoi choi — mo phong TOAN BO tran AI con lai, dong bo len Firestore
    let simulatedAny = false;
    for(let r=0; r<rounds.length; r++){
      for(let m=0; m<rounds[r].matches.length; m++){
        const match = rounds[r].matches[m];
        if(match.result !== null) continue;
        this._mpResolveMatch(r, m);
        if(match.home === null || match.home === undefined || match.away === null || match.away === undefined) continue;
        if(match.home === 0 || match.away === 0) continue;
        // Knock-out không được hòa: mô phỏng lại cho tới khi có người thắng
        let hGoal, aGoal;
        do { [hGoal, aGoal] = simAIPenalty(); } while(hGoal===aGoal);
        match.result = [hGoal, aGoal];
        simulatedAny = true;
      }
    }
    if(simulatedAny) await this._mpWriteTournamentView('cup-knockout');
    this._mpRenderKnockoutStage();
  }

  _mpEndCup(){
    const config = this.mpCupConfig || CUP_TOURNAMENTS[0], rounds = this.mpCupKnockoutRounds || [];
    const lastRound = rounds[rounds.length-1];
    if(lastRound && lastRound.matches.length > 0){
      const finalMatch = lastRound.matches[0];
      if(finalMatch.result){
        const winner = finalMatch.result[0] > finalMatch.result[1] ? finalMatch.home : finalMatch.away;
        const isWin = winner === 0;
        // NOT: addPoints() — điểm được cộng ở _mpRenderKnockoutStage (cả 2 người đều nhận)
        window.showToast?.(`🏆 ${config.name} kết thúc! ${isWin ? 'Vô địch!' : 'Về nhì'}`);
      }
    }
  }

  // ===== TOURNAMENT SNAPSHOT SYNC =====
  // Dong bo toan bo trang thai giai dau (Cup/League) len Firestore de
  // CA 2 nguoi choi (host + guest) deu thay duoc bang dau / bang xep hang.

  // State giai dau bi mat (host reload giua giai, snapshot cu) — reset ve setup
  // thay vi crash.
  async _mpResetTournament(){
    this.mpMatchContext = null;
    this.mpMatchCount = 0; // giai moi / ve setup — bat dau vai sut cho thanh vien dau
    if(this.isHost){
      // Cung clear gameState.mpMatchCount de _onGameState khong phuc hoi gia tri cu
      await updateDoc(doc(db,'rooms',this.roomId), { 'gameState.phase':'setup', 'gameState.mpMatchCount': 0 }).catch(()=>{});
    }
    this.showMenu();
  }

  // Quay ve man hinh chon che do (setup) khi da bi loai / giai da ket thuc —
  // thay vi bat buoc roi phong. Ca host lan guest deu co the bam (Firestore rules
  // cho phep thanh vien update room).
  async _mpBackToModeSelect(){
    this.mpMatchContext = null;
    this.mpMatchCount = 0; // giai moi / ve setup — bat dau vai sut cho thanh vien dau
    if(this.roomId){
      // Cung clear gameState.mpMatchCount de _onGameState khong phuc hoi gia tri cu
      await updateDoc(doc(db,'rooms',this.roomId), { 'gameState.phase':'setup', 'gameState.mpMatchCount': 0 }).catch(()=>{});
    }
    this.showMenu();
    window.showToast?.('🔄 Đã quay về màn hình chọn chế độ','info');
  }

  // Hien/an nut "Chọn chế độ khác" tren cac man giai dau
  _setTournamentBackVisible(visible){
    ['pt-league-back','pt-transition-back','pt-knockout-back'].forEach(id=>{
      const b=document.getElementById(id);
      if(b) b.style.display = visible ? '' : 'none';
    });
  }

  // Kiem tra doi choi (team 0) da thua 1 tran knock-out nao chua
  _mpIsKnockoutPlayerEliminated(){
    const rounds = this.mpCupKnockoutRounds || [];
    for(let r=0; r<rounds.length; r++){
      for(let m=0; m<rounds[r].matches.length; m++){
        const match = rounds[r].matches[m];
        if(!match.result) continue;
        if(match.home !== 0 && match.away !== 0) continue;
        const pGoals = match.home === 0 ? match.result[0] : match.result[1];
        const oGoals = match.home === 0 ? match.result[1] : match.result[0];
        if(pGoals < oGoals) return true;
      }
    }
    return false;
  }

  _mpTournamentSnapshot(){
    return {
      cupConfigId: this.mpCupConfig ? this.mpCupConfig.id : null,
      leagueConfigId: this.mpLeagueConfig ? this.mpLeagueConfig.id : null,
      teamType: this.mpTeamType || 'national',
      cupTeams: this.mpCupTeams || [],
      cupGroups: this.mpCupGroups || [],
      cupGroupMatchQueue: this.mpCupGroupMatchQueue || [],
      cupGroupMatchPtr: this.mpCupGroupMatchPtr || 0,
      cupQualifiers: this.mpCupQualifiers || [],
      cupPhase: this.mpCupPhase || 'group',
      cupKnockoutRounds: this.mpCupKnockoutRounds || [],
      cupKnockoutMatchPtr: this.mpCupKnockoutMatchPtr || 0,
      cupKnockoutDisplayRoundIdx: this.mpCupKnockoutDisplayRoundIdx || 0,
      leagueTeams: this.mpLeagueTeams || [],
      leagueRounds: this.mpLeagueRounds || [],
      leagueRoundIdx: this.mpLeagueRoundIdx || 0,
      leagueTable: this.mpLeagueTable || {},
      matchCount: this.mpMatchCount || 0
    };
  }

  _mpHydrateTournament(snap){
    if(!snap) return;
    // Firestore khong ho tro mang long nhau (leagueRounds/cupGroups[].rounds
    // la mang 2 chieu) nen snapshot duoc ghi duoi dang JSON string.
    if(typeof snap === 'string'){
      try{ snap = JSON.parse(snap); }catch(e){ return; }
    }
    if(!snap || typeof snap !== 'object') return;
    if(snap.cupConfigId) this.mpCupConfig = cupById(snap.cupConfigId) || this.mpCupConfig || getCupsByType(this.mpTeamType||'national')[0];
    if(snap.leagueConfigId) this.mpLeagueConfig = leagueById(snap.leagueConfigId) || this.mpLeagueConfig || getLeaguesByType(this.mpTeamType||'national')[0];
    if(snap.teamType) this.mpTeamType = snap.teamType;
    if(snap.cupTeams) this.mpCupTeams = snap.cupTeams;
    if(snap.cupGroups) this.mpCupGroups = snap.cupGroups;
    if(snap.cupGroupMatchQueue) this.mpCupGroupMatchQueue = snap.cupGroupMatchQueue;
    if(typeof snap.cupGroupMatchPtr === 'number') this.mpCupGroupMatchPtr = snap.cupGroupMatchPtr;
    if(snap.cupQualifiers) this.mpCupQualifiers = snap.cupQualifiers;
    if(snap.cupPhase) this.mpCupPhase = snap.cupPhase;
    if(snap.cupKnockoutRounds) this.mpCupKnockoutRounds = snap.cupKnockoutRounds;
    if(typeof snap.cupKnockoutMatchPtr === 'number') this.mpCupKnockoutMatchPtr = snap.cupKnockoutMatchPtr;
    if(typeof snap.cupKnockoutDisplayRoundIdx === 'number') this.mpCupKnockoutDisplayRoundIdx = snap.cupKnockoutDisplayRoundIdx;
    if(snap.leagueTeams) this.mpLeagueTeams = snap.leagueTeams;
    if(snap.leagueRounds) this.mpLeagueRounds = snap.leagueRounds;
    if(typeof snap.leagueRoundIdx === 'number') this.mpLeagueRoundIdx = snap.leagueRoundIdx;
    if(snap.leagueTable) this.mpLeagueTable = snap.leagueTable;
    // Đội người chơi LUÔN nằm ở index 0 trong cupTeams/leagueTeams (teams=[pc,...])
    // — khôi phục lại để host/guest reload giữa giải không bị rơi về đội mặc định
    // (VN) ở trận sau; nếu không, trận kế tiếp lại đá nhầm đội cũ.
    if(Array.isArray(snap.cupTeams) && snap.cupTeams[0]) this.state.playerCountry = snap.cupTeams[0];
    if(Array.isArray(snap.leagueTeams) && snap.leagueTeams[0]) this.state.playerCountry = snap.leagueTeams[0];
    // Luan phien vai sut/bat moi tran — luu lai de sau khi host reload van
    // tiep tuc dung thu tu (khong bi lap lai nguoi sut o tran ke tiep).
    if(typeof snap.matchCount === 'number') this.mpMatchCount = snap.matchCount;
    // Giai moi bat dau (chua tran nao da da) → reset co cong diem de ca 2 nguoi deu nhan thuong
    const leagueFresh = Array.isArray(snap.leagueRounds) && snap.leagueRounds.length > 0 &&
      snap.leagueRounds.every(r => Array.isArray(r) && r.every(f => !f || f.result === null));
    const cupFresh = Array.isArray(snap.cupGroups) && snap.cupGroups.length > 0 &&
      snap.cupGroups.every(g => g && Array.isArray(g.matches) && g.matches.every(m => !m || m.result === null));
    if(leagueFresh) this._mpLeagueRewarded = false;
    if(cupFresh) this._mpCupRewarded = false;
  }

  // Host ghi trang thai giai dau + phase='tournament' de ca 2 ben render bang dau
  async _mpWriteTournamentView(view){
    if(!this.isHost) return;
    await updateDoc(doc(db,'rooms',this.roomId), {
      'gameState.mpMode': this.mpMode,
      'gameState.phase': 'tournament',
      'gameState.mpTournamentView': view,
      // JSON.stringify: tranh loi FirebaseError 'Nested arrays are not supported'
      // (leagueRounds / cupGroups[].rounds chua mang trong mang)
      'gameState.mpTournament': JSON.stringify(this._mpTournamentSnapshot()),
      'gameState.mpMatchContext': null
    });
  }

  // Render dung man hinh giai dau theo view (dung cho ca host lan guest)
  _showMPTournamentView(view){
    if(view==='league'){ this._mpRenderLeagueView(); }
    else if(view==='cup-transition'){ this._mpRenderTransition(); }
    else if(view==='cup-knockout'){ this._mpRenderKnockoutStage(); }
    else { this._mpRenderGroupStage(); }
    // Guest khong duoc bam "Đá trận tiếp" — an nut cho nguoi khong phai host
    if(!this.isHost){
      ['pt-league-next','pt-group-next','pt-transition-next','pt-knockout-next'].forEach(id=>{
        const b=document.getElementById(id);
        if(b) b.style.display='none';
      });
    }
  }

  // ===== COMMON MATCH STARTER =====
  async _hostStartMPMatch(members, pc, opponent, label, context){
    const ac = opponent || this.randomCountry(pc.code);
    this.mpMatchContext = context;
    const m = members.slice(0,2);
    // De phong dong doi roi giua giai — khong du 2 nguoi thi khong bat tran
    if(m.length < 2){ window.showToast?.('Cần đủ 2 người trong đội!','warn'); this.mpMatchContext = null; return; }
    // Vai co dinh trong tran; moi tran moi luan phien nguoi sut / nguoi bat
    const swap = (this.mpMatchCount % 2) === 1;
    this.mpMatchCount++;
    const shooterUid = swap ? m[1] : m[0];
    const keeperUid = swap ? m[0] : m[1];
    await updateDoc(doc(db,'rooms',this.roomId), {
      gameState: {
        mpMode: this.mpMode,
        phase:'shooting', seq:1, players: m,
        shooterUid, keeperUid, mpMatchCount: this.mpMatchCount,
        round:1, maxRounds:5, scores:[0,0], history:[],
        playerCountry: pc.code, aiCountry: ac.code,
        playerZone:null, keeperAiZone:null, pendingAiZone:null, keeperZone:null,
        matchLabel: label || '🏟️ Giao hữu (2 người)',
        mpMatchContext: context || { type:'quick' }
      }
    });
  }

  // ===== ROUND STATE MACHINE =====
  _handleRoundState(gs){
    if(gs.seq===this._lastSeq) return;
    this._lastSeq=gs.seq;

    if(gs.phase==='shooting'){
      this._finishedHandled=false;
      this.state.currentShooter='player';
      this.state.phase='shooting';
      this.state.shotLocked=false;
      this.resetKeeperPos();
      this.resetShooterPos();
      this._resetBall();
      const doneBtn = document.getElementById('pt-mp-match-done-btn');
      if(doneBtn) doneBtn.style.display='none';
      this.renderStatusBar();
      this._updateRoleBanner(gs);
      this._mpStyleTurnBox(gs);
      this._setRoleBlink(true, 'ball');

    }else if(gs.phase==='anim-shot'){
      this.state.phase='shooting';
      this.state.shotLocked=true;
      const isGoal = gs.playerZone!==gs.keeperAiZone;
      this.animateShot(gs.playerZone, gs.keeperAiZone, isGoal, gs.shotEffect);
      this._setRoleBlink(false);
      // Giữ tag "SÚT + tên" trong suốt đường bóng bay (trước khi result banner hiện)
      this._mpStyleTurnBox(gs);
      if(this.myRole==='shooter'){
        setTimeout(()=>this._finalizeShotPhase(gs, isGoal), isGoal?1700:3200);
      }

    }else if(gs.phase==='defending'){
      this.state.phase='defending';
      this.state.shotLocked=false;
      this.resetKeeperPos();
      this.resetShooterPos('right');
      this._resetBall();
      this.renderStatusBar();
      this._updateRoleBanner(gs);
      this._mpStyleTurnBox(gs);
      this._setRoleBlink(true, 'keeper');

    }else if(gs.phase==='anim-defend'){
      this.state.phase='defending';
      this.state.shotLocked=true;
      const isGoal = gs.keeperZone!==gs.pendingAiZone;
      this.animateAIShot(gs.pendingAiZone, gs.keeperZone, isGoal, gs.shotEffect);
      this._setRoleBlink(false);
      // Giữ tag "THỦ MÔN + tên" trong suốt đường bóng bay (trước khi result banner hiện)
      this._mpStyleTurnBox(gs);
      if(this.myRole==='keeper'){
        setTimeout(()=>this._finalizeDefendPhase(gs, isGoal), isGoal?1700:3200);
      }

    }else if(gs.phase==='finished' && !this._finishedHandled){
      this._finishedHandled=true;
      this.state.phase='finished';
      this.state.shotLocked=true;
      this._setRoleBlink(false);
      this.endMatch();
      // Chi host an "Hoàn thành" — guest cho host dieu khien tien trinh giai dau
      const doneBtn = document.getElementById('pt-mp-match-done-btn');
      if(doneBtn) doneBtn.style.display = this.isHost ? '' : 'none';
    }
  }

  _memberName(uid){
    if(!uid) return 'Đồng đội';
    const info=(this.room && this.room.memberInfo) ? this.room.memberInfo[uid] : null;
    return (info && info.name) || (uid===this.uid ? 'Bạn' : 'Đồng đội');
  }

  _esc(s){
    return String(s==null?'':s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  // Tag giữa sân theo phong cách bài cào / xì dách: SÚT (Liêng) / THỦ MÔN
  // (Xì Dách) kèm tên người thực hiện (vd: "Admin Sút", "v1 Thủ Môn").
  // Nhận cả phase anim-shot/anim-defend (đường bóng bay) để giữ tên hiển thị.
  _mpStyleTurnBox(gs){
    const box=document.getElementById('pt-turn-box');
    if(!box) return;
    const phase = gs.phase==='anim-shot' ? 'shooting' : (gs.phase==='anim-defend' ? 'defending' : gs.phase);
    if(phase==='shooting'){
      // Tên người thực hiện chữ thường, không khung, không icon (vd: Admin SÚT)
      box.innerHTML = `${this._esc(this._memberName(gs.shooterUid))} SÚT`;
      box.className = 'pt-turn-box tag-shoot';
      box.style.display='';
    }else if(phase==='defending'){
      // Tên người thực hiện chữ thường, không khung, không icon (vd: v1 THỦ MÔN)
      box.innerHTML = `${this._esc(this._memberName(gs.keeperUid))} THỦ MÔN`;
      box.className = 'pt-turn-box tag-keeper';
      box.style.display='';
    }
  }

  // VÀO!!! phong cách THẮNG (xanh), KHÔNG VÀO!!! phong cách THUA (đỏ)
  // Đội đối thủ (theirs) sút thì NGƯỢC màu với đội mình: đối thủ ghi bàn = xấu
  // (đỏ/Thua), đối thủ trượt = tốt cho ta (xanh/Thắng).
  showShotResultBanner(isGoal, team){
    const box=document.getElementById('pt-turn-box');
    if(!box) return;
    const goodForUs = team==='theirs' ? !isGoal : isGoal;
    box.innerHTML = isGoal ? 'VÀO!!!' : 'KHÔNG VÀO!!!';
    box.className = 'pt-turn-box ' + (goodForUs ? 'tag-goal' : 'tag-miss');
    box.style.display='';
  }

  // THẮNG/THUA/HÒA cuối trận theo phong cách thẻ bài
  renderStatusBar(){
    super.renderStatusBar();
    if(this.state.phase==='finished'){
      const box=document.getElementById('pt-turn-box');
      if(!box) return;
      const r=this.state._lastMatchResult;
      box.className = 'pt-turn-box ' + (r==='win'?'tag-goal':r==='lose'?'tag-miss':'result-draw');
    }
  }

  _updateRoleBanner(gs){
    const note=document.getElementById('pt-mp-role-note');
    if(!note) return;
    const teammateName = (this.room?.memberInfo||{})[this.teammateUid]?.name || 'Đồng đội';
    if(gs.phase==='shooting'){
      note.textContent = this.myRole==='shooter' ? '👉 Đến lượt BẠN sút!' : `⏳ ${teammateName} đang sút...`;
    }else if(gs.phase==='defending'){
      note.textContent = this.myRole==='keeper' ? '🧤 Đến lượt BẠN bắt gôn!' : `⏳ ${teammateName} đang bắt gôn...`;
    }
  }

  // ===== ACTIONS =====
  async _doPlayerShoot(zoneId){
    this.state.shotLocked=true;
    const gs=this._gs;
    const keeperAiZone=this.aiPickZone();
    // Chọn hiệu ứng ngay tại client đang sút rồi ghi lên Firestore để cả 2 bên
    // animate cùng 1 hiệu ứng (không random riêng từng máy từ localStorage).
    const shotEffect = this._pickTrailStyle();
    await updateDoc(doc(db,'rooms',this.roomId), {
      'gameState.playerZone': zoneId,
      'gameState.keeperAiZone': keeperAiZone,
      'gameState.phase': 'anim-shot',
      'gameState.shotEffect': shotEffect,
      'gameState.seq': (gs.seq||0)+1
    });
  }

  async _doPlayerDefend(zoneId){
    this.state.shotLocked=true;
    const gs=this._gs;
    await updateDoc(doc(db,'rooms',this.roomId), {
      'gameState.keeperZone': zoneId,
      'gameState.phase': 'anim-defend',
      'gameState.seq': (gs.seq||0)+1
    });
  }

  // ===== FINALIZE PHASES =====
  async _finalizeShotPhase(gs, isGoal){
    // Admin đã ép kết thúc (phase finished) — bỏ qua, tránh ghi đè kết quả ép
    if(this._gs && this._gs.phase==='finished') return;
    const scores=[...gs.scores]; if(isGoal) scores[0]++;
    const history=[...(gs.history||[]), { shooter:'player', zone:gs.playerZone, target:gs.keeperAiZone, result:isGoal?'goal':'saved' }];
    const pendingAiZone=this.aiPickZone();
    // Chọn hiệu ứng cho lượt AI sút ngay tại client đang sút để cả 2 bên đồng bộ
    const shotEffect = this._pickTrailStyle();
    await updateDoc(doc(db,'rooms',this.roomId), {
      'gameState.scores': scores,
      'gameState.history': history,
      'gameState.phase': 'defending',
      'gameState.pendingAiZone': pendingAiZone,
      'gameState.shotEffect': shotEffect,
      'gameState.keeperZone': null,
      'gameState.seq': (gs.seq||0)+1
    });
  }

  async _finalizeDefendPhase(gs, isGoal){
    // Admin đã ép kết thúc (phase finished) — bỏ qua, tránh ghi đè kết quả ép
    if(this._gs && this._gs.phase==='finished') return;
    const scores=[...gs.scores]; if(isGoal) scores[1]++;
    const history=[...(gs.history||[]), { shooter:'ai', zone:gs.pendingAiZone, target:gs.keeperZone, result:isGoal?'goal':'saved' }];
    const ps=history.filter(h=>h.shooter==='player').length;
    const as=history.filter(h=>h.shooter==='ai').length;
    const ctx = gs.mpMatchContext || this.mpMatchContext;
    const isKnockout = !!(ctx && ctx.type==='cup-knockout');
    const maxR = gs.maxRounds || 5;
    const tied = scores[0]===scores[1];
    const nextSeq = (gs.seq||0)+1;

    // Đủ 5 lượt mỗi bên — quyết định thắng/thua/luân lưu (giống penalty.js)
    if(ps>=maxR && as>=maxR){
      if(!tied || !isKnockout){
        // Có người dẫn trước, hoặc Giao hữu / vòng bảng / League hòa hợp lệ → kết thúc
        await updateDoc(doc(db,'rooms',this.roomId), {
          'gameState.scores': scores, 'gameState.history': history,
          'gameState.phase': 'finished', 'gameState.seq': nextSeq
        });
        return;
      }
      // Knock-out hòa sau 5 lượt → LUÂN LƯU TỬ THẦN: đặt lại cột chấm và đá tiếp
      // (chỉ reset dotsBase ở lần đầu vào loạt luân lưu, các vòng sau giữ nguyên)
      const enterSuddenDeath = (ps===maxR && as===maxR);
      await updateDoc(doc(db,'rooms',this.roomId), {
        'gameState.scores': scores, 'gameState.history': history,
        'gameState.round': (gs.round||1)+1,
        'gameState.phase': 'shooting',
        'gameState.dotsBaseP': enterSuddenDeath ? ps : (gs.dotsBaseP||0),
        'gameState.dotsBaseA': enterSuddenDeath ? as : (gs.dotsBaseA||0),
        // Vai co dinh trong tran: khong hoan doi sut/bat giua cac luot
        'gameState.playerZone': null, 'gameState.keeperAiZone': null,
        'gameState.pendingAiZone': null, 'gameState.keeperZone': null,
        'gameState.seq': nextSeq
      });
      return;
    }

    // Chưa đủ 5 lượt → đá tiếp lượt thường
    await updateDoc(doc(db,'rooms',this.roomId), {
      'gameState.scores': scores, 'gameState.history': history,
      'gameState.round': (gs.round||1)+1,
      'gameState.phase': 'shooting',
      // Vai co dinh trong tran: khong hoan doi sut/bat giua cac luot
      'gameState.playerZone': null, 'gameState.keeperAiZone': null,
      'gameState.pendingAiZone': null, 'gameState.keeperZone': null,
      'gameState.seq': nextSeq
    });
  }

  // ===== ADMIN FORCE END (debug) =====
  // Nút "Thắng ngay / Thua ngay" của admin tool: ghi kết quả ép thẳng lên
  // Firestore để CẢ 2 client (host + guest) cùng hội tụ về màn kết thúc, rồi
  // host bấm "Hoàn thành" để giải đấu tiếp tục bình thường.
  async adminForceEnd(forcedResult){
    if(!this.roomId || !this._gs) return false;
    const gs = this._gs;
    const win = forcedResult === 'win';
    const scores = win ? [5,0] : [0,5];
    const history = [];
    for(let i=0;i<5;i++){
      history.push({ shooter:'player', result: win?'goal':'saved' });
      history.push({ shooter:'ai', result: win?'saved':'goal' });
    }
    await updateDoc(doc(db,'rooms',this.roomId), {
      'gameState.scores': scores,
      'gameState.history': history,
      'gameState.phase': 'finished',
      'gameState.playerZone': null,
      'gameState.keeperAiZone': null,
      'gameState.pendingAiZone': null,
      'gameState.keeperZone': null,
      'gameState.seq': (gs.seq||0)+1
    });
    return true;
  }

  // ===== END MATCH (override parent) =====
  endMatch(){
    this.state.phase='finished';
    this.state.shotLocked=true;
    const ps=this.state.scores[0],as=this.state.scores[1];
    const isWin=ps>as,isDraw=ps===as;
    this.state._lastMatchResult=isWin?'win':isDraw?'draw':'lose';
    this.state._lastMatchScore=[ps,as];
    this.renderStatusBar();
    this._displayResultOverlay();
    // Giao hữu MP: thưởng CẢ 2 người như penalty 1 người — mỗi client cộng điểm cho tài khoản của mình
    if(this.mpMatchContext && this.mpMatchContext.type==='quick'){
      const pts = isWin?300:isDraw?120:60;
      addPoints('Vt Football', isWin?'Thắng penalty':isDraw?'Hòa penalty':'Thua penalty', pts).catch(()=>{});
      if(window.VTQuests) window.VTQuests.trackPlay('penalty');
    }
    // NOT: saveProgress() — MP không dùng localStorage
    // NOT: addPoints() cho Cup/League — điểm được cộng khi giải kết thúc (cả 2 người)
  }

  // Override parent's _displayResultOverlay — MP có cấu trúc DOM khác (không có pt-actions / pt-match-done-btn)
  _displayResultOverlay(){
    document.getElementById('pt-result-overlay').style.display='';
    const mpActions=document.getElementById('pt-mp-game-actions');
    if(mpActions) mpActions.style.display='none';
    const mainShooter=document.getElementById('pt-shooter');
    if(mainShooter) mainShooter.style.display='none';
    const result=this.state._lastMatchResult;
    const isPlayerWin = result==='win';
    const isAiWin = result==='lose';
    this._showResultShooter('pt-shooter-player', this.state.playerCountry, isPlayerWin ? 'celebrate' : 'disappoint');
    this._showResultShooter('pt-shooter-ai', this.state.aiCountry, isAiWin ? 'celebrate' : 'disappoint');
    const winnerTeam = isPlayerWin ? this.state.playerCountry : (isAiWin ? this.state.aiCountry : null);
    if(winnerTeam){
      this._spawnVictoryFlags(winnerTeam.code, winnerTeam.name);
      if(!String(winnerTeam.code).startsWith('gen_')) this._showGoalFlag(winnerTeam.code);
    }
  }

  // ===== MATCH DONE =====
  async _onMPMatchDone(){
    document.getElementById('pt-result-overlay').style.display='none';

    if(this.isHost && this.mpMatchContext){
      const ctx = this.mpMatchContext;
      const gs = this._gs;
      const pScore = gs.scores ? gs.scores[0] : 0;
      const aScore = gs.scores ? gs.scores[1] : 0;

      if(ctx.type === 'league'){
        const round = this.mpLeagueRounds[ctx.roundIdx];
        if(round && round[ctx.matchIdx]){
          const f = round[ctx.matchIdx];
          // Định hướng kết quả theo home/away THẬT của fixture — người chơi
          // (index 0) có thể đá ở vai KHÁCH (f.home !== 0). Nếu ghi thẳng
          // [pScore, aScore] thì kết quả bị đảo ngược → thua 13-14 (luân lưu
          // tử thần) bị tính thành thắng, sai bảng xếp hạng & thưởng.
          const oriented = orientMatchScore(f, pScore, aScore);
          f.result = oriented;
          this._mpUpdateLeagueTable(0, pScore, aScore);
          const oppIdx = f.home === 0 ? f.away : f.home;
          this._mpUpdateLeagueTable(oppIdx, aScore, pScore);
        }
        this._mpResolveRoundRest(ctx.roundIdx, ctx.matchIdx);
        this.mpLeagueRoundIdx = ctx.roundIdx + 1;
        if(this.mpLeagueRoundIdx >= this.mpLeagueRounds.length){
          const endedOk = await this._mpEndLeague();
          if(endedOk) await this._mpWriteTournamentView('league');
        } else {
          this.mpMatchContext = null;
          await this._mpWriteTournamentView('league');
          this._mpRenderLeagueView();
        }
      } else if(ctx.type === 'cup-group'){
        const group = this.mpCupGroups && this.mpCupGroups[ctx.groupIdx];
        const match = group && group.matches && group.matches[ctx.matchIdx];
        if(match){
          // Định hướng home/away thật của trận — người chơi có thể là đội KHÁCH
          // (match.away === 0). Ghi sai chiều → bảng xếp hạng + đi tiếp sai.
          const oriented = orientMatchScore(match, pScore, aScore);
          match.result = oriented;
          this._mpUpdateCupGroupTable(ctx.groupIdx, match.home, oriented[0], oriented[1]);
          this._mpUpdateCupGroupTable(ctx.groupIdx, match.away, oriented[1], oriented[0]);
        }
        // Sau khi doi choi da xong tran o vong nay, tu dong mo phong cac tran AI
        // con lai CUNG vong do o TAT CA cac bang — de moi bang luon cung tien do
        // (khong con canh "bang khac da da het 3 tran, bang minh moi da 2").
        let roundIdx = -1;
        if(group && group.rounds){
          for(let r=0; r<group.rounds.length; r++){
            if(group.rounds[r].includes(ctx.matchIdx)){ roundIdx = r; break; }
          }
        }
        if(roundIdx >= 0) this._mpSimulateGroupRound(roundIdx);
        this.mpMatchContext = null;
        // Neu state giai dau bi mat (host reload trang giua giai) thi
        // reset ve setup de khong ke't man hinh thay vi crash.
        if(!this.mpCupGroups || this.mpCupGroups.length === 0){
          await updateDoc(doc(db,'rooms',this.roomId), { 'gameState.phase':'setup' });
          this.showMenu();
        } else {
          await this._mpWriteTournamentView('cup-group');
          this._mpRenderGroupStage();
        }
      } else if(ctx.type === 'cup-knockout'){
        const round = this.mpCupKnockoutRounds && this.mpCupKnockoutRounds[ctx.roundIdx];
        const match = round && round.matches && round.matches[ctx.matchIdx];
        // Định hướng home/away — knockout dùng result để tìm winner, ghi sai
        // chiều sẽ khiến người THUA (VD thua 13-14) đi tiếp / nhận Cúp.
        if(match) match.result = orientMatchScore(match, pScore, aScore);
        this.mpCupKnockoutDisplayRoundIdx = ctx.roundIdx;
        if(this.mpCupKnockoutRounds && ctx.roundIdx + 1 < this.mpCupKnockoutRounds.length){
          this._mpResolveMatch(ctx.roundIdx + 1, 0);
        }
        if(!this.mpCupKnockoutRounds || this.mpCupKnockoutRounds.length === 0){
          await updateDoc(doc(db,'rooms',this.roomId), { 'gameState.phase':'setup' });
          this.mpMatchContext = null;
          this.showMenu();
        } else {
          await this._mpWriteTournamentView('cup-knockout');
          this._mpRenderKnockoutStage();
        }
      } else {
        await updateDoc(doc(db,'rooms',this.roomId), { 'gameState.phase':'setup' });
        this.showMenu();
      }
    } else if(this.isHost){
      await updateDoc(doc(db,'rooms',this.roomId), { 'gameState.phase':'setup' });
      this.showMenu();
    } else {
      // Guest: chi an overlay, cho host ghi ket qua tran (tra nhay ve menu)
      document.getElementById('pt-result-overlay').style.display='none';
    }
  }

  // ===== OVERRIDES =====
  showScreen(id){
    this._hideResultShooters();
    ['pt-menu','pt-game','pt-league-view','pt-cup-group-view','pt-cup-transition','pt-cup-knockout-view'].forEach(x=>{
      const e=document.getElementById(x);
      if(!e) return;
      e.classList.toggle('active',x===id);
      e.style.display=x===id?'':'none';
    });
    document.getElementById('pt-result-overlay').style.display='none';
  }

  showMenu(){
    this._hideResultShooters();
    ['pt-menu','pt-game','pt-league-view','pt-cup-group-view','pt-cup-transition','pt-cup-knockout-view'].forEach(id=>{
      const e=document.getElementById(id);
      if(e){e.classList.toggle('active',id==='pt-menu');e.style.display=id==='pt-menu'?'':'none'}
    });
    document.getElementById('pt-result-overlay').style.display='none';
    document.getElementById('pt-match-info').style.display='none';
  }

  onMatchDone(){
    this._onMPMatchDone();
  }

  async quitRoom(){
    try{
      if(this.roomId && this.uid){
        const snap=await getDoc(doc(db,'rooms',this.roomId));
        if(snap.exists()){
          const rd=snap.data();
          if(rd.hostUid===this.uid){
            const remaining=(rd.members||[]).filter(m=>m!==this.uid);
            if(remaining.length===0) await deleteDoc(doc(db,'rooms',this.roomId));
            else await updateDoc(doc(db,'rooms',this.roomId), { hostUid: remaining[0], members: arrayRemove(this.uid) });
          }else{
            await updateDoc(doc(db,'rooms',this.roomId), { members: arrayRemove(this.uid) });
          }
        }
      }
    }catch(e){ console.error(e); }
    location.href='../../app/rooms.html';
  }

  quitToMenu(){
    // Danh dau da roi chu dong de pagehide khong goi quitRoom lan 2
    window.__navigated=true;
    this.quitRoom();
  }
}

const penaltyGame=new PenaltyMP();
window.penaltyGame=penaltyGame;