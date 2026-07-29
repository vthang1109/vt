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
    teamCount:32, groups:8, advancePerGroup:2,
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

// Trích màu chủ đạo từ lá cờ quốc gia (dùng cho màu áo/quần cầu thủ)
// Bảng màu áo SÂN NHÀ thực tế của các đội tuyển phổ biến (ưu tiên dùng thay vì suy ra từ cờ).
// primary = màu áo, secondary = màu quần. Đội không có trong bảng sẽ fallback sang trích màu cờ.
const KIT_COLORS = {
  // Châu Á
  jp:{primary:'#001c58',secondary:'#001c58'}, kr:{primary:'#c8102e',secondary:'#c8102e'},
  ir:{primary:'#ffffff',secondary:'#ffffff'}, au:{primary:'#ffd400',secondary:'#00843d'},
  sa:{primary:'#2f7d32',secondary:'#ffffff'}, qa:{primary:'#8a1538',secondary:'#ffffff'},
  iq:{primary:'#ffffff',secondary:'#ffffff'}, ae:{primary:'#ffffff',secondary:'#ffffff'},
  uz:{primary:'#ffffff',secondary:'#1e3a8a'}, jo:{primary:'#ffffff',secondary:'#ffffff'},
  cn:{primary:'#dd2727',secondary:'#dd2727'}, vn:{primary:'#dc2626',secondary:'#dc2626'},
  th:{primary:'#1e3a8a',secondary:'#ffffff'}, in:{primary:'#1e40af',secondary:'#1e40af'},
  id:{primary:'#dc2626',secondary:'#dc2626'}, my:{primary:'#ffd400',secondary:'#000000'},
  ph:{primary:'#0038a8',secondary:'#0038a8'}, sg:{primary:'#dc2626',secondary:'#dc2626'},
  kp:{primary:'#dc2626',secondary:'#dc2626'},
  // Châu Âu
  fr:{primary:'#002654',secondary:'#ffffff'}, be:{primary:'#dc143c',secondary:'#000000'},
  gb:{primary:'#ffffff',secondary:'#1e3a8a'}, pt:{primary:'#a4123f',secondary:'#046a38'},
  nl:{primary:'#ff6a13',secondary:'#ffffff'}, es:{primary:'#c60b1e',secondary:'#1e3a8a'},
  it:{primary:'#004c9a',secondary:'#ffffff'}, hr:{primary:'#dc2626',secondary:'#ffffff'},
  de:{primary:'#ffffff',secondary:'#000000',socks:'#ffffff'}, ua:{primary:'#ffd400',secondary:'#1e3a8a'},
  ch:{primary:'#dc2626',secondary:'#ffffff'}, dk:{primary:'#dc2626',secondary:'#ffffff'},
  at:{primary:'#dc2626',secondary:'#ffffff'}, se:{primary:'#ffd400',secondary:'#1e3a8a'},
  'gb-wls':{primary:'#dc2626',secondary:'#dc2626'}, pl:{primary:'#ffffff',secondary:'#dc2626'},
  tr:{primary:'#dc2626',secondary:'#ffffff'}, no:{primary:'#dc2626',secondary:'#ffffff'},
  rs:{primary:'#dc2626',secondary:'#1e3a8a'}, 'gb-sct':{primary:'#00205b',secondary:'#00205b'},
  hu:{primary:'#dc2626',secondary:'#ffffff'}, cz:{primary:'#dc2626',secondary:'#1e3a8a'},
  fi:{primary:'#ffffff',secondary:'#1e3a8a'}, gr:{primary:'#0d5eaf',secondary:'#ffffff'},
  ro:{primary:'#ffd400',secondary:'#1e3a8a'}, sk:{primary:'#1e3a8a',secondary:'#1e3a8a'},
  si:{primary:'#ffffff',secondary:'#ffffff'}, ie:{primary:'#0d7a3f',secondary:'#ffffff'},
  is:{primary:'#1e3a8a',secondary:'#ffffff'}, ba:{primary:'#1e3a8a',secondary:'#ffd400'},
  al:{primary:'#dc2626',secondary:'#dc2626'}, bg:{primary:'#ffffff',secondary:'#046a38'},
  il:{primary:'#ffffff',secondary:'#1e3a8a'},
  // Châu Phi
  ma:{primary:'#dc2626',secondary:'#046a38'}, sn:{primary:'#ffffff',secondary:'#046a38'},
  eg:{primary:'#dc2626',secondary:'#000000'}, dz:{primary:'#ffffff',secondary:'#ffffff'},
  tn:{primary:'#dc2626',secondary:'#ffffff'}, ng:{primary:'#046a38',secondary:'#ffffff'},
  ci:{primary:'#ff8200',secondary:'#ffffff'}, cm:{primary:'#046a38',secondary:'#dc2626'},
  gh:{primary:'#ffffff',secondary:'#000000'}, za:{primary:'#ffd400',secondary:'#046a38'},
  // Châu Mỹ
  ar:{primary:'#75aadb',secondary:'#000000'}, br:{primary:'#ffd400',secondary:'#1e3a8a'},
  co:{primary:'#ffd400',secondary:'#1e3a8a'}, uy:{primary:'#7ec4e8',secondary:'#000000'},
  us:{primary:'#ffffff',secondary:'#1e3a8a'}, mx:{primary:'#046a38',secondary:'#ffffff'},
  ec:{primary:'#ffd400',secondary:'#1e3a8a'}, pe:{primary:'#ffffff',secondary:'#ffffff'},
  pa:{primary:'#dc2626',secondary:'#1e3a8a'}, cl:{primary:'#dc2626',secondary:'#1e3a8a'},
  ca:{primary:'#dc2626',secondary:'#dc2626'}, py:{primary:'#dc2626',secondary:'#1e3a8a'},
  ve:{primary:'#7b1c3d',secondary:'#ffffff'}, cr:{primary:'#dc2626',secondary:'#1e3a8a'},
  jm:{primary:'#000000',secondary:'#000000'},
};
const flagColorCache = {};
function getFlagColors(code){
  if(flagColorCache[code]) return Promise.resolve(flagColorCache[code]);
  if(KIT_COLORS[code]){
    const k=KIT_COLORS[code];
    const result={primary:k.primary,secondary:k.secondary,socks:k.socks||k.secondary,tertiary:k.secondary,hasWhite:k.secondary==='#ffffff'};
    flagColorCache[code]=result;
    return Promise.resolve(result);
  }
  return new Promise((resolve)=>{
    const img=new Image();
    img.crossOrigin='anonymous';
    img.onload=()=>{
      const canvas=document.createElement('canvas');
      canvas.width=img.width;canvas.height=img.height;
      const ctx=canvas.getContext('2d');
      ctx.drawImage(img,0,0);
      let data;
      try{ data=ctx.getImageData(0,0,canvas.width,canvas.height).data; }
      catch(e){ const fb={primary:'#dc2626',secondary:'#1e3a8a',socks:'#1e3a8a',tertiary:'#ffffff'}; flagColorCache[code]=fb; resolve(fb); return; }
      const buckets={};
      let totalPx=0, whitePx=0;
      for(let i=0;i<data.length;i+=4){
        const r=data[i],g=data[i+1],b=data[i+2],a=data[i+3];
        if(a<200) continue;
        totalPx++;
        const brightness=(r+g+b)/3;
        if(brightness>232){ whitePx++; continue; } // đếm riêng để biết cờ có mảng trắng hay không
        if(brightness<40) continue; // bỏ gần đen — tránh áo/quần bị nhuộm đen kịt do dải đen trên cờ (VD: Đức, Bỉ)
        const key=`${Math.round(r/32)*32},${Math.round(g/32)*32},${Math.round(b/32)*32}`;
        buckets[key]=(buckets[key]||0)+1;
      }
      // Cờ có mảng trắng đáng kể (>=6% diện tích) → quần lấy màu trắng
      const hasWhite = totalPx>0 && (whitePx/totalPx)>=0.06;
      const sorted=Object.entries(buckets).sort((a,b)=>b[1]-a[1]);
      const toHex=(str)=>{const [r,g,b]=str.split(',').map(Number);return '#'+[r,g,b].map(v=>v.toString(16).padStart(2,'0')).join('');};
      // Đảm bảo màu không quá tối khi lên áo (nếu không sẽ ăn màu đen kịt dù đã lọc bucket đen ở trên,
      // vì bucket làm tròn /32 vẫn có thể ra màu rất tối, VD (32,32,0)).
      const ensureNotTooDark=(hex)=>{
        const {r,g,b}=_hexToRgb(hex);
        const [h,s,l]=_rgbToHsl(r,g,b);
        if(l>=0.28) return hex;
        const [nr,ng,nb]=_hslToRgb(h, Math.max(s,0.55), 0.4);
        return '#'+[nr,ng,nb].map(v=>v.toString(16).padStart(2,'0')).join('');
      };
      // Áo: luôn là màu chủ đạo (đậm nhất, không trắng/đen) của lá cờ
      const primary=ensureNotTooDark(sorted[0]?toHex(sorted[0][0]):'#dc2626');
      // Quần: trắng nếu cờ có trắng, không thì dùng lại chính màu chủ đạo (đồng bộ cả bộ, không tự bịa màu phụ)
      const secondary = hasWhite ? '#ffffff' : primary;
      const tertiary=sorted[1]?toHex(sorted[1][0]):secondary;
      const result={primary,secondary,socks:secondary,tertiary,hasWhite};
      flagColorCache[code]=result;
      resolve(result);
    };
    img.onerror=()=>{
      const fb={primary:'#dc2626',secondary:'#ffffff',socks:'#ffffff',tertiary:'#1e3a8a'};
      flagColorCache[code]=fb; resolve(fb);
    };
    img.src=`https://flagcdn.com/w40/${code}.png`;
  });
}
async function applyTeamKit(el, countryCode){
  const {primary, secondary} = await getFlagColors(countryCode);
  el.style.setProperty('--team-color', primary);
  el.style.setProperty('--team-shorts-color', secondary);
}

const ZONES = ['top-left','top-center','top-right','mid-left','mid-center','mid-right','bot-left','bot-center','bot-right'];

// Ảnh gốc cầu thủ + mask áo/quần tương ứng (dùng để nhuộm màu theo cờ đội).
// Nhuộm màu được thực hiện bằng canvas (đổi pixel thật sự rồi gán vào src ảnh),
// KHÔNG dùng CSS mask-image/mix-blend-mode vì 2 thuộc tính này không được hỗ trợ
// ổn định trên các WebView nhúng (Zalo, Facebook in-app browser, WebView Android cũ...).
// mask   = vùng ÁO (nhuộm bằng màu primary của cờ)
// mask2  = vùng QUẦN (nhuộm bằng màu secondary của cờ) → 2 tông rõ rệt như áo thật
// mask3 = vùng TÓC (nhuộm màu random hài hòa) · mask4 = vùng TẤT (nhuộm cùng màu secondary với quần)
const SHOOTER_POSES = {
  'mid-stand': { img:'img/player/shooter-mid-stand.png', mask:'img/player/shooter-mid-stand-kit-shirt.png',  mask2:'img/player/shooter-mid-stand-kit-shorts.png',  mask3:'img/player/shooter-mid-stand-kit-hair.png',  mask4:'img/player/shooter-mid-stand-kit-socks.png' },
  'kick':      { img:'img/player/shooter-kick.png',       mask:'img/player/shooter-kick-kit-shirt.png',       mask2:'img/player/shooter-kick-kit-shorts.png',       mask3:'img/player/shooter-kick-kit-hair.png',       mask4:'img/player/shooter-kick-kit-socks.png' },
  'celebrate': { img:'img/player/shooter-celebrate.png',  mask:'img/player/shooter-celebrate-kit-shirt.png',  mask2:'img/player/shooter-celebrate-kit-shorts.png',  mask3:'img/player/shooter-celebrate-kit-hair.png',  mask4:'img/player/shooter-celebrate-kit-socks.png' },
  'disappoint':{ img:'img/player/shooter-disappoint.png', mask:'img/player/shooter-disappoint-kit-shirt.png', mask2:'img/player/shooter-disappoint-kit-shorts.png', mask3:'img/player/shooter-disappoint-kit-hair.png', mask4:'img/player/shooter-disappoint-kit-socks.png' },
};

// Bảng màu tóc cố định — chỉ chọn ngẫu nhiên TRONG 10 màu này (không suy ra từ hue áo nữa).
const HAIR_COLOR_PALETTE = [
  '#1b1b1b', // đen
  '#4a2f1c', // nâu
  '#5d5049', // nâu lạnh (nâu tro, tông lạnh)
  '#7a4423', // nâu tây (nâu hạt dẻ ấm)
  '#12171f', // xanh dương đen
  '#d8d3c4', // bạch kim
  '#93662f', // vàng nâu
  '#3a1416', // đỏ đen
  '#341920', // hồng đen
  '#15221a', // xanh lá đen
];
// Mỗi cầu thủ (mỗi lượt sút) random 1 màu tóc riêng — KHÔNG cache theo đội nữa,
// để các cầu thủ cùng đội không bị trùng y hệt màu tóc nhau.
function pickRandomHairColor(){
  return HAIR_COLOR_PALETTE[Math.floor(Math.random()*HAIR_COLOR_PALETTE.length)];
}

// Số áo cầu thủ: chủ yếu 1-25 (đúng dải số phổ biến của đội tuyển), thỉnh
// thoảng (~12%) rơi vào vài số đặc biệt hay gặp ở đời thực (VD: 30, 80).
const JERSEY_SPECIAL_NUMBERS = [30, 80];
function randomJerseyNumber(){
  if(Math.random() < 0.12){
    return JERSEY_SPECIAL_NUMBERS[Math.floor(Math.random()*JERSEY_SPECIAL_NUMBERS.length)];
  }
  return 1 + Math.floor(Math.random()*25);
}

const _shooterImgCache = {};
function _loadImg(src){
  if(_shooterImgCache[src]) return _shooterImgCache[src];
  const p = new Promise((resolve)=>{
    const im = new Image();
    im.onload = ()=>resolve(im);
    im.onerror = ()=>{
      // Nếu 1 file mask (VD: -kit-shorts.png) load lỗi, vùng đó sẽ KHÔNG bị
      // cắt trong suốt khỏi lớp thân → màu gốc có sẵn trong ảnh nền (thường
      // là màu placeholder mặc định) sẽ lộ ra thay vì màu đội thật. Log lại
      // để dễ soi trong DevTools > Console/Network khi màu bị sai bất thường.
      console.error('[penalty] Không tải được ảnh sprite:', src);
      resolve(null);
    };
    im.src = src;
  });
  _shooterImgCache[src] = p;
  return p;
}
function _hexToRgb(hex){
  hex = (hex||'#dc2626').replace('#','');
  if(hex.length===3) hex = hex.split('').map(c=>c+c).join('');
  // LƯU Ý: không được dùng `parseInt(hex,16)||0xdc2626` — parseInt('000000',16)
  // trả về 0, mà 0 là falsy trong JS nên `0 || 0xdc2626` sẽ SAI LẦM rơi vào màu
  // fallback đỏ, khiến MỌI màu đen tuyền (#000000, VD quần Đức/Argentina) bị
  // lặng lẽ đổi thành đỏ. Phải kiểm tra NaN riêng, không dùng toán tử `||`.
  const parsed = parseInt(hex,16);
  const n = Number.isNaN(parsed) ? 0xdc2626 : parsed;
  return {r:(n>>16)&255, g:(n>>8)&255, b:n&255};
}
function _rgbToHsl(r,g,b){
  r/=255; g/=255; b/=255;
  const max=Math.max(r,g,b), min=Math.min(r,g,b);
  let h=0,s=0; const l=(max+min)/2;
  if(max!==min){
    const d=max-min;
    s = l>0.5 ? d/(2-max-min) : d/(max+min);
    if(max===r) h=(g-b)/d+(g<b?6:0);
    else if(max===g) h=(b-r)/d+2;
    else h=(r-g)/d+4;
    h/=6;
  }
  return [h,s,l];
}
function _hslToRgb(h,s,l){
  if(s===0){ const v=Math.round(l*255); return [v,v,v]; }
  const hue2rgb=(p,q,t)=>{
    if(t<0)t+=1; if(t>1)t-=1;
    if(t<1/6) return p+(q-p)*6*t;
    if(t<1/2) return q;
    if(t<2/3) return p+(q-p)*(2/3-t)*6;
    return p;
  };
  const q = l<0.5 ? l*(1+s) : l+s-l*s;
  const p = 2*l-q;
  return [Math.round(hue2rgb(p,q,h+1/3)*255), Math.round(hue2rgb(p,q,h)*255), Math.round(hue2rgb(p,q,h-1/3)*255)];
}

// Cache dữ liệu pixel gốc (ảnh + tất cả mask) theo TỪNG POSE — chỉ load/decode
// 1 lần cho mỗi pose, dùng lại cho mọi tổ hợp màu áo/tóc sau đó.
const _poseDataCache = {};
async function _getPoseData(pose){
  if(_poseDataCache[pose]) return _poseDataCache[pose];
  const p = SHOOTER_POSES[pose] || SHOOTER_POSES['mid-stand'];
  const promise = (async()=>{
    const [baseImg, maskImg, mask2Img, mask3Img, mask4Img] = await Promise.all([_loadImg(p.img), _loadImg(p.mask), _loadImg(p.mask2), _loadImg(p.mask3), _loadImg(p.mask4)]);
    if(!baseImg) return null;
    const w=baseImg.naturalWidth||500, h=baseImg.naturalHeight||700;
    const baseCanvas=document.createElement('canvas'); baseCanvas.width=w; baseCanvas.height=h;
    const bctx=baseCanvas.getContext('2d');
    bctx.drawImage(baseImg,0,0,w,h);
    let baseData;
    try{ baseData=bctx.getImageData(0,0,w,h); }
    catch(e){ return null; } // canvas bị taint (CORS)
    const readMaskAlpha=(im)=>{
      if(!im) return null;
      const mc=document.createElement('canvas'); mc.width=w; mc.height=h;
      const mctx=mc.getContext('2d'); mctx.drawImage(im,0,0,w,h);
      return mctx.getImageData(0,0,w,h).data;
    };
    return {
      w, h, bd: baseData.data,
      shirtAlpha: readMaskAlpha(maskImg),
      shortsAlpha: readMaskAlpha(mask2Img),
      hairAlpha: readMaskAlpha(mask3Img),
      socksAlpha: readMaskAlpha(mask4Img),
    };
  })();
  _poseDataCache[pose] = promise;
  return promise;
}

// Nhuộm 1 vùng mask theo 1 màu hex → trả về data URL. Tách riêng để có thể
// cache độc lập theo từng loại lớp (áo/quần/tất theo màu đội, tóc theo màu tóc)
// thay vì phải tính lại TOÀN BỘ sprite chỉ vì 1 lớp đổi màu.
function _dyeMaskLayer(poseData, maskAlphaArr, hex){
  const {w,h,bd} = poseData;
  const canvas=document.createElement('canvas'); canvas.width=w; canvas.height=h;
  const ctx=canvas.getContext('2d');
  if(!maskAlphaArr) return canvas.toDataURL('image/png');
  const {r,g,b}=_hexToRgb(hex);
  const [th,ts,tl]=_rgbToHsl(r,g,b);
  const tsBoost=Math.min(1, ts*1.15);
  let sumL=0, sumW=0;
  for(let i=0;i<bd.length;i+=4){
    const ma=maskAlphaArr[i+3]/255;
    if(ma<=0.02) continue;
    const [,,bl]=_rgbToHsl(bd[i],bd[i+1],bd[i+2]);
    sumL+=bl*ma; sumW+=ma;
  }
  const avgL = sumW>0 ? sumL/sumW : 0.80;
  const layerData=ctx.createImageData(w,h);
  const d=layerData.data;
  for(let i=0;i<bd.length;i+=4){
    const ma=maskAlphaArr[i+3]/255;
    if(ma<=0.02) continue;
    const [,,bl]=_rgbToHsl(bd[i],bd[i+1],bd[i+2]);
    let newL = tl + (bl-avgL)*0.62;
    newL = Math.max(0.22, Math.min(0.94, newL));
    const [nr,ng,nb]=_hslToRgb(th,tsBoost,newL);
    d[i]=nr; d[i+1]=ng; d[i+2]=nb; d[i+3]=Math.round(255*ma);
  }
  ctx.putImageData(layerData,0,0);
  return canvas.toDataURL('image/png');
}

const _bodyLayerCache = {};   // pose -> dataURL (không phụ thuộc màu, chỉ phụ thuộc pose)
const _teamLayerCache = {};   // pose|primary|secondary -> {shirt,shorts,socks}
const _hairLayerCache = {};   // pose|hairHex -> dataURL
// Tách sprite cầu thủ thành các lớp ảnh riêng biệt (thân, áo, quần, tất, tóc).
// Mỗi lớp cache RIÊNG theo đúng thứ nó phụ thuộc: thân chỉ phụ thuộc pose, áo/quần/tất
// phụ thuộc màu đội, tóc phụ thuộc màu tóc — nhờ vậy đổi màu tóc mỗi lượt sút KHÔNG
// còn buộc tính lại toàn bộ sprite (nguyên nhân gây giật hình lúc sút/thủ môn bay).
async function _getSplitShooterLayers(pose, primaryHex, secondaryHex, hairHex, socksHex){
  secondaryHex = secondaryHex || primaryHex;
  socksHex = socksHex || secondaryHex;
  hairHex = hairHex || pickRandomHairColor();
  const poseData = await _getPoseData(pose);
  const p = SHOOTER_POSES[pose] || SHOOTER_POSES['mid-stand'];
  const fallback = {body:p.img, hair:'', shirt:'', shorts:'', socks:''};
  if(!poseData) return fallback;

  let body;
  try{
    body = _bodyLayerCache[pose];
    if(!body){
      const {w,h,bd,shirtAlpha,shortsAlpha,hairAlpha,socksAlpha} = poseData;
      const bodyCanvas=document.createElement('canvas'); bodyCanvas.width=w; bodyCanvas.height=h;
      const bodyCtx=bodyCanvas.getContext('2d');
      const bodyData=bodyCtx.createImageData(w,h);
      const bod=bodyData.data;
      for(let i=0;i<bd.length;i+=4){
        const ma = shirtAlpha ? shirtAlpha[i+3]/255 : 0;
        const ma2 = shortsAlpha ? shortsAlpha[i+3]/255 : 0;
        const ma3 = hairAlpha ? hairAlpha[i+3]/255 : 0;
        const ma4 = socksAlpha ? socksAlpha[i+3]/255 : 0;
        const cut = Math.max(ma,ma2,ma3,ma4);
        bod[i]=bd[i]; bod[i+1]=bd[i+1]; bod[i+2]=bd[i+2];
        bod[i+3]=Math.round(bd[i+3]*(1-cut));
      }
      bodyCtx.putImageData(bodyData,0,0);
      body = bodyCanvas.toDataURL('image/png');
      _bodyLayerCache[pose] = body;
    }

    const teamKey = pose+'|'+primaryHex+'|'+secondaryHex+'|'+socksHex;
    let team = _teamLayerCache[teamKey];
    if(!team){
      team = {
        shirt: _dyeMaskLayer(poseData, poseData.shirtAlpha, primaryHex),
        shorts: _dyeMaskLayer(poseData, poseData.shortsAlpha, secondaryHex),
        socks: _dyeMaskLayer(poseData, poseData.socksAlpha, socksHex),
      };
      _teamLayerCache[teamKey] = team;
    }

    const hairKey = pose+'|'+hairHex;
    let hair = _hairLayerCache[hairKey];
    if(!hair){
      hair = _dyeMaskLayer(poseData, poseData.hairAlpha, hairHex);
      _hairLayerCache[hairKey] = hair;
    }

    return { body, hair, shirt:team.shirt, shorts:team.shorts, socks:team.socks };
  }catch(e){ return fallback; }
}
// Vẽ sprite cầu thủ ở đúng dáng (pose), nhuộm áo/quần theo màu cờ (primary/secondary)
// nếu đã biết, nếu chưa (đang chờ tải màu cờ) thì hiện ảnh gốc trước để không bị đứng hình.
async function renderShooterSprite(pose, kit, prefix){
  prefix = prefix || 'pt-shooter';
  const bodyEl=document.getElementById(prefix+'-body');
  const hairEl=document.getElementById(prefix+'-hair');
  const shirtEl=document.getElementById(prefix+'-shirt');
  const shortsEl=document.getElementById(prefix+'-shorts');
  const socksEl=document.getElementById(prefix+'-socks');
  if(!bodyEl) return;
  const p = SHOOTER_POSES[pose] || SHOOTER_POSES['mid-stand'];
  if(!kit || !kit.primary){
    bodyEl.src=p.img;
    if(hairEl) hairEl.src='';
    if(shirtEl) shirtEl.src='';
    if(shortsEl) shortsEl.src='';
    if(socksEl) socksEl.src='';
    return;
  }
  const layers = await _getSplitShooterLayers(pose, kit.primary, kit.secondary, kit.hair, kit.socks);
  bodyEl.src=layers.body;
  if(hairEl) hairEl.src=layers.hair;
  if(shirtEl) shirtEl.src=layers.shirt;
  if(shortsEl) shortsEl.src=layers.shorts;
  if(socksEl) socksEl.src=layers.socks;
}

// Ảnh thủ môn: chỉ cần 5 file gốc, trái/phải dùng chung ảnh lật gương (flip)
const GK_POSITIONS = {
  'mid-stand':  { img: 'img/gk/gk-mid-stand.png', flip: false, scale: 1 },
  'top-center': { img: 'img/gk/gk-mid-high.png',  flip: false, scale: 1.15, offsetY: 14 },
  'bot-center': { img: 'img/gk/gk-mid-low.png',   flip: false, scale: 1 },
  'mid-left':   { img: 'img/gk/gk-left-mid.png',  flip: false, scale: 1 },
  'top-left':   { img: 'img/gk/gk-left-high.png', flip: false, scale: 1 },
  'bot-left':   { img: 'img/gk/gk-left-mid.png',  flip: false, scale: 1 },
  'mid-right':  { img: 'img/gk/gk-left-mid.png',  flip: true,  scale: 1 },
  'top-right':  { img: 'img/gk/gk-left-high.png', flip: true,  scale: 1 },
  'bot-right':  { img: 'img/gk/gk-left-mid.png',  flip: true,  scale: 1 },
};
function applyKeeperSprite(keeper, zone){
  const pos = GK_POSITIONS[zone] || GK_POSITIONS['mid-stand'];
  keeper.src = pos.img;
  keeper.dataset.flip = pos.flip ? '1' : '0';
  keeper.style.setProperty('--gk-scale', pos.scale ?? 1);
}
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
    this._shooterReq = 0; // token chống race giữa 2 promise màu cờ đội nhà/đội khách
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
    getFlagColors(pc.code); getFlagColors(ac.code); // prefetch màu áo cho cả 2 đội, tránh chớp trắng ở lượt sút đầu
    // Làm nóng trước cache sprite cho các pose sẽ dùng lúc sút (kick/celebrate/
    // disappoint) ngay khi vào trận, thay vì để việc tính pixel (nặng) rơi đúng
    // vào lúc bắt đầu animation sút + thủ môn bay → đây là nguyên nhân chính
    // gây giật hình ở 2 thời điểm đó.
    [pc,ac].forEach(team=>{
      if(!team) return;
      getFlagColors(team.code).then(kit=>{
        if(!kit) return;
        ['mid-stand','kick','celebrate','disappoint'].forEach(pose=>{
          _getSplitShooterLayers(pose, kit.primary, kit.secondary, pickRandomHairColor(), kit.socks).catch(()=>{});
        });
      });
    });
    document.getElementById('pt-actions').style.display='none';
    document.getElementById('pt-match-done-btn').style.display='none';
    this.renderStatusBar();
    this._populateStandFlags([pc, ac]);
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
      el.src=`https://flagcdn.com/${team.code}.svg`;
      el.alt=team.name||'';
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
    this.resetShooterPos();
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
        this.resetShooterPos('right');
        this._resetBall();
        this.renderStatusBar();
        // Zone click will call playerDefend()
      }else{
        this.resetKeeperPos();
        this.resetShooterPos();
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
      const pts=isWin?50:isDraw?20:10;
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
    el.style.backgroundImage=`url(https://flagcdn.com/${code}.svg)`;
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
    if(kit){
      renderShooterSprite(pose, {...kit, hair:pickRandomHairColor()}, prefix);
    }else{
      renderShooterSprite(pose, null, prefix);
      getFlagColors(team.code).then(kitRaw=>{
        renderShooterSprite(pose, {...kitRaw, hair:pickRandomHairColor()}, prefix);
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
    preload.src=`https://flagcdn.com/${code}.svg`;
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
        img.src=`https://flagcdn.com/${code}.svg`;
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

  animateShot(zoneId,aiZone,isGoal){
    const zones=document.querySelectorAll('.pt-zone');
    zones.forEach(z=>z.classList.remove('zone-shot','zone-save','zone-goal','zone-keeper-save'));
    // Thủ môn (đội bạn) bay ngay khi bóng được sút, không đợi bóng bay xong
    const keeper=document.getElementById('pt-keeper');
    if(keeper){keeper.classList.remove('mine');keeper.classList.add('theirs');}
    this._keeperDive(aiZone,isGoal&&zoneId!==aiZone?'diving':'save');
    this._shooterKick();
    this._animateBallToZone(zoneId,()=>{
      const el=document.querySelector(`[data-zone="${zoneId}"]`);
      if(el){el.classList.add(isGoal?'zone-goal':'zone-shot');if(!isGoal)setTimeout(()=>el.classList.add('zone-save'),300)}
      // Show 🧤 in save zone
      if(!isGoal){
        const saveEl=document.querySelector(`[data-zone="${aiZone}"]`);
        if(saveEl)setTimeout(()=>{saveEl.classList.remove('zone-shot','zone-save','zone-goal');saveEl.classList.add('zone-keeper-save')},400);
      }
      this.showShotResultBanner(isGoal,'mine');
      this._shooterResult(isGoal);
      // Lưới rung khi bóng vào lưới
      if(isGoal) this._rippleNet();
    },'mine');
  }

  animateAIShot(zoneId,saveZone,isGoal){
    const zones=document.querySelectorAll('.pt-zone');
    zones.forEach(z=>z.classList.remove('zone-shot','zone-save','zone-goal','zone-keeper-save'));
    // Thủ môn (đội mình) bay ngay khi bóng được sút, không đợi bóng bay xong
    const keeper=document.getElementById('pt-keeper');
    if(keeper){keeper.classList.remove('theirs');keeper.classList.add('mine');}
    this._keeperDive(saveZone,isGoal?'diving':'save');
    this._shooterKick();
    this._animateBallToZone(zoneId,()=>{
      const el=document.querySelector(`[data-zone="${zoneId}"]`);
      if(el){el.classList.add(isGoal?'zone-goal':'zone-shot');if(!isGoal)setTimeout(()=>el.classList.add('zone-save'),300)}
      // Show 🧤 in save zone
      if(!isGoal){
        const saveEl=document.querySelector(`[data-zone="${saveZone}"]`);
        if(saveEl)setTimeout(()=>{saveEl.classList.remove('zone-shot','zone-save','zone-goal');saveEl.classList.add('zone-keeper-save')},400);
      }
      this.showShotResultBanner(isGoal,'theirs');
      this._shooterResult(isGoal);
      // Lưới rung khi bóng vào lưới
      if(isGoal) this._rippleNet();
    },'theirs');
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
    ball.classList.remove('ball-fx-wind-mine','ball-fx-wind-theirs','ball-fx-fire','ball-fx-ice','ball-fx-leaf','ball-fx-rainbow','ball-fx-dark','ball-fx-thunder');
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
  }

  // Mảnh băng — trắng/xanh cyan lấp lánh, xoay khi tan
  _spawnIceTrail(pitch,x,y){
    const p=document.createElement('div');
    p.className='pt-trail-ice';
    p.style.left=(x+(Math.random()-0.5)*10)+'px';
    p.style.top=(y+(Math.random()-0.5)*10)+'px';
    pitch.appendChild(p);
    setTimeout(()=>p.remove(),570);
  }

  // Lá cây bay theo sau bóng, xoay lật như bị gió cuốn
  _spawnLeafTrail(pitch,x,y){
    const leaves=['🍃','🍂'];
    const p=document.createElement('span');
    p.className='pt-trail-leaf';
    p.textContent=leaves[Math.floor(Math.random()*leaves.length)];
    p.style.left=(x+(Math.random()-0.5)*10)+'px';
    p.style.top=(y+(Math.random()-0.5)*10)+'px';
    pitch.appendChild(p);
    setTimeout(()=>p.remove(),620);
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
      {off:0,  len:1,   side:false},
      {off:-6, len:0.6, side:true},
      {off:6,  len:0.6, side:true}
    ];
    lines.forEach(ln=>{
      const s=document.createElement('div');
      s.className='pt-trail-rainbow'+(ln.side?' side':'');
      const ox=x+nx*ln.off+3;
      const oy=y+ny*ln.off-2;
      s.style.left=ox+'px';
      s.style.top=oy+'px';
      s.style.setProperty('--wr',angleDeg+'deg');
      s.style.setProperty('--len',ln.len);
      s.style.setProperty('--hue',hue);
      pitch.appendChild(s);
      setTimeout(()=>s.remove(),480);
    });
  }

  // Khói bạc-đen cuộn theo sau bóng — dùng cho cú sút hắc ám
  _spawnSmokeTrail(pitch,x,y){
    for(let i=0;i<2;i++){
      const p=document.createElement('div');
      p.className='pt-trail-smoke';
      p.style.left=(x+(Math.random()-0.5)*10)+'px';
      p.style.top=(y+(Math.random()-0.5)*10)+'px';
      pitch.appendChild(p);
      setTimeout(()=>p.remove(),780);
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
  }

  // Chọn ngẫu nhiên 1 kiểu hiệu ứng cho mỗi cú sút — chia đều tỉ lệ cho cả
  // 7 kiểu: gió, lửa cháy, băng giá, lá cây bay, cầu vồng, hắc ám, sấm sét
  _pickTrailStyle(){
    const styles=['wind','fire','ice','leaf','rainbow','dark','thunder'];
    return styles[Math.floor(Math.random()*styles.length)];
  }

  // Điều phối hiệu ứng bay theo đúng kiểu đã chọn cho cú sút hiện tại
  _spawnBallTrail(pitch,x,y,angleDeg,team,style){
    if(style==='fire')    return this._spawnFireTrail(pitch,x,y);
    if(style==='ice')     return this._spawnIceTrail(pitch,x,y);
    if(style==='leaf')    return this._spawnLeafTrail(pitch,x,y);
    if(style==='rainbow') return this._spawnRainbowTrail(pitch,x,y,angleDeg);
    if(style==='dark')    return this._spawnSmokeTrail(pitch,x,y);
    if(style==='thunder') return this._spawnThunderTrail(pitch,x,y);
    return this._spawnWindStreak(pitch,x,y,angleDeg,team);
  }

  // Gán ánh sáng bao quanh bóng khớp với kiểu hiệu ứng đang bay; luôn gỡ các
  // class cũ trước để không bị chồng hiệu ứng của lần sút trước
  _setBallFx(ball,style,team){
    ball.classList.remove('ball-fx-wind-mine','ball-fx-wind-theirs','ball-fx-fire','ball-fx-ice','ball-fx-leaf','ball-fx-rainbow','ball-fx-dark','ball-fx-thunder');
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
      case 'fire':    return [['0%','#7f1d1d'],['45%','#ef4444'],['75%','#fb923c'],['100%','#fde68a']];
      case 'ice':     return [['0%','#0e7490'],['50%','#67e8f9'],['100%','#f0fdff']];
      case 'leaf':    return [['0%','#365314'],['50%','#84cc16'],['100%','#d9f99d']];
      case 'rainbow': return [['0%','#f43f5e'],['20%','#fb923c'],['40%','#facc15'],['60%','#4ade80'],['80%','#38bdf8'],['100%','#a78bfa']];
      case 'dark':    return [['0%','#000000'],['40%','#1e1b4b'],['70%','#6b21a8'],['100%','#4c1d95']];
      case 'thunder': return [['0%','#78350f'],['40%','#facc15'],['75%','#fef9c3'],['100%','#ffffff']];
      default:        return null; // wind dùng màu đặc theo team, không cần gradient
    }
  }

  _startTrailLine(pitch,style,team,startX,startY,endX,endY){
    // Dọn đường path của lượt trước nếu vì lý do gì đó chưa kịp remove
    if(this._trailLine){ this._trailLine.svg.remove(); this._trailLine=null; }
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
      stroke=team==='theirs'?'#ef4444':'#38bdf8';
    }

    // Lớp glow ngoài — to, mờ, tạo hào quang
    const glow=document.createElementNS(svgNS,'path');
    glow.setAttribute('fill','none');
    glow.setAttribute('stroke',stroke);
    glow.setAttribute('stroke-width','26');
    glow.setAttribute('stroke-linecap','round');
    glow.setAttribute('stroke-linejoin','round');
    glow.setAttribute('opacity','0.4');
    glow.style.filter='blur(5px)';

    // Lớp lõi — sáng rõ, nét đậm ở giữa
    const core=document.createElementNS(svgNS,'path');
    core.setAttribute('fill','none');
    core.setAttribute('stroke',stroke);
    core.setAttribute('stroke-width','10');
    core.setAttribute('stroke-linecap','round');
    core.setAttribute('stroke-linejoin','round');
    core.setAttribute('opacity','0.95');

    svg.appendChild(glow);
    svg.appendChild(core);
    pitch.appendChild(svg);

    this._trailLine={svg,glow,core,d:`M ${startX} ${startY}`};
    glow.setAttribute('d',this._trailLine.d);
    core.setAttribute('d',this._trailLine.d);
  }

  _updateTrailLine(x,y){
    const tl=this._trailLine;
    if(!tl) return;
    tl.d+=` L ${x} ${y}`;
    tl.glow.setAttribute('d',tl.d);
    tl.core.setAttribute('d',tl.d);
  }

  _finishTrailLine(){
    const tl=this._trailLine;
    if(!tl) return;
    this._trailLine=null;
    tl.svg.style.transition='opacity 0.35s ease-out';
    tl.svg.style.opacity='0';
    setTimeout(()=>tl.svg.remove(),380);
  }

  // Độ lệch vuông góc so với đường thẳng chấm 11m → điểm rơi, theo từng kiểu
  // hiệu ứng — đây là phần quyết định HÌNH DẠNG đường bay (zíc-zắc, xoáy,
  // chữ S, vòng cung, nảy...), khác với _trailGradientStops chỉ lo màu sắc.
  _trailOffset(style,raw){
    switch(style){
      case 'wind':    return 30*(1-raw)*Math.sin(raw*2.5*2*Math.PI);       // lốc xoáy: xoáy quanh trục bay, thu nhỏ dần như phễu
      case 'dark':    return 36*(1-raw)*Math.sin(raw*3*2*Math.PI);         // hắc ám: xoáy rộng hơn — dùng chung công thức, bóng phân thân lấy dấu ngược lại
      case 'rainbow': return 70*Math.sin(Math.PI*raw);                     // cầu vồng: 1 vòng cung duy nhất, đúng hình dải cầu vồng
      case 'leaf':    return 18*(1-raw)*Math.abs(Math.sin(raw*4*Math.PI)); // lá cây: nảy nảy nảy, biên độ giảm dần
      case 'fire':    return 26*Math.sin(raw*2*Math.PI);                  // lửa: đúng 1 chu kỳ sin = hình chữ S
      case 'thunder':{
        const tw=raw*4;
        return 22*(2*Math.abs(2*(tw-Math.floor(tw+0.5)))-1);              // sấm sét: sóng tam giác = zíc-zắc góc nhọn
      }
      case 'ice':
      default: return 0;                                                   // băng giá: bay thẳng tuyệt đối, không lệch
    }
  }

  // Tốc độ tiến theo phương chính: băng giá & sấm sét bay đều tốc độ không
  // đổi (đúng chất "thẳng"/"tia chớp"), các kiểu còn lại ease-out cho mượt.
  _trailForward(style,raw){
    if(style==='ice'||style==='thunder') return raw;
    return 1-Math.pow(1-raw,3);
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

    // Tự điều khiển animation bằng requestAnimationFrame thay vì CSS transition
    // + setInterval riêng lẻ (2 timeline khác nhau chạy độc lập là nguyên nhân
    // chính gây giật hình/giật đường bay) — giờ tất cả đồng bộ theo đúng 1 vòng
    // rAF, luôn khớp với frame vẽ thực tế của trình duyệt.
    const trailStyle=this._pickTrailStyle();
    // Thời gian bay riêng cho từng kiểu — kéo dài hơn bản cũ (500ms) để hình
    // dạng đường bay (xoáy/chữ S/vòng cung/nảy/zíc-zắc) kịp thể hiện rõ.
    const FLIGHT_MS_BY_STYLE={wind:950,fire:850,ice:750,leaf:1000,rainbow:900,dark:950,thunder:650};
    const flightMs=FLIGHT_MS_BY_STYLE[trailStyle]||800;
    const t0=performance.now();
    let lastAccentT=-1;
    this._setBallFx(ball,trailStyle,team);
    this._startTrailLine(pitch,trailStyle,team,startX,startY,endX,endY);

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
    }

    const step=(now)=>{
      const raw=Math.min(1,(now-t0)/flightMs);
      const fwd=this._trailForward(trailStyle,raw);
      const off=this._trailOffset(trailStyle,raw);
      const x=startX+dx*fwd+nx*off;
      const y=startY+dy*fwd+ny*off;
      const scale=1+0.3*raw;
      const rot=(trailStyle==='thunder'?360:720)*raw;
      setBallTransform(x,y,scale,rot);
      if(shadowBall){
        const sx=startX+dx*fwd-nx*off;
        const sy=startY+dy*fwd-ny*off;
        shadowBall.style.transform=`translate(calc(-50% + ${sx}px), calc(-50% + ${sy}px)) scale(${scale}) rotate(${-rot}deg)`;
      }
      // Vẽ nối thêm điểm vào đường path — luôn liền mạch theo đúng khung hình
      // thực tế, không còn đứt quãng như cách rắc từng đoạn rời trước đây.
      this._updateTrailLine(x,y);
      // Hạt điểm nhấn (lửa/băng/lá/hắc ám/sấm sét) rắc thưa hơn để tô thêm
      // chi tiết trên nền đường path liên tục, không đóng vai trò chính nữa.
      if((trailStyle==='fire'||trailStyle==='ice'||trailStyle==='leaf'||trailStyle==='dark'||trailStyle==='thunder') && (raw-lastAccentT>=0.14 || raw>=1)){
        lastAccentT=raw;
        this._spawnBallTrail(pitch,x,y,angleDeg,team,trailStyle);
      }
      if(raw<1){
        requestAnimationFrame(step);
      }else{
        if(shadowBall){ shadowBall.remove(); this._shadowBall=null; }
        this._finishTrailLine();
        setTimeout(callback,20);
      }
    };
    requestAnimationFrame(step);
  }

  _keeperDive(zone,cls){
    const keeper=document.getElementById('pt-keeper');
    applyKeeperSprite(keeper,zone);
    keeper.style.setProperty('--flip',keeper.dataset.flip==='1'?-1:1);
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
    keeper.classList.remove('diving','save');void keeper.offsetWidth;
    keeper.classList.add(cls);
  }

  resetKeeperPos(){
    const k=document.getElementById('pt-keeper');
    applyKeeperSprite(k,'mid-stand');
    k.style.setProperty('--flip',1);
    k.classList.remove('diving','save');
    k.style.transition='transform 0.5s cubic-bezier(0.34,1.56,0.64,1)';
    k.style.transform='translate(0,0)';k.style.setProperty('--dx','0px');k.style.setProperty('--dy','0px');
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
    const hairHex = pickRandomHairColor();
    const cached = flagColorCache[team.code];
    if(cached){
      // Đã có sẵn màu cờ (nhờ prefetch ở showMatch) → nhuộm màu ngay, không
      // hiện ảnh trắng gốc rồi mới đổi màu sau (tránh chớp trắng).
      const kit = {...cached, hair:hairHex};
      this.state._shooterKit = kit;
      renderShooterSprite('mid-stand', kit);
      return;
    }
    // Chưa có cache: hiện ảnh gốc tạm trong lúc chờ tải màu cờ, TUYỆT ĐỐI
    // không dùng lại _shooterKit cũ (của đội trước đó) kẻo tô nhầm màu đội kia.
    renderShooterSprite('mid-stand', null);
    getFlagColors(team.code).then((kitRaw)=>{
      if(reqId!==this._shooterReq) return; // đội đang hiện đã đổi trong lúc chờ → bỏ kết quả cũ
      const kit = {...kitRaw, hair:hairHex};
      this.state._shooterKit = kit;
      if(this.state._shooterPose==='mid-stand') renderShooterSprite('mid-stand', kit);
    });
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