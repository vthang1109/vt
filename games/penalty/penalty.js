// ===================== PENALTY SHOOTOUT - CUP EDITION =====================
import { auth, addPoints } from '../../points.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// ============================
// DỮ LIỆU QUỐC GIA
// ============================
const COUNTRIES = {
  chau_a: { name:'🌏 Châu Á', list: [
    {code:'jp',name:'Nhật Bản',flag:'🇯🇵',rank:17},{code:'ir',name:'Iran',flag:'🇮🇷',rank:20},
    {code:'kr',name:'Hàn Quốc',flag:'🇰🇷',rank:23},{code:'au',name:'Úc',flag:'🇦🇺',rank:24},
    {code:'sa',name:'Ả Rập Saudi',flag:'🇸🇦',rank:56},{code:'qa',name:'Qatar',flag:'🇶🇦',rank:58},
    {code:'iq',name:'Iraq',flag:'🇮🇶',rank:63},{code:'ae',name:'UAE',flag:'🇦🇪',rank:67},
    {code:'uz',name:'Uzbekistan',flag:'🇺🇿',rank:68},{code:'jo',name:'Jordan',flag:'🇯🇴',rank:73},
    {code:'om',name:'Oman',flag:'🇴🇲',rank:76},{code:'bh',name:'Bahrain',flag:'🇧🇭',rank:86},
    {code:'cn',name:'Trung Quốc',flag:'🇨🇳',rank:88},{code:'sy',name:'Syria',flag:'🇸🇾',rank:90},
    {code:'vn',name:'Việt Nam',flag:'🇻🇳',rank:94},{code:'ps',name:'Palestine',flag:'🇵🇸',rank:96},
    {code:'kg',name:'Kyrgyzstan',flag:'🇰🇬',rank:98},{code:'tj',name:'Tajikistan',flag:'🇹🇯',rank:104},
    {code:'lb',name:'Lebanon',flag:'🇱🇧',rank:106},{code:'kp',name:'Triều Tiên',flag:'🇰🇵',rank:110},
    {code:'th',name:'Thái Lan',flag:'🇹🇭',rank:113},{code:'in',name:'Ấn Độ',flag:'🇮🇳',rank:117},
    {code:'my',name:'Malaysia',flag:'🇲🇾',rank:130},{code:'tm',name:'Turkmenistan',flag:'🇹🇲',rank:131},
    {code:'id',name:'Indonesia',flag:'🇮🇩',rank:127},{code:'ph',name:'Philippines',flag:'🇵🇭',rank:135},
    {code:'hk',name:'Hồng Kông',flag:'🇭🇰',rank:150},{code:'tw',name:'Đài Bắc Trung Hoa',flag:'🇹🇼',rank:150},
    {code:'ye',name:'Yemen',flag:'🇾🇪',rank:156},{code:'mm',name:'Myanmar',flag:'🇲🇲',rank:159},
    {code:'sg',name:'Singapore',flag:'🇸🇬',rank:161},{code:'mv',name:'Maldives',flag:'🇲🇻',rank:163},
    {code:'kh',name:'Campuchia',flag:'🇰🇭',rank:176},{code:'np',name:'Nepal',flag:'🇳🇵',rank:176},
    {code:'bd',name:'Bangladesh',flag:'🇧🇩',rank:183},{code:'mn',name:'Mông Cổ',flag:'🇲🇳',rank:183},
    {code:'bn',name:'Brunei',flag:'🇧🇳',rank:190},{code:'pk',name:'Pakistan',flag:'🇵🇰',rank:195},
    {code:'lk',name:'Sri Lanka',flag:'🇱🇰',rank:200},{code:'la',name:'Lào',flag:'🇱🇦',rank:188},
    {code:'tl',name:'Timor Leste',flag:'🇹🇱',rank:196},{code:'bt',name:'Bhutan',flag:'🇧🇹',rank:185},
    {code:'af',name:'Afghanistan',flag:'🇦🇫',rank:150},
  ]},
  chau_eu: { name:'🌍 Châu Âu', list: [
    {code:'fr',name:'Pháp',flag:'🇫🇷',rank:2},{code:'be',name:'Bỉ',flag:'🇧🇪',rank:5},
    {code:'gb',name:'Anh',flag:'🇬🇧',rank:4},{code:'pt',name:'Bồ Đào Nha',flag:'🇵🇹',rank:6},
    {code:'nl',name:'Hà Lan',flag:'🇳🇱',rank:7},{code:'es',name:'Tây Ban Nha',flag:'🇪🇸',rank:8},
    {code:'it',name:'Ý',flag:'🇮🇹',rank:9},{code:'hr',name:'Croatia',flag:'🇭🇷',rank:10},
    {code:'de',name:'Đức',flag:'🇩🇪',rank:11},{code:'ua',name:'Ukraine',flag:'🇺🇦',rank:22},
    {code:'ch',name:'Thụy Sĩ',flag:'🇨🇭',rank:19},{code:'dk',name:'Đan Mạch',flag:'🇩🇰',rank:21},
    {code:'at',name:'Áo',flag:'🇦🇹',rank:25},{code:'se',name:'Thụy Điển',flag:'🇸🇪',rank:26},
    {code:'gb-wls',name:'Wales',flag:'🏴',rank:27},{code:'pl',name:'Ba Lan',flag:'🇵🇱',rank:28},
    {code:'tr',name:'Thổ Nhĩ Kỳ',flag:'🇹🇷',rank:29},{code:'no',name:'Na Uy',flag:'🇳🇴',rank:30},
    {code:'rs',name:'Serbia',flag:'🇷🇸',rank:33},{code:'gb-sct',name:'Scotland',flag:'🏴',rank:39},
    {code:'hu',name:'Hungary',flag:'🇭🇺',rank:35},{code:'cz',name:'CH Séc',flag:'🇨🇿',rank:36},
    {code:'fi',name:'Phần Lan',flag:'🇫🇮',rank:55},{code:'gr',name:'Hy Lạp',flag:'🇬🇷',rank:44},
    {code:'ro',name:'Romania',flag:'🇷🇴',rank:46},{code:'sk',name:'Slovakia',flag:'🇸🇰',rank:48},
    {code:'si',name:'Slovenia',flag:'🇸🇮',rank:53},{code:'mk',name:'Bắc Macedonia',flag:'🇲🇰',rank:65},
    {code:'ie',name:'Ireland',flag:'🇮🇪',rank:60},{code:'is',name:'Iceland',flag:'🇮🇸',rank:62},
    {code:'ba',name:'Bosnia',flag:'🇧🇦',rank:70},{code:'al',name:'Albania',flag:'🇦🇱',rank:66},
    {code:'bg',name:'Bulgaria',flag:'🇧🇬',rank:72},{code:'il',name:'Israel',flag:'🇮🇱',rank:80},
    {code:'ge',name:'Georgia',flag:'🇬🇪',rank:75},{code:'me',name:'Montenegro',flag:'🇲🇪',rank:82},
    {code:'xk',name:'Kosovo',flag:'🇽🇰',rank:78},{code:'am',name:'Armenia',flag:'🇦🇲',rank:89},
    {code:'lu',name:'Luxembourg',flag:'🇱🇺',rank:83},{code:'az',name:'Azerbaijan',flag:'🇦🇿',rank:103},
    {code:'cy',name:'Cyprus',flag:'🇨🇾',rank:120},{code:'ee',name:'Estonia',flag:'🇪🇪',rank:121},
    {code:'lt',name:'Lithuania',flag:'🇱🇹',rank:131},{code:'lv',name:'Latvia',flag:'🇱🇻',rank:136},
    {code:'md',name:'Moldova',flag:'🇲🇩',rank:153},{code:'mt',name:'Malta',flag:'🇲🇹',rank:170},
    {code:'ad',name:'Andorra',flag:'🇦🇩',rank:150},{code:'sm',name:'San Marino',flag:'🇸🇲',rank:210},
    {code:'fo',name:'Quần đảo Faroe',flag:'🇫🇴',rank:150},{code:'gi',name:'Gibraltar',flag:'🇬🇮',rank:200},
  ]},
  chau_phi: { name:'🌍 Châu Phi', list: [
    {code:'ma',name:'Maroc',flag:'🇲🇦',rank:13},{code:'sn',name:'Senegal',flag:'🇸🇳',rank:18},
    {code:'eg',name:'Ai Cập',flag:'🇪🇬',rank:34},{code:'dz',name:'Algeria',flag:'🇩🇿',rank:37},
    {code:'tn',name:'Tunisia',flag:'🇹🇳',rank:38},{code:'ng',name:'Nigeria',flag:'🇳🇬',rank:40},
    {code:'ci',name:'Bờ Biển Ngà',flag:'🇨🇮',rank:41},{code:'cm',name:'Cameroon',flag:'🇨🇲',rank:43},
    {code:'ml',name:'Mali',flag:'🇲🇱',rank:47},{code:'bf',name:'Burkina Faso',flag:'🇧🇫',rank:54},
    {code:'cd',name:'CH Dân chủ Congo',flag:'🇨🇩',rank:57},{code:'gh',name:'Ghana',flag:'🇬🇭',rank:60},
    {code:'za',name:'Nam Phi',flag:'🇿🇦',rank:61},{code:'cv',name:'Cape Verde',flag:'🇨🇻',rank:63},
    {code:'gn',name:'Guinea',flag:'🇬🇳',rank:72},{code:'bj',name:'Benin',flag:'🇧🇯',rank:78},
    {code:'ga',name:'Gabon',flag:'🇬🇦',rank:82},{code:'zm',name:'Zambia',flag:'🇿🇲',rank:85},
    {code:'ug',name:'Uganda',flag:'🇺🇬',rank:87},{code:'ao',name:'Angola',flag:'🇦🇴',rank:92},
    {code:'mr',name:'Mauritania',flag:'🇲🇷',rank:104},{code:'ke',name:'Kenya',flag:'🇰🇪',rank:103},
    {code:'mg',name:'Madagascar',flag:'🇲🇬',rank:106},{code:'gq',name:'Guinea Xích Đạo',flag:'🇬🇶',rank:108},
    {code:'mz',name:'Mozambique',flag:'🇲🇿',rank:110},{code:'ne',name:'Niger',flag:'🇳🇪',rank:123},
    {code:'sl',name:'Sierra Leone',flag:'🇸🇱',rank:119},{code:'zw',name:'Zimbabwe',flag:'🇿🇼',rank:118},
    {code:'tg',name:'Togo',flag:'🇹🇬',rank:127},{code:'sd',name:'Sudan',flag:'🇸🇩',rank:124},
    {code:'ly',name:'Libya',flag:'🇱🇾',rank:130},{code:'cg',name:'Congo',flag:'🇨🇬',rank:135},
    {code:'bw',name:'Botswana',flag:'🇧🇼',rank:140},{code:'km',name:'Comoros',flag:'🇰🇲',rank:132},
    {code:'gm',name:'Gambia',flag:'🇬🇲',rank:145},{code:'rw',name:'Rwanda',flag:'🇷🇼',rank:148},
    {code:'et',name:'Ethiopia',flag:'🇪🇹',rank:150},{code:'mw',name:'Malawi',flag:'🇲🇼',rank:152},
    {code:'cf',name:'CH Trung Phi',flag:'🇨🇫',rank:158},{code:'lr',name:'Liberia',flag:'🇱🇷',rank:160},
    {code:'sz',name:'Eswatini',flag:'🇸🇿',rank:163},{code:'ls',name:'Lesotho',flag:'🇱🇸',rank:166},
    {code:'bi',name:'Burundi',flag:'🇧🇮',rank:161},{code:'ss',name:'Nam Sudan',flag:'🇸🇸',rank:167},
    {code:'dj',name:'Djibouti',flag:'🇩🇯',rank:200},{code:'so',name:'Somalia',flag:'🇸🇴',rank:190},
    {code:'er',name:'Eritrea',flag:'🇪🇷',rank:206},{code:'sc',name:'Seychelles',flag:'🇸🇨',rank:200},
    {code:'mu',name:'Mauritius',flag:'🇲🇺',rank:190},{code:'td',name:'Chad',flag:'🇹🇩',rank:183},
  ]},
  chau_my: { name:'🌎 Châu Mỹ', list: [
    {code:'ar',name:'Argentina',flag:'🇦🇷',rank:1},{code:'br',name:'Brazil',flag:'🇧🇷',rank:3},
    {code:'co',name:'Colombia',flag:'🇨🇴',rank:12},{code:'uy',name:'Uruguay',flag:'🇺🇾',rank:14},
    {code:'us',name:'Mỹ',flag:'🇺🇸',rank:15},{code:'mx',name:'Mexico',flag:'🇲🇽',rank:16},
    {code:'ec',name:'Ecuador',flag:'🇪🇨',rank:31},{code:'pe',name:'Peru',flag:'🇵🇪',rank:32},
    {code:'pa',name:'Panama',flag:'🇵🇦',rank:33},{code:'cl',name:'Chile',flag:'🇨🇱',rank:42},
    {code:'ca',name:'Canada',flag:'🇨🇦',rank:45},{code:'py',name:'Paraguay',flag:'🇵🇾',rank:49},
    {code:'ve',name:'Venezuela',flag:'🇻🇪',rank:50},{code:'cr',name:'Costa Rica',flag:'🇨🇷',rank:52},
    {code:'jm',name:'Jamaica',flag:'🇯🇲',rank:59},{code:'cw',name:'Curaçao',flag:'🇨🇼',rank:80},
    {code:'bo',name:'Bolivia',flag:'🇧🇴',rank:78},{code:'hn',name:'Honduras',flag:'🇭🇳',rank:85},
    {code:'ht',name:'Haiti',flag:'🇭🇹',rank:87},{code:'sv',name:'El Salvador',flag:'🇸🇻',rank:90},
    {code:'gt',name:'Guatemala',flag:'🇬🇹',rank:100},{code:'tt',name:'Trinidad & Tobago',flag:'🇹🇹',rank:95},
    {code:'sr',name:'Suriname',flag:'🇸🇷',rank:110},{code:'cu',name:'Cuba',flag:'🇨🇺',rank:120},
    {code:'ni',name:'Nicaragua',flag:'🇳🇮',rank:130},{code:'do',name:'Cộng hòa Dominica',flag:'🇩🇴',rank:140},
    {code:'gy',name:'Guyana',flag:'🇬🇾',rank:150},{code:'bz',name:'Belize',flag:'🇧🇿',rank:165},
    {code:'bs',name:'Bahamas',flag:'🇧🇸',rank:180},{code:'bm',name:'Bermuda',flag:'🇧🇲',rank:170},
  ]},
};

// ============================
// TOURNAMENT CONFIGURATIONS
// ============================
const FIFA_CODE3 = {
  ad:'AND',ae:'UAE',af:'AFG',al:'ALB',am:'ARM',ao:'ANG',ar:'ARG',at:'AUT',au:'AUS',az:'AZE',
  ba:'BIH',bd:'BAN',be:'BEL',bf:'BFA',bg:'BUL',bh:'BHR',bi:'BDI',bj:'BEN',bm:'BER',bn:'BRU',
  bo:'BOL',br:'BRA',bs:'BAH',bt:'BHU',bw:'BOT',bz:'BLZ',ca:'CAN',cd:'COD',cf:'CTA',cg:'CGO',
  ch:'SUI',ci:'CIV',cl:'CHI',cm:'CMR',cn:'CHN',co:'COL',cr:'CRC',cu:'CUB',cv:'CPV',cw:'CUW',
  cy:'CYP',cz:'CZE',de:'GER',dj:'DJI',dk:'DEN',do:'DOM',dz:'ALG',ec:'ECU',ee:'EST',eg:'EGY',
  er:'ERI',es:'ESP',et:'ETH',fi:'FIN',fo:'FRO',fr:'FRA',ga:'GAB',gb:'ENG',ge:'GEO',gh:'GHA',
  gi:'GIB',gm:'GAM',gn:'GUI',gq:'EQG',gr:'GRE',gt:'GUA',gy:'GUY',hk:'HKG',hn:'HON',hr:'CRO',
  ht:'HAI',hu:'HUN',id:'IDN',ie:'IRL',il:'ISR',in:'IND',iq:'IRQ',ir:'IRN',is:'ISL',it:'ITA',
  jm:'JAM',jo:'JOR',jp:'JPN',ke:'KEN',kg:'KGZ',kh:'CAM',km:'COM',kp:'PRK',kr:'KOR',la:'LAO',
  lb:'LIB',lk:'SRI',lr:'LBR',ls:'LES',lt:'LTU',lu:'LUX',lv:'LVA',ly:'LBY',ma:'MAR',md:'MDA',
  me:'MNE',mg:'MAD',mk:'MKD',ml:'MLI',mm:'MYA',mn:'MGL',mr:'MTN',mt:'MLT',mu:'MRI',mv:'MDV',
  mw:'MWI',mx:'MEX',my:'MAS',mz:'MOZ',ne:'NIG',ng:'NGA',ni:'NCA',nl:'NED',no:'NOR',np:'NEP',
  om:'OMA',pa:'PAN',pe:'PER',ph:'PHI',pk:'PAK',pl:'POL',ps:'PLE',pt:'POR',py:'PAR',qa:'QAT',
  ro:'ROU',rs:'SRB',rw:'RWA',sa:'KSA',sc:'SEY',sd:'SDN',se:'SWE',sg:'SGP',si:'SVN',sk:'SVK',
  sl:'SLE',sm:'SMR',sn:'SEN',so:'SOM',sr:'SUR',ss:'SSD',sv:'ESA',sy:'SYR',sz:'SWZ',td:'CHA',
  tg:'TOG',th:'THA',tj:'TJK',tl:'TLS',tm:'TKM',tn:'TUN',tr:'TUR',tt:'TRI',tw:'TPE',ua:'UKR',
  ug:'UGA',us:'USA',uy:'URU',uz:'UZB',ve:'VEN',vn:'VIE',xk:'KVX',ye:'YEM',za:'RSA',zm:'ZAM',
  zw:'ZIM',
};
function abbr3(team){
  return (team && FIFA_CODE3[team.code]) || (team ? team.name.slice(0,3).toUpperCase() : '');
}

const TOURNAMENT_CONFIGS = {
  worldcup: {
    id:'worldcup', name:'FIFA WC', icon:'🏆', region:null,
    teamCount:16, groups:8, advancePerGroup:2,
    knockoutRoundNames:['Vòng 16 đội','Tứ kết','Bán kết','Chung kết'],
    pointsWin:500, pointsLose:100,
  },
  euro: {
    id:'euro', name:'Euro', icon:'🇪🇺', region:'chau_eu',
    teamCount:16, groups:4, advancePerGroup:2,
    knockoutRoundNames:['Tứ kết','Bán kết','Chung kết'],
    pointsWin:400, pointsLose:80,
  },
  copa: {
    id:'copa', name:'Copa A', icon:'🌎', region:'chau_my',
    teamCount:16, groups:4, advancePerGroup:2,
    knockoutRoundNames:['Tứ kết','Bán kết','Chung kết'],
    pointsWin:400, pointsLose:80,
  },
  afcon: {
    id:'afcon', name:'CAN', icon:'🌍', region:'chau_phi',
    teamCount:16, groups:4, advancePerGroup:2,
    knockoutRoundNames:['Tứ kết','Bán kết','Chung kết'],
    pointsWin:400, pointsLose:80,
  },
  asiancup: {
    id:'asiancup', name:'AFC', icon:'🌏', region:'chau_a',
    teamCount:16, groups:4, advancePerGroup:2,
    knockoutRoundNames:['Tứ kết','Bán kết','Chung kết'],
    pointsWin:400, pointsLose:80,
  },
};

const CUP_TOURNAMENTS = Object.values(TOURNAMENT_CONFIGS);

// ============================
// LEAGUE CONFIGURATIONS (5 giải)
// ============================
const LEAGUE_CONFIGS = {
  world: {
    id:'world', name:'World', icon:'🌐', region:null,
    teamCount:8, pointsWin:200, pointsDraw:80, pointsLose:50,
  },
  eu: {
    id:'eu', name:'EU', icon:'🇪🇺', region:'chau_eu',
    teamCount:8, pointsWin:180, pointsDraw:70, pointsLose:40,
  },
  copa: {
    id:'copa', name:'America', icon:'🌎', region:'chau_my',
    teamCount:8, pointsWin:180, pointsDraw:70, pointsLose:40,
  },
  africa: {
    id:'africa', name:'African', icon:'🌍', region:'chau_phi',
    teamCount:8, pointsWin:180, pointsDraw:70, pointsLose:40,
  },
  asia: {
    id:'asia', name:'Asian', icon:'🌏', region:'chau_a',
    teamCount:8, pointsWin:180, pointsDraw:70, pointsLose:40,
  },
};
const LEAGUE_LIST = Object.values(LEAGUE_CONFIGS);

// Circle-method round-robin: trả về mảng các vòng, mỗi vòng là mảng cặp đấu {home,away,result}
// Đảm bảo mỗi đội đá đúng 1 trận/vòng, và mọi cặp gặp nhau đúng 1 lần.
function buildRoundRobin(n){
  let arr=[...Array(n).keys()];
  const hasBye = n%2!==0;
  if(hasBye) arr.push(-1);
  const total=arr.length;
  const numRounds=total-1;
  const half=total/2;
  const rounds=[];
  for(let r=0;r<numRounds;r++){
    const round=[];
    for(let i=0;i<half;i++){
      const a=arr[i],b=arr[total-1-i];
      if(a!==-1&&b!==-1){
        round.push(r%2===0?{home:a,away:b,result:null}:{home:b,away:a,result:null});
      }
    }
    rounds.push(round);
    const fixed=arr[0];
    const rest=arr.slice(1);
    rest.unshift(rest.pop());
    arr=[fixed,...rest];
  }
  return rounds;
}

const MODES = [
  { id:'nhanh',  name:'Giao hữu', icon:'⚡', desc:'Đá 1 trận',        label:'Đá Penalty!' },
  { id:'league', name:'League', icon:'📊', desc:'Đấu bảng xếp hạng', label:'Bắt đầu League!' },
  { id:'cup',    name:'Cúp',    icon:'🏆', desc:'Đấu loại trực tiếp', label:'Bắt đầu Cúp!' },
];

const ZONES = ['top-left','top-center','top-right','mid-left','mid-center','mid-right','bot-left','bot-center','bot-right'];
const AI_ACCURACY = 0.35;
// Mỗi giải (League hoặc Cup) có tiến trình lưu riêng biệt theo configId
// → 5 League + 5 Cup = 10 tiến trình độc lập, không đè lên nhau.
function saveKeyFor(mode, configId){
  if(mode==='league') return 'vt_penalty_save_league_'+(configId||'world')+'_v1';
  if(mode==='cup') return 'vt_penalty_save_cup_'+(configId||'worldcup')+'_v1';
  return null;
}

// ============================
// HELPERS
// ============================
function shuffle(a){for(let i=a.length-1;i>0;i--){let j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
function getAllCountries(){const a=[];for(const r of Object.values(COUNTRIES))a.push(...r.list);return a}
function getRegionCountries(region){return region?COUNTRIES[region]?.list||[]:getAllCountries()}
function countryByCode(code){for(const r of Object.values(COUNTRIES)){const f=r.list.find(c=>c.code===code);if(f)return f}return null}
// Lấy N đội mạnh nhất (rank FIFA thấp = mạnh hơn) từ 1 pool, loại trừ 1 mã quốc gia
function getTopCountries(pool, n, excludeCode){
  return pool.filter(c=>c.code!==excludeCode).slice().sort((a,b)=>(a.rank||999)-(b.rank||999)).slice(0,n);
}

// Flag SVG helper — uses flagcdn.com free CDN
function flagImg(code, name, size) {
  if (!code || code.startsWith('gen_')) return '🏳️';
  const s = size || 20;
  return `<img src="https://flagcdn.com/${code}.svg" alt="${name||code}" class="pt-flag-svg" style="width:${s}px;height:auto;vertical-align:middle;" loading="lazy"/>`;
}

// Simulate an AI-vs-AI penalty match → returns [goals_home, goals_away]
// Realistic: 3-5 penalties each, scores range 2-5
function simAIPenalty() {
  const base = 2;
  const h = base + Math.floor(Math.random() * 4); // 2-5
  const a = base + Math.floor(Math.random() * 4); // 2-5
  return [h, a];
}

// Khi người chơi vừa đá xong 1 trận, scoreboard trong game luôn là [điểm mình, điểm đối thủ]
// — nhưng lịch đấu có thể xếp mình là "away". Hàm này quy đổi về đúng [homeGoals, awayGoals]
// để mọi logic thắng/thua/BXH phía sau (vốn đọc result[0]=home, result[1]=away) luôn chính xác.
function orientMatchScore(fixture, playerGoals, oppGoals){
  return fixture.home===0 ? [playerGoals, oppGoals] : [oppGoals, playerGoals];
}

// ============================
// GAME CLASS
// ============================
class PenaltyGame {
  constructor() {
    this.state = {
      modeId: 'nhanh',
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
    };
    this._init();
  }

  _init() {
    onAuthStateChanged(auth, u=>{
      if(!u){location.href='../../index.html';return}
      this.renderModes(); this.renderTournaments(); this.renderLeagues(); this.renderFlags(); this.bindEvents(); this.showMenu();
    });
  }

  randomCountry(excludeCode) {
    const all=getAllCountries();
    let c;
    do{c=all[Math.floor(Math.random()*all.length)]}while(c.code===excludeCode);
    return c;
  }

  // ===== RENDER UI =====
  renderModes() {
    const c=document.getElementById('pt-mode-row');
    c.innerHTML=MODES.map((m,i)=>`<button class="pt-mode-btn ${i===0?'selected':''}" data-mode="${m.id}">
      <span class="mode-label">${m.name}</span>
    </button>`).join('');
  }

  renderTournaments() {
    const c=document.getElementById('pt-tournament-row');
    c.innerHTML=CUP_TOURNAMENTS.map((t,i)=>`<button class="pt-tournament-btn ${i===0?'selected':''}" data-id="${t.id}">${t.icon} ${t.name}</button>`).join('');
  }

  renderLeagues() {
    const c=document.getElementById('pt-league-row');
    if(!c)return;
    c.innerHTML=LEAGUE_LIST.map((l,i)=>`<button class="pt-tournament-btn ${i===0?'selected':''}" data-id="${l.id}">${l.icon} ${l.name}</button>`).join('');
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
      countries=lg&&lg.region?getRegionCountries(lg.region):getAllCountries();
    }else{
      countries=getAllCountries();
    }
    if(!countries.find(x=>x.code===this.state.playerCountry.code)){
      this.state.playerCountry=countries[0]||getAllCountries()[0];
      this.state.aiCountry=this.randomCountry(this.state.playerCountry.code);
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
    c.innerHTML=html || `<div class="pt-flag-empty">Không tìm thấy quốc gia</div>`;
    // Update country picker
    this._updateCountryPicker();
  }

  _updateCountryPicker(){
    const flag=document.getElementById('pt-country-flag');
    const name=document.getElementById('pt-country-name');
    if(!flag||!name)return;
    const pc=this.state.playerCountry;
    flag.innerHTML=`<img src="https://flagcdn.com/${pc.code}.svg" alt="${pc.name}" class="pt-flag-svg" style="width:32px;height:auto;vertical-align:middle"/>`;
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

    // Tournaments
    document.getElementById('pt-tournament-row').addEventListener('click',e=>{
      const b=e.target.closest('.pt-tournament-btn');if(!b)return;
      document.querySelectorAll('#pt-tournament-row .pt-tournament-btn').forEach(x=>x.classList.remove('selected'));b.classList.add('selected');
      this.state.tournament=CUP_TOURNAMENTS.find(t=>t.id===b.dataset.id)||CUP_TOURNAMENTS[0];
      if(this.state.modeId==='cup'){this.renderFlags();this._updateContinueCard();this._updatePlayButton();}
    });

    // Leagues
    const lgRow=document.getElementById('pt-league-row');
    if(lgRow)lgRow.addEventListener('click',e=>{
      const b=e.target.closest('.pt-tournament-btn');if(!b)return;
      document.querySelectorAll('#pt-league-row .pt-tournament-btn').forEach(x=>x.classList.remove('selected'));b.classList.add('selected');
      this.state.league=LEAGUE_LIST.find(l=>l.id===b.dataset.id)||LEAGUE_LIST[0];
      if(this.state.modeId==='league'){this.renderFlags();this._updateContinueCard();this._updatePlayButton();}
    });

    // Flags (in modal)
    document.getElementById('pt-flag-grid').addEventListener('click',e=>{
      const b=e.target.closest('.pt-flag-btn');if(!b)return;
      document.querySelectorAll('.pt-flag-btn').forEach(x=>x.classList.remove('selected'));b.classList.add('selected');
      const found=countryByCode(b.dataset.code);
      if(found){
        this.state.playerCountry=found;
        this.state.aiCountry=this.randomCountry(found.code);
        this._updateCountryPicker();
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

    setTimeout(()=>{
      if(window.TopNav?.setLeaveAction)window.TopNav.setLeaveAction(()=>this.showScreen('pt-menu'));
    },100);
  }

  // ===== MENU / SCREEN CONTROL =====
  showMenu(){
    ['pt-menu','pt-game','pt-league-view','pt-cup-group-view','pt-cup-transition','pt-cup-knockout-view'].forEach(id=>{
      const e=document.getElementById(id);
      if(e){e.classList.toggle('active',id==='pt-menu');e.style.display=id==='pt-menu'?'':'none'}
    });
    document.getElementById('pt-result-overlay').style.display='none';
    document.getElementById('pt-match-info').style.display='none';
    this._updateContinueCard();
    this._updatePlayButton();
  }

  showScreen(id){
    ['pt-menu','pt-game','pt-league-view','pt-cup-group-view','pt-cup-transition','pt-cup-knockout-view'].forEach(x=>{
      const e=document.getElementById(x);
      if(!e)return;
      e.classList.toggle('active',x===id);
      e.style.display=x===id?'':'none';
    });
    document.getElementById('pt-result-overlay').style.display='none';
  }

  showMatch(opponent,label, context){
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
    document.getElementById('pt-actions').style.display='none';
    document.getElementById('pt-match-done-btn').style.display='none';
    this.renderStatusBar();
    this.startRound();
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
    const pool=config.region?getRegionCountries(config.region):getAllCountries();
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
      window.showToast(`⚡ ${flagImg(home.code, home.name)} ${home.name} ${h}-${a} ${flagImg(away.code, away.name)} ${away.name}`,'info');
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
      window.showToast(`⚽ Bảng ${group.name}: ${flagImg(teams[match.home].code, teams[match.home].name)} ${teams[match.home].name} ${hGoal}-${aGoal} ${flagImg(teams[match.away].code, teams[match.away].name)} ${teams[match.away].name}`, 'info');
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
          window.showToast(`🏟️ ${rounds[r].name}: ${flagImg(home.code, home.name)} ${home.name} ${hGoal}-${aGoal} ${flagImg(away.code, away.name)} ${away.name}`, 'info');
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
      window.showToast(`🏆 Chức vô địch ${config.name} thuộc về ${flagImg(teams[0].code, teams[0].name)} ${teams[0].name}!`, 'success');
    }
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
    this._resetBall();
    document.getElementById('pt-actions').style.display='none';
    document.getElementById('pt-match-done-btn').style.display='none';
    this.renderStatusBar();
  }

  playerShoot(zoneId){
    if(this.state.shotLocked)return;
    this.state.shotLocked=true;
    const aiZone=this.aiPickZone();
    const isGoal=zoneId!==aiZone;
    this.animateShot(zoneId,aiZone,isGoal);
    const result=isGoal?'goal':'saved';
    this.state.history.push({shooter:this.state.currentShooter,zone:zoneId,target:aiZone,result});
    if(isGoal)this.state.scores[0]++;
    this.renderStatusBar();

    setTimeout(()=>{
      if(!this.state.is2Player){
        // AI's turn — player gets to defend!
        this.state.currentShooter='ai';
        this.state._pendingAiZone=this.aiPickZone();  // AI secretly picks target
        this.state.phase='defending';
        this.state.shotLocked=false;
        this.resetKeeperPos();
        this.renderStatusBar();
        // Zone click will call playerDefend()
      }else{
        this.resetKeeperPos();
        this.afterShotDone();
      }
    },1700);
  }

  // Player chooses where the keeper dives
  playerDefend(zoneId){
    if(this.state.shotLocked)return;
    this.state.shotLocked=true;
    const aiZone=this.state._pendingAiZone||this.aiPickZone();
    const playerDive=zoneId;
    const isGoal=playerDive!==aiZone;  // Player chose wrong zone → goal
    this.animateAIShot(aiZone,playerDive,isGoal);
    const result=isGoal?'goal':'saved';
    this.state.history.push({shooter:'ai',zone:aiZone,target:playerDive,result});
    if(isGoal)this.state.scores[1]++;
    this.renderStatusBar();
    setTimeout(()=>this.afterShotDone(),1700);
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
      window.showToast('⚽ Bước vào loạt luân lưu tử thần!','info');
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
      const pts=isWin?50:isDraw?20:10;
      addPoints('Penalty',isWin?'Thắng penalty':isDraw?'Hòa penalty':'Thua penalty',pts).catch(()=>{});
      if(window.VTQuests)window.VTQuests.trackPlay('penalty');
    }
  }

  _displayResultOverlay(){
    document.getElementById('pt-result-overlay').style.display='';
    document.getElementById('pt-actions').style.display='none';
    document.getElementById('pt-match-done-btn').style.display='none';
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

  animateShot(zoneId,aiZone,isGoal){
    const zones=document.querySelectorAll('.pt-zone');
    zones.forEach(z=>z.classList.remove('zone-shot','zone-save','zone-goal','zone-keeper-save'));
    // Thủ môn (đội bạn) bay ngay khi bóng được sút, không đợi bóng bay xong
    const keeper=document.getElementById('pt-keeper');
    if(keeper){keeper.classList.remove('mine');keeper.classList.add('theirs');}
    this._keeperDive(aiZone,isGoal&&zoneId!==aiZone?'diving':'save');
    this._animateBallToZone(zoneId,()=>{
      const el=document.querySelector(`[data-zone="${zoneId}"]`);
      if(el){el.classList.add(isGoal?'zone-goal':'zone-shot');if(!isGoal)setTimeout(()=>el.classList.add('zone-save'),300)}
      // Show 🧤 in save zone
      if(!isGoal){
        const saveEl=document.querySelector(`[data-zone="${aiZone}"]`);
        if(saveEl)setTimeout(()=>{saveEl.classList.remove('zone-shot','zone-save','zone-goal');saveEl.classList.add('zone-keeper-save')},400);
      }
      this.showShotResultBanner(isGoal,'mine');
    },'mine');
  }

  animateAIShot(zoneId,saveZone,isGoal){
    const zones=document.querySelectorAll('.pt-zone');
    zones.forEach(z=>z.classList.remove('zone-shot','zone-save','zone-goal','zone-keeper-save'));
    // Thủ môn (đội mình) bay ngay khi bóng được sút, không đợi bóng bay xong
    const keeper=document.getElementById('pt-keeper');
    if(keeper){keeper.classList.remove('theirs');keeper.classList.add('mine');}
    this._keeperDive(saveZone,isGoal?'diving':'save');
    this._animateBallToZone(zoneId,()=>{
      const el=document.querySelector(`[data-zone="${zoneId}"]`);
      if(el){el.classList.add(isGoal?'zone-goal':'zone-shot');if(!isGoal)setTimeout(()=>el.classList.add('zone-save'),300)}
      // Show 🧤 in save zone
      if(!isGoal){
        const saveEl=document.querySelector(`[data-zone="${saveZone}"]`);
        if(saveEl)setTimeout(()=>{saveEl.classList.remove('zone-shot','zone-save','zone-goal');saveEl.classList.add('zone-keeper-save')},400);
      }
      this.showShotResultBanner(isGoal,'theirs');
    },'theirs');
  }

  // Reset ball to penalty spot position
  _resetBall(){
    const ball=document.getElementById('pt-ball');
    if(!ball)return;
    const pitch=document.getElementById('pt-pitch');
    if(!pitch)return;
    const pRect=pitch.getBoundingClientRect();
    if(pRect.width===0)return;
    ball.style.transition='none';
    ball.style.left=(pRect.width/2)+'px';
    ball.style.top=(pRect.height*0.9-6)+'px';
    ball.style.transform='scale(1) rotate(0deg)';
    ball.style.opacity='1';
    ball.style.display='';
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
      setTimeout(()=>s.remove(),420);
    });
  }

  // Animate ball from penalty spot to target zone
  _animateBallToZone(zoneId, callback, team){
    const ball=document.getElementById('pt-ball');
    if(!ball)return callback();
    const pitch=document.getElementById('pt-pitch');
    const zone=document.querySelector(`[data-zone="${zoneId}"]`);
    if(!zone||!pitch)return callback();

    const pRect=pitch.getBoundingClientRect();
    const zRect=zone.getBoundingClientRect();
    // Ball starts at bottom-center of pitch (penalty spot)
    const startX=pRect.width/2;
    const startY=pRect.height*0.9-6;
    // Target: center of the zone
    const endX=zRect.left-pRect.left+zRect.width/2;
    const endY=zRect.top-pRect.top+zRect.height/2;
    const angleDeg=Math.atan2(endY-startY,endX-startX)*180/Math.PI;

    // Reset position
    ball.style.left=startX+'px';
    ball.style.top=startY+'px';
    ball.style.opacity='1';
    ball.style.transform='scale(1) rotate(0deg)';
    ball.style.transition='none';
    ball.style.display='';
    void ball.offsetWidth;

    // Fly to target with cubic-bezier for realistic arc
    const flightMs=500;
    ball.style.transition=`left ${flightMs}ms cubic-bezier(0.25,0.46,0.45,0.94), top ${flightMs}ms cubic-bezier(0.25,0.1,0.25,1), transform 0.4s ease-out, opacity 0.5s`;
    ball.style.left=endX+'px';
    ball.style.top=endY+'px';
    ball.style.transform='scale(1.3) rotate(720deg)';

    // Rắc vệt gió dọc đường bay trong lúc bóng di chuyển
    const t0=performance.now();
    const windTimer=setInterval(()=>{
      const t=Math.min(1,(performance.now()-t0)/flightMs);
      this._spawnWindStreak(pitch,startX+(endX-startX)*t,startY+(endY-startY)*t,angleDeg,team);
      if(t>=1)clearInterval(windTimer);
    },32);

    setTimeout(()=>{
      ball.style.opacity='0';
      callback();
    },520);
  }

  _keeperDive(zone,cls){
    const keeper=document.getElementById('pt-keeper');
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
    // Bỏ transition "all" của trạng thái nghỉ để animation keyframe dưới đây
    // toàn quyền điều khiển transform — tránh 2 nguồn cùng ghi đè gây giật.
    keeper.style.transition='none';
    keeper.style.setProperty('--dx',kx+'px');keeper.style.setProperty('--dy',ky+'px');
    keeper.classList.remove('diving','save');void keeper.offsetWidth;
    keeper.classList.add(cls);
  }

  resetKeeperPos(){
    const k=document.getElementById('pt-keeper');
    k.classList.remove('diving','save');
    k.style.transition='transform 0.5s cubic-bezier(0.34,1.56,0.64,1)';
    k.style.transform='translate(0,0)';k.style.setProperty('--dx','0px');k.style.setProperty('--dy','0px');
  }

  // ===== RENDER — Status Bar with 5-shot circles =====
  renderStatusBar(){
    const pc=this.state.playerCountry,ac=this.state.aiCountry;
    // Flags + names
    document.getElementById('pt-sb-pflag').innerHTML=flagImg(pc.code, pc.name, 24);
    document.getElementById('pt-sb-pname').textContent=pc.name;
    document.getElementById('pt-sb-aflag').innerHTML=flagImg(ac.code, ac.name, 24);
    document.getElementById('pt-sb-aname').textContent=ac.name;
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
  saveProgress(){
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
    try{localStorage.removeItem(key)}catch(e){}
  }

  restoreProgress(mode, configId){
    const d=this.loadProgress(mode, configId);
    if(!d||!d._mode)return false;
    Object.assign(this.state,{
      modeId:d.modeId, playerCountry:d.playerCountry, aiCountry:d.aiCountry,
      tournament: d.tournamentId ? (TOURNAMENT_CONFIGS[d.tournamentId]||this.state.tournament) : this.state.tournament,
      league: d.leagueId ? (LEAGUE_CONFIGS[d.leagueId]||this.state.league) : this.state.league,
      is2Player:d.is2Player,
      round:d.round, maxRounds:d.maxRounds, scores:d.scores, history:d.history,
      currentShooter:d.currentShooter, phase:d.phase, _pendingAiZone:d._pendingAiZone,
      shotLocked:false,
      leagueTeams:d.leagueTeams, leagueTable:d.leagueTable,
      leagueRounds:d.leagueRounds||[], leagueRoundIdx:d.leagueRoundIdx||0,
      cupConfig: d.cupConfigId ? (TOURNAMENT_CONFIGS[d.cupConfigId]||null) : null,
      cupTeams:d.cupTeams, cupGroups:d.cupGroups, cupGroupMatchQueue:d.cupGroupMatchQueue,
      cupGroupMatchPtr:d.cupGroupMatchPtr, cupQualifiers:d.cupQualifiers, cupPhase:d.cupPhase,
      cupKnockoutRounds:d.cupKnockoutRounds, cupKnockoutMatchPtr:d.cupKnockoutMatchPtr,
      cupKnockoutDisplayRoundIdx:d.cupKnockoutDisplayRoundIdx,
      _mode:d._mode, _matchContext:d._matchContext, _matchLabel:d._matchLabel,
      _lastMatchResult:d._lastMatchResult, _lastMatchScore:d._lastMatchScore,
    });

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
      const modeName = mode==='league' ? `${(LEAGUE_CONFIGS[configId]||{}).icon||'📊'} ${(LEAGUE_CONFIGS[configId]||{}).name||'League'}` : `🏆 ${(TOURNAMENT_CONFIGS[configId]||{}).name||'Cúp'}`;
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
        const cfgName = mode==='league' ? (LEAGUE_CONFIGS[configId]||{}).name : (TOURNAMENT_CONFIGS[configId]||{}).name;
        label=`▶️ Tiếp tục ${cfgName||''} (${sc[0]}-${sc[1]})`;
      }
    }
    btn.innerHTML=`<svg class="pt-play-icon" viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M8 5v14l11-7z"/></svg><span>${label}</span>`;
    btn.dataset.continue=hasContinue?'1':'';
  }


  // ===== NEW MATCH (Đá lại) =====
  newMatch(){
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

const penaltyGame=new PenaltyGame();
window.penaltyGame=penaltyGame;