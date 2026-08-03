// ============================
// DỮ LIỆU QUỐC GIA — shared for MP
// ============================
export const COUNTRIES = {
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

export const FIFA_CODE3 = {
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
export function abbr3(team){
  if(team && CLUB_MAP[team.code]) return CLUB_MAP[team.code].abbr;
  return (team && FIFA_CODE3[team.code]) || (team ? team.name.slice(0,3).toUpperCase() : '');
}

// ============================
// CÂU LẠC BỘ — giải Cúp C1 riêng (logo thật từ media.api-sports.io)
// ============================
export const CLUBS = [
  {code:'rma', name:'Real Madrid',      abbr:'RMA', logoId:541, rank:1},
  {code:'mci', name:'Man City',         abbr:'MCI', logoId:50,  rank:2},
  {code:'bay', name:'Bayern Munich',    abbr:'BAY', logoId:157, rank:3},
  {code:'liv', name:'Liverpool',        abbr:'LIV', logoId:40,  rank:4},
  {code:'psg', name:'PSG',              abbr:'PSG', logoId:85,  rank:5},
  {code:'bar', name:'Barcelona',        abbr:'BAR', logoId:529, rank:6},
  {code:'ars', name:'Arsenal',          abbr:'ARS', logoId:42,  rank:7},
  {code:'int', name:'Inter Milan',      abbr:'INT', logoId:505, rank:8},
  {code:'mun', name:'Man United',       abbr:'MUN', logoId:33,  rank:9},
  {code:'dor', name:'Dortmund',         abbr:'DOR', logoId:165, rank:10},
  {code:'mil', name:'AC Milan',         abbr:'MIL', logoId:489, rank:11},
  {code:'juv', name:'Juventus',         abbr:'JUV', logoId:496, rank:12},
  {code:'che', name:'Chelsea',          abbr:'CHE', logoId:49,  rank:13},
  {code:'ben', name:'Benfica',          abbr:'BEN', logoId:211, rank:14},
  {code:'spo', name:'Sporting CP',      abbr:'SPO', logoId:620, rank:15},
  {code:'por', name:'Porto',            abbr:'POR', logoId:212, rank:16},
  {code:'psv', name:'PSV',              abbr:'PSV', logoId:663, rank:17},
  {code:'ajx', name:'Ajax',             abbr:'AJX', logoId:94,  rank:18},
  {code:'fey', name:'Feyenoord',        abbr:'FEY', logoId:665, rank:19},
  {code:'atm', name:'Atlético Madrid',  abbr:'ATM', logoId:530, rank:20},
  {code:'tot', name:'Tottenham',        abbr:'TOT', logoId:47,  rank:21},
  {code:'nap', name:'Napoli',           abbr:'NAP', logoId:492, rank:22},
  {code:'rom', name:'Roma',             abbr:'ROM', logoId:497, rank:23},
  {code:'laz', name:'Lazio',            abbr:'LAZ', logoId:487, rank:24},
  {code:'ata', name:'Atalanta',         abbr:'ATA', logoId:499, rank:25},
  {code:'rbl', name:'RB Leipzig',       abbr:'RBL', logoId:173, rank:26},
  {code:'lev', name:'Leverkusen',       abbr:'LEV', logoId:168, rank:27},
  {code:'sev', name:'Sevilla',          abbr:'SEV', logoId:536, rank:28},
  {code:'mar', name:'Marseille',        abbr:'MAR', logoId:81,  rank:29},
  {code:'lyo', name:'Lyon',             abbr:'LYO', logoId:80,  rank:30},
  {code:'mon', name:'Monaco',           abbr:'MON', logoId:91,  rank:31},
  {code:'bra', name:'Braga',            abbr:'BRA', logoId:626, rank:32},
  {code:'val', name:'Valencia',         abbr:'VAL', logoId:532, rank:33},
  {code:'vil', name:'Villarreal',       abbr:'VIL', logoId:533, rank:34},
  {code:'whu', name:'West Ham',         abbr:'WHU', logoId:48,  rank:35},
  {code:'new', name:'Newcastle',        abbr:'NEW', logoId:34,  rank:36},
  {code:'soc', name:'Real Sociedad',    abbr:'SOC', logoId:548, rank:37},
  {code:'ath', name:'Athletic Bilbao',  abbr:'ATH', logoId:531, rank:38},
  {code:'fio', name:'Fiorentina',       abbr:'FIO', logoId:502, rank:39},
  {code:'fra', name:'Frankfurt',        abbr:'FRA', logoId:169, rank:40},
  {code:'stu', name:'Stuttgart',        abbr:'STU', logoId:172, rank:41},
  {code:'wol', name:'Wolfsburg',        abbr:'WOL', logoId:164, rank:42},
  {code:'mgl', name:'Gladbach',         abbr:'MGL', logoId:163, rank:43},
  {code:'lil', name:'Lille',            abbr:'LIL', logoId:79,  rank:44},
  {code:'ren', name:'Rennes',           abbr:'REN', logoId:90,  rank:45},
  {code:'nic', name:'Nice',             abbr:'NIC', logoId:84,  rank:46},
  {code:'len', name:'Lens',             abbr:'LEN', logoId:1161,rank:47},
  // CLB Việt Nam — V.League
  {code:'hano', name:'Hà Nội FC',       abbr:'HNO', logoId:7450, rank:48},
  {code:'cahn', name:'Công An HN',      abbr:'CAH', logoId:7462, rank:49},
  {code:'nadi', name:'Nam Định',        abbr:'NAD', logoId:7461, rank:50},
  {code:'vtel', name:'Viettel',         abbr:'VTL', logoId:7456, rank:51},
  {code:'haip', name:'Hải Phòng',       abbr:'HPH', logoId:7458, rank:52},
  {code:'bdu',  name:'B.Bình Dương',    abbr:'BBD', logoId:7452, rank:53},
  {code:'slna', name:'SLNA',            abbr:'SLN', logoId:7455, rank:54},
  {code:'hagl', name:'HAGL',            abbr:'HGL', logoId:7453, rank:55},
];
export const CLUB_MAP = Object.fromEntries(CLUBS.map(c=>[c.code,c]));
export function getAllClubs(){ return CLUBS; }
export function clubByCode(code){ return CLUB_MAP[code]||null; }

// CLB thuộc nước nào — dùng để xếp CLB theo nước trong picker đội
// (Benfica/Porto → Bồ Đào Nha, Ajax → Hà Lan nằm ngoài 5 giải chính)
export const CLUB_COUNTRY = {
  mci:'en',liv:'en',ars:'en',mun:'en',che:'en',tot:'en',whu:'en',new:'en',
  rma:'es',bar:'es',atm:'es',sev:'es',val:'es',vil:'es',soc:'es',ath:'es',
  int:'it',mil:'it',juv:'it',nap:'it',rom:'it',laz:'it',ata:'it',fio:'it',
  bay:'de',dor:'de',rbl:'de',lev:'de',fra:'de',stu:'de',wol:'de',mgl:'de',
  psg:'fr',mar:'fr',lyo:'fr',mon:'fr',lil:'fr',ren:'fr',nic:'fr',len:'fr',
  ben:'pt',por:'pt',spo:'pt',bra:'pt',
  ajx:'nl',psv:'nl',fey:'nl',
  hano:'vn',cahn:'vn',nadi:'vn',vtel:'vn',haip:'vn',bdu:'vn',slna:'vn',hagl:'vn',
};
export const CLUB_COUNTRIES = {
  en:{ name:'Anh',          flag:'\u{1F3F4}\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}', order:1 },
  es:{ name:'Tây Ban Nha',  flag:'🇪🇸', order:2 },
  it:{ name:'Ý',            flag:'🇮🇹', order:3 },
  de:{ name:'Đức',          flag:'🇩🇪', order:4 },
  fr:{ name:'Pháp',         flag:'🇫🇷', order:5 },
  pt:{ name:'Bồ Đào Nha',   flag:'🇵🇹', order:6 },
  nl:{ name:'Hà Lan',       flag:'🇳🇱', order:7 },
  vn:{ name:'Việt Nam',     flag:'🇻🇳', order:0 },
};
export function clubCountry(code){ return CLUB_COUNTRY[code]||'other'; }

// ============================
// TOURNAMENT CONFIGURATIONS
// ============================
export const TOURNAMENT_CONFIGS = {
  worldcup: {
    id:'worldcup', name:'FIFA WC', icon:'🏆', region:null,
    teamCount:32, groups:8, advancePerGroup:2,
    knockoutRoundNames:['Vòng 16 đội','Tứ kết','Bán kết','Chung kết'],
    pointsWin:1500, pointsLose:300,
  },
  euro: {
    id:'euro', name:'Euro', icon:'🇪🇺', region:'chau_eu',
    teamCount:16, groups:4, advancePerGroup:2,
    knockoutRoundNames:['Tứ kết','Bán kết','Chung kết'],
    pointsWin:1200, pointsLose:240,
  },
  copa: {
    id:'copa', name:'Copa A', icon:'🌎', region:'chau_my',
    teamCount:16, groups:4, advancePerGroup:2,
    knockoutRoundNames:['Tứ kết','Bán kết','Chung kết'],
    pointsWin:1200, pointsLose:240,
  },
  afcon: {
    id:'afcon', name:'CAN', icon:'🌍', region:'chau_phi',
    teamCount:16, groups:4, advancePerGroup:2,
    knockoutRoundNames:['Tứ kết','Bán kết','Chung kết'],
    pointsWin:1200, pointsLose:240,
  },
  asiancup: {
    id:'asiancup', name:'AFC', icon:'🌏', region:'chau_a',
    teamCount:16, groups:4, advancePerGroup:2,
    knockoutRoundNames:['Tứ kết','Bán kết','Chung kết'],
    pointsWin:1200, pointsLose:240,
  },
  champions: {
    id:'champions', name:'Cúp C1', icon:'⭐', region:'clubs',
    teamCount:32, groups:8, advancePerGroup:2,
    knockoutRoundNames:['Vòng 16 đội','Tứ kết','Bán kết','Chung kết'],
    pointsWin:1500, pointsLose:300,
  },
  clubwc: {
    id:'clubwc', name:'Club WC', icon:'🌍', region:'clubs', rankMin:1, rankMax:16,
    teamCount:16, groups:4, advancePerGroup:2,
    knockoutRoundNames:['Tứ kết','Bán kết','Chung kết'],
    pointsWin:2000, pointsLose:400,
  },
  europa: {
    id:'europa', name:'Cúp C2', icon:'🥈', region:'clubs', rankMin:9, rankMax:40,
    teamCount:32, groups:8, advancePerGroup:2,
    knockoutRoundNames:['Vòng 16 đội','Tứ kết','Bán kết','Chung kết'],
    pointsWin:1000, pointsLose:200,
  },
  // Cúp quốc gia — mỗi cúp chỉ gồm đúng 8 CLB của nước đó
  facup:   { id:'facup',   name:'FA Cup',          icon:'\u{1F3F4}\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}', region:'clubs', country:'en', teamCount:8, groups:2, advancePerGroup:2, knockoutRoundNames:['Bán kết','Chung kết'], pointsWin:600, pointsLose:120 },
  coparey: { id:'coparey', name:'Copa del Rey',    icon:'🇪🇸', region:'clubs', country:'es', teamCount:8, groups:2, advancePerGroup:2, knockoutRoundNames:['Bán kết','Chung kết'], pointsWin:600, pointsLose:120 },
  coppait: { id:'coppait', name:'Coppa Italia',    icon:'🇮🇹', region:'clubs', country:'it', teamCount:8, groups:2, advancePerGroup:2, knockoutRoundNames:['Bán kết','Chung kết'], pointsWin:600, pointsLose:120 },
  dfbpokal:{ id:'dfbpokal',name:'DFB-Pokal',       icon:'🇩🇪', region:'clubs', country:'de', teamCount:8, groups:2, advancePerGroup:2, knockoutRoundNames:['Bán kết','Chung kết'], pointsWin:600, pointsLose:120 },
  coupefr: { id:'coupefr', name:'Coupe de France', icon:'🇫🇷', region:'clubs', country:'fr', teamCount:8, groups:2, advancePerGroup:2, knockoutRoundNames:['Bán kết','Chung kết'], pointsWin:600, pointsLose:120 },
};
export const CUP_TOURNAMENTS = Object.values(TOURNAMENT_CONFIGS);

// ============================
// LEAGUE CONFIGURATIONS (5 giải)
// ============================
export const LEAGUE_CONFIGS = {
  world: { id:'world', name:'World', icon:'🌐', region:null, teamCount:8, pointsWin:600, pointsDraw:240, pointsLose:150 },
  eu: { id:'eu', name:'EU', icon:'🇪🇺', region:'chau_eu', teamCount:8, pointsWin:500, pointsDraw:200, pointsLose:120 },
  copa: { id:'copa', name:'America', icon:'🌎', region:'chau_my', teamCount:8, pointsWin:500, pointsDraw:200, pointsLose:120 },
  africa: { id:'africa', name:'African', icon:'🌍', region:'chau_phi', teamCount:8, pointsWin:500, pointsDraw:200, pointsLose:120 },
  asia: { id:'asia', name:'Asian', icon:'🌏', region:'chau_a', teamCount:8, pointsWin:500, pointsDraw:200, pointsLose:120 },
};
export const LEAGUE_LIST = Object.values(LEAGUE_CONFIGS);

// ============================
// LEAGUE CONFIGURATIONS — CÂU LẠC BỘ (5 giải riêng)
// ============================
export const CLUB_LEAGUE_CONFIGS = {
  // Mỗi giải chỉ gồm đúng CLB của nước đó — không rút từ pool chung (tránh lỗi "Premier League có Real Madrid").
  epl:    { id:'epl',    name:'Premier',  icon:'🏴󠁧󠁢󠁥󠁮󠁧󠁿', region:'clubs', teamCount:8, pointsWin:600, pointsDraw:240, pointsLose:150, clubs:['mci','liv','ars','mun','che','tot','whu','new'] },
  laliga: { id:'laliga', name:'La Liga',  icon:'🇪🇸', region:'clubs', teamCount:8, pointsWin:500, pointsDraw:200, pointsLose:120, clubs:['rma','bar','atm','sev','val','vil','soc','ath'] },
  seria:  { id:'seria',  name:'Serie A',  icon:'🇮🇹', region:'clubs', teamCount:8, pointsWin:500, pointsDraw:200, pointsLose:120, clubs:['int','mil','juv','nap','rom','laz','ata','fio'] },
  bundes: { id:'bundes', name:'Bundesliga', icon:'🇩🇪', region:'clubs', teamCount:8, pointsWin:500, pointsDraw:200, pointsLose:120, clubs:['bay','dor','rbl','lev','fra','stu','wol','mgl'] },
  ligue1: { id:'ligue1', name:'Ligue 1',  icon:'🇫🇷', region:'clubs', teamCount:8, pointsWin:500, pointsDraw:200, pointsLose:120, clubs:['psg','mar','lyo','mon','lil','ren','nic','len'] },
  vleague:{ id:'vleague', name:'V.League', icon:'🇻🇳', region:'clubs', teamCount:8, pointsWin:600, pointsDraw:240, pointsLose:150, clubs:['hano','cahn','nadi','vtel','haip','bdu','slna','hagl'] },
};
export const CLUB_LEAGUE_LIST = Object.values(CLUB_LEAGUE_CONFIGS);

// Lọc theo loại: 'national' (quốc gia) hoặc 'club' (câu lạc bộ)
export function getCupsByType(type){
  return CUP_TOURNAMENTS.filter(t=>type==='club' ? t.region==='clubs' : t.region!=='clubs');
}
export function getLeaguesByType(type){
  return type==='club' ? CLUB_LEAGUE_LIST : LEAGUE_LIST;
}
export function cupById(id){ return CUP_TOURNAMENTS.find(t=>t.id===id)||null; }
export function leagueById(id){ return LEAGUE_LIST.find(l=>l.id===id)||CLUB_LEAGUE_LIST.find(l=>l.id===id)||null; }

export function buildRoundRobin(n){
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

export const MODES = [
  { id:'nhanh',  name:'Giao hữu', icon:'⚡', desc:'Đá 1 trận',        label:'Đá Penalty!' },
  { id:'league', name:'League', icon:'📊', desc:'Đấu bảng xếp hạng', label:'Bắt đầu League!' },
  { id:'cup',    name:'Cúp',    icon:'🏆', desc:'Đấu loại trực tiếp', label:'Bắt đầu Cúp!' },
];

export const KIT_COLORS = {
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
  ma:{primary:'#dc2626',secondary:'#046a38'}, sn:{primary:'#ffffff',secondary:'#046a38'},
  eg:{primary:'#dc2626',secondary:'#000000'}, dz:{primary:'#ffffff',secondary:'#ffffff'},
  tn:{primary:'#dc2626',secondary:'#ffffff'}, ng:{primary:'#046a38',secondary:'#ffffff'},
  ci:{primary:'#ff8200',secondary:'#ffffff'}, cm:{primary:'#046a38',secondary:'#dc2626'},
  gh:{primary:'#ffffff',secondary:'#000000'}, za:{primary:'#ffd400',secondary:'#046a38'},
  ar:{primary:'#75aadb',secondary:'#000000'}, br:{primary:'#ffd400',secondary:'#1e3a8a'},
  co:{primary:'#ffd400',secondary:'#1e3a8a'}, uy:{primary:'#7ec4e8',secondary:'#000000'},
  us:{primary:'#ffffff',secondary:'#1e3a8a'}, mx:{primary:'#046a38',secondary:'#ffffff'},
  ec:{primary:'#ffd400',secondary:'#1e3a8a'}, pe:{primary:'#ffffff',secondary:'#ffffff'},
  pa:{primary:'#dc2626',secondary:'#1e3a8a'}, cl:{primary:'#dc2626',secondary:'#1e3a8a'},
  ca:{primary:'#dc2626',secondary:'#dc2626'}, py:{primary:'#dc2626',secondary:'#1e3a8a'},
  ve:{primary:'#7b1c3d',secondary:'#ffffff'}, cr:{primary:'#dc2626',secondary:'#1e3a8a'},
  jm:{primary:'#000000',secondary:'#000000'},
  // Câu lạc bộ (Cúp C1 + league CLB)
  rma:{primary:'#ffffff',secondary:'#febe10'}, mci:{primary:'#6cabdd',secondary:'#1c2c5b'},
  bay:{primary:'#dc052d',secondary:'#ffffff'}, liv:{primary:'#c8102e',secondary:'#000000'},
  psg:{primary:'#004170',secondary:'#da291c'}, bar:{primary:'#a50044',secondary:'#004d98'},
  ars:{primary:'#ef0107',secondary:'#ffffff'}, int:{primary:'#0068a8',secondary:'#000000'},
  mun:{primary:'#da291c',secondary:'#000000'}, dor:{primary:'#fde100',secondary:'#000000'},
  mil:{primary:'#fb090b',secondary:'#000000'}, juv:{primary:'#000000',secondary:'#ffffff'},
  che:{primary:'#034694',secondary:'#ffffff'}, ben:{primary:'#e7332a',secondary:'#ffffff'},
  por:{primary:'#00418c',secondary:'#ffffff'}, ajx:{primary:'#d2122e',secondary:'#ffffff'},
  atm:{primary:'#cb3524',secondary:'#ffffff'}, tot:{primary:'#132257',secondary:'#ffffff'},
  nap:{primary:'#12a0d7',secondary:'#ffffff'}, rom:{primary:'#8e1f2f',secondary:'#f0bc42'},
  laz:{primary:'#87d8f7',secondary:'#ffffff'}, ata:{primary:'#1e71b8',secondary:'#000000'},
  rbl:{primary:'#dd0741',secondary:'#ffffff'}, lev:{primary:'#e32221',secondary:'#000000'},
  sev:{primary:'#d40e14',secondary:'#ffffff'}, val:{primary:'#ee3524',secondary:'#000000'},
  vil:{primary:'#ffd400',secondary:'#005187'}, mar:{primary:'#2faee0',secondary:'#ffffff'},
  lyo:{primary:'#1a2f5c',secondary:'#e60d2e'}, mon:{primary:'#e63312',secondary:'#ffffff'},
  whu:{primary:'#7a263a',secondary:'#1bb1e7'}, new:{primary:'#241f20',secondary:'#ffffff'},
  soc:{primary:'#0067b1',secondary:'#ffffff'}, ath:{primary:'#ee2523',secondary:'#ffffff'},
  fio:{primary:'#582c83',secondary:'#ffffff'}, fra:{primary:'#e1000f',secondary:'#000000'},
  stu:{primary:'#ffffff',secondary:'#e32219'}, wol:{primary:'#65b32e',secondary:'#ffffff'},
  mgl:{primary:'#1a7a3f',secondary:'#ffffff'}, lil:{primary:'#e01e13',secondary:'#0055a5'},
  ren:{primary:'#e13327',secondary:'#000000'}, nic:{primary:'#cc0000',secondary:'#000000'},
  len:{primary:'#b51e24',secondary:'#ffd700'},
  spo:{primary:'#008152',secondary:'#ffffff'}, psv:{primary:'#d71920',secondary:'#ffffff'},
  fey:{primary:'#c8102e',secondary:'#ffffff'}, bra:{primary:'#d1151b',secondary:'#ffffff'},
  // CLB Việt Nam
  hano:{primary:'#5b2d8e',secondary:'#ffffff'}, cahn:{primary:'#c8102e',secondary:'#ffffff'},
  nadi:{primary:'#ffd400',secondary:'#000000'}, vtel:{primary:'#5c0e2e',secondary:'#ffd400'},
  haip:{primary:'#e2231a',secondary:'#ffffff'}, bdu:{primary:'#da251d',secondary:'#ffffff'},
  slna:{primary:'#ffd400',secondary:'#1e3a8a'}, hagl:{primary:'#ffffff',secondary:'#00843d'},
};

export const flagColorCache = {};
export function getFlagColors(code){
  if(flagColorCache[code]) return Promise.resolve(flagColorCache[code]);
  // Đội giả trong Cup (gen_...) không có cờ thật — trả fallback NGAY, không
  // gửi request 404 vô ích tới flagcdn (làm trễ prewarm màu áo mỗi lượt).
  if(!code || code.startsWith('gen_')){
    const fb={primary:'#dc2626',secondary:'#1e3a8a',socks:'#1e3a8a',tertiary:'#ffffff'};
    flagColorCache[code]=fb;
    return Promise.resolve(fb);
  }
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
        if(brightness>232){ whitePx++; continue; }
        if(brightness<40) continue;
        const key=`${Math.round(r/32)*32},${Math.round(g/32)*32},${Math.round(b/32)*32}`;
        buckets[key]=(buckets[key]||0)+1;
      }
      const hasWhite = totalPx>0 && (whitePx/totalPx)>=0.06;
      const sorted=Object.entries(buckets).sort((a,b)=>b[1]-a[1]);
      const toHex=(str)=>{const [r,g,b]=str.split(',').map(Number);return '#'+[r,g,b].map(v=>v.toString(16).padStart(2,'0')).join('');};
      const ensureNotTooDark=(hex)=>{
        const {r,g,b}=_hexToRgb(hex);
        const [h,s,l]=_rgbToHsl(r,g,b);
        if(l>=0.28) return hex;
        const [nr,ng,nb]=_hslToRgb(h, Math.max(s,0.55), 0.4);
        return '#'+[nr,ng,nb].map(v=>v.toString(16).padStart(2,'0')).join('');
      };
      const primary=ensureNotTooDark(sorted[0]?toHex(sorted[0][0]):'#dc2626');
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
export async function applyTeamKit(el, countryCode){
  const {primary, secondary} = await getFlagColors(countryCode);
  el.style.setProperty('--team-color', primary);
  el.style.setProperty('--team-shorts-color', secondary);
}

// Shooter poses
export const SHOOTER_POSES = {
  'mid-stand': { img:'img/player/shooter-mid-stand.png', mask:'img/player/shooter-mid-stand-kit-shirt.png',  mask2:'img/player/shooter-mid-stand-kit-shorts.png',  mask3:'img/player/shooter-mid-stand-kit-hair.png',  mask4:'img/player/shooter-mid-stand-kit-socks.png' },
  'kick':      { img:'img/player/shooter-kick.png',       mask:'img/player/shooter-kick-kit-shirt.png',       mask2:'img/player/shooter-kick-kit-shorts.png',       mask3:'img/player/shooter-kick-kit-hair.png',       mask4:'img/player/shooter-kick-kit-socks.png' },
  'celebrate': { img:'img/player/shooter-celebrate.png',  mask:'img/player/shooter-celebrate-kit-shirt.png',  mask2:'img/player/shooter-celebrate-kit-shorts.png',  mask3:'img/player/shooter-celebrate-kit-hair.png',  mask4:'img/player/shooter-celebrate-kit-socks.png' },
  'disappoint':{ img:'img/player/shooter-disappoint.png', mask:'img/player/shooter-disappoint-kit-shirt.png', mask2:'img/player/shooter-disappoint-kit-shorts.png', mask3:'img/player/shooter-disappoint-kit-hair.png', mask4:'img/player/shooter-disappoint-kit-socks.png' },
};

export const HAIR_COLOR_PALETTE = [
  '#1b1b1b','#4a2f1c','#5d5049','#7a4423','#12171f','#d8d3c4','#93662f','#3a1416','#341920','#15221a',
];
export function pickRandomHairColor(){
  return HAIR_COLOR_PALETTE[Math.floor(Math.random()*HAIR_COLOR_PALETTE.length)];
}
// Tóc CỐ ĐỊNH theo đội (thay vì random — hết lag cú sút đầu): đội nhà TRẮNG,
// đối thủ ĐEN. Chỉ 2 màu nên mỗi pose nhuộm đúng 1 lần rồi cache vĩnh viễn.
export const HAIR_HOME_HEX = '#f5f5f5';
export const HAIR_AWAY_HEX = '#141414';

export const JERSEY_SPECIAL_NUMBERS = [30, 80];
export function randomJerseyNumber(){
  if(Math.random() < 0.12) return JERSEY_SPECIAL_NUMBERS[Math.floor(Math.random()*JERSEY_SPECIAL_NUMBERS.length)];
  return 1 + Math.floor(Math.random()*25);
}

export const _shooterImgCache = {};
export function _loadImg(src){
  if(_shooterImgCache[src]) return _shooterImgCache[src];
  const p = new Promise((resolve)=>{
    const im = new Image();
    im.onload = ()=>resolve(im);
    im.onerror = ()=>{ console.error('[penalty] Không tải được ảnh sprite:', src); resolve(null); };
    im.src = src;
  });
  _shooterImgCache[src] = p;
  return p;
}

export function _hexToRgb(hex){
  hex = (hex||'#dc2626').replace('#','');
  if(hex.length===3) hex = hex.split('').map(c=>c+c).join('');
  const parsed = parseInt(hex,16);
  const n = Number.isNaN(parsed) ? 0xdc2626 : parsed;
  return {r:(n>>16)&255, g:(n>>8)&255, b:n&255};
}
export function _rgbToHsl(r,g,b){
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
export function _hslToRgb(h,s,l){
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

export const _poseDataCache = {};
export async function _getPoseData(pose){
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
    catch(e){ return null; }
    const readMaskAlpha=(im)=>{
      if(!im) return null;
      const mc=document.createElement('canvas'); mc.width=w; mc.height=h;
      const mctx=mc.getContext('2d'); mctx.drawImage(im,0,0,w,h);
      return mctx.getImageData(0,0,w,h).data;
    };
    return { w, h, bd: baseData.data, shirtAlpha: readMaskAlpha(maskImg), shortsAlpha: readMaskAlpha(mask2Img), hairAlpha: readMaskAlpha(mask3Img), socksAlpha: readMaskAlpha(mask4Img) };
  })();
  _poseDataCache[pose] = promise;
  return promise;
}

export function _dyeMaskLayer(poseData, maskAlphaArr, hex){
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

export const _bodyLayerCache = {};
export const _teamLayerCache = {};
export const _hairLayerCache = {};
export async function _getSplitShooterLayers(pose, primaryHex, secondaryHex, hairHex, socksHex){
  secondaryHex = secondaryHex || primaryHex;
  socksHex = socksHex || secondaryHex;
  hairHex = hairHex || HAIR_HOME_HEX; // fallback cố định (trắng) — không random
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
      team = { shirt: _dyeMaskLayer(poseData, poseData.shirtAlpha, primaryHex), shorts: _dyeMaskLayer(poseData, poseData.shortsAlpha, secondaryHex), socks: _dyeMaskLayer(poseData, poseData.socksAlpha, socksHex) };
      _teamLayerCache[teamKey] = team;
    }
    const hairKey = pose+'|'+hairHex;
    let hair = _hairLayerCache[hairKey];
    if(!hair){ hair = _dyeMaskLayer(poseData, poseData.hairAlpha, hairHex); _hairLayerCache[hairKey] = hair; }
    return { body, hair, shirt:team.shirt, shorts:team.shorts, socks:team.socks };
  }catch(e){ return fallback; }
}

export async function renderShooterSprite(pose, kit, prefix){
  prefix = prefix || 'pt-shooter';
  const bodyEl=document.getElementById(prefix+'-body');
  const hairEl=document.getElementById(prefix+'-hair');
  const shirtEl=document.getElementById(prefix+'-shirt');
  const shortsEl=document.getElementById(prefix+'-shorts');
  const socksEl=document.getElementById(prefix+'-socks');
  if(!bodyEl) return;
  const p = SHOOTER_POSES[pose] || SHOOTER_POSES['mid-stand'];
  if(!kit || !kit.primary){
    bodyEl.src=p.img; if(hairEl) hairEl.src=''; if(shirtEl) shirtEl.src=''; if(shortsEl) shortsEl.src=''; if(socksEl) socksEl.src='';
    return;
  }
  const layers = await _getSplitShooterLayers(pose, kit.primary, kit.secondary, kit.hair, kit.socks);
  bodyEl.src=layers.body; if(hairEl) hairEl.src=layers.hair; if(shirtEl) shirtEl.src=layers.shirt; if(shortsEl) shortsEl.src=layers.shorts; if(socksEl) socksEl.src=layers.socks;
}

export const GK_POSITIONS = {
  'mid-stand':  { img: 'img/gk/gk-mid-stand.webp', flip: false, scale: 1 },
  'mid-center': { img: 'img/gk/gk-mid-mid.webp',   flip: false, scale: 1 },
  'top-center': { img: 'img/gk/gk-mid-high.webp',  flip: false, scale: 1.15, offsetY: 14 },
  'bot-center': { img: 'img/gk/gk-mid-low.webp',   flip: false, scale: 1 },
  'mid-left':   { img: 'img/gk/gk-left-mid.webp',  flip: false, scale: 1 },
  'top-left':   { img: 'img/gk/gk-left-high.webp', flip: false, scale: 1 },
  'bot-left':   { img: 'img/gk/gk-left-low.webp',  flip: false, scale: 1 },
  'mid-right':  { img: 'img/gk/gk-left-mid.webp',  flip: true,  scale: 1 },
  'top-right':  { img: 'img/gk/gk-left-high.webp', flip: true,  scale: 1 },
  'bot-right':  { img: 'img/gk/gk-left-low.webp',  flip: true,  scale: 1 },
};
export function applyKeeperSprite(keeper, zone){
  const pos = GK_POSITIONS[zone] || GK_POSITIONS['mid-stand'];
  keeper.src = pos.img;
  keeper.dataset.flip = pos.flip ? '1' : '0';
  keeper.style.setProperty('--gk-scale', pos.scale ?? 1);
}

// Nhuộm ÁO thủ môn theo màu đội đang PHÒNG NGỰ — chỉ tác động đúng những pixel
// TRẮNG trong ảnh (áo/quần/tất/tóc trắng), da/má hồng/viền đen/giày/dây găng đen
// giữ nguyên 100% vì không phải màu trắng. Kết quả được vẽ ra canvas 1 lần rồi
// cache theo (ảnh gốc + màu đội) để các lần sau set src tức thì, không phải tính lại.
const _gkTintSrcCache = {};
function _gkColorizeWhite(img, hex){
  const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
  const canvas = document.createElement('canvas'); canvas.width=w; canvas.height=h;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img,0,0,w,h);
  let imgData;
  try{ imgData = ctx.getImageData(0,0,w,h); } catch(e){ return null; }
  const d = imgData.data;
  const { r:tr, g:tg, b:tb } = _hexToRgb(hex);
  const [th, ts, targetL] = _rgbToHsl(tr,tg,tb);
  const tsBoost = Math.min(1, ts*1.15);
  for(let i=0;i<d.length;i+=4){
    const a = d[i+3];
    if(a<10) continue;
    const r=d[i], g=d[i+1], b=d[i+2];
    const maxc=Math.max(r,g,b), minc=Math.min(r,g,b);
    const val = maxc/255;
    const sat = maxc>0 ? (maxc-minc)/maxc : 0;
    // "Trắng" = vừa sáng (val cao) vừa gần như không màu (sat thấp). Ngưỡng siết
    // rất chặt (val>0.78, sat<0.12) để chỉ bắt đúng vải trắng, không dính da/găng/bóng.
    let wv = Math.max(0, Math.min(1,(val-0.78)/0.22));
    let ws = Math.max(0, Math.min(1,(0.12-sat)/0.12));
    wv = wv*wv*(3-2*wv); ws = ws*ws*(3-2*ws);
    const whiteness = wv*ws;
    if(whiteness<=0.12) continue;
    const [,,bl] = _rgbToHsl(r,g,b);
    // Màu đặc, ít ăn theo bóng đổ gốc — chỉ giữ chút sắc thái nếp gấp nhẹ.
    let outL = targetL + (bl-0.85)*0.18;
    outL = Math.max(targetL-0.08, Math.min(targetL+0.08, outL));
    const [nr,ng,nb] = _hslToRgb(th, tsBoost, outL);
    d[i]   = Math.round(r + (nr-r)*whiteness);
    d[i+1] = Math.round(g + (ng-g)*whiteness);
    d[i+2] = Math.round(b + (nb-b)*whiteness);
  }
  ctx.putImageData(imgData,0,0);
  return canvas.toDataURL('image/png');
}
// Để GIẢM LAG: không nhuộm thủ môn theo màu quốc gia nữa (vòng lặp từng pixel
// getImageData + HSL + toDataURL rất nặng). Cố định chỉ 2 màu:
// - side='home' (thủ môn đội nhà)  → ảnh gốc TRẮNG, không nhuộm, chi phí 0.
// - side='away' (thủ môn đối thủ)  → nhuộm ĐEN đúng 1 lần, cache vĩnh viễn.
const GK_BLACK_HEX = '#141414';
export async function applyKeeperKit(keeper, zone, side){
  if(!keeper) return;
  const pos = GK_POSITIONS[zone] || GK_POSITIONS['mid-stand'];
  // Đội nhà (và fallback mặc định) → ảnh gốc trắng, không tốn công nhuộm
  if(side !== 'away'){ keeper.src = pos.img; return; }
  const cacheKey = pos.img+'|BLACK';
  if(_gkTintSrcCache[cacheKey]){ keeper.src = _gkTintSrcCache[cacheKey]; return; }
  const img = await _loadImg(pos.img);
  if(!img){ keeper.src = pos.img; return; }
  const url = _gkColorizeWhite(img, GK_BLACK_HEX);
  if(!url){ keeper.src = pos.img; return; }
  _gkTintSrcCache[cacheKey] = url;
  keeper.src = url;
}

// Pre-warm: nhuộm áo thủ môn MÀU ĐEN cố định cho MỌI tư thế bay đúng 1 lần rồi
// cache vĩnh viễn. Đội nhà dùng ảnh gốc trắng nên không cần nhuộm. Chạy TRƯỚC
// trận để vòng lặp pixel nặng (getImageData + HSL + toDataURL) không rơi vào lúc
// cú sút đang bay gây giật. Không phụ thuộc đội/ quốc gia — luôn chỉ nhuộm đen.
export async function prewarmKeeperKit(){
  const positions = Object.values(GK_POSITIONS);
  // Preload decode ảnh WebP trước (tránh decode lần đầu ngay lúc sút)
  for(const p of positions){
    try{ await _loadImg(p.img); }catch(e){}
  }
  for(const p of positions){
    const cacheKey = p.img+'|BLACK';
    if(_gkTintSrcCache[cacheKey]) continue;
    const img = await _loadImg(p.img);
    if(!img) continue;
    try{
      const url = _gkColorizeWhite(img, GK_BLACK_HEX);
      if(url) _gkTintSrcCache[cacheKey] = url;
    }catch(e){}
  }
}

// ============================
// HELPERS
// ============================
export function shuffle(a){for(let i=a.length-1;i>0;i--){let j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
export function getAllCountries(){const a=[];for(const r of Object.values(COUNTRIES))a.push(...r.list);return a}
export function getRegionCountries(region){return region==='clubs'?getAllClubs():(region?COUNTRIES[region]?.list||[]:getAllCountries())}
export function countryByCode(code){for(const r of Object.values(COUNTRIES)){const f=r.list.find(c=>c.code===code);if(f)return f}return null}
export function getTopCountries(pool, n, excludeCode){
  return pool.filter(c=>c.code!==excludeCode).slice().sort((a,b)=>(a.rank||999)-(b.rank||999)).slice(0,n);
}
const _flagImgCache = {};
export function flagImg(code, name, size) {
  if (!code || code.startsWith('gen_')) return '🏳️';
  const s = size || 20;
  const key = code+'|'+s;
  if(_flagImgCache[key]) return _flagImgCache[key];
  let html;
  const club = CLUB_MAP[code];
  if(club){
    if(club.logoId){
      const fc=CLUB_COUNTRY[code]||'vn';
      html = `<img src="https://media.api-sports.io/football/teams/${club.logoId}.png" onerror="this.onerror=null;this.src='https://flagcdn.com/${fc}.svg'" alt="${name||club.name}" class="pt-club-logo" style="width:${s}px;height:${s}px;object-fit:contain;vertical-align:middle;" loading="lazy" decoding="async"/>`;
    }else{
      html = `<img src="https://flagcdn.com/${CLUB_COUNTRY[code]||'vn'}.svg" alt="${name||club.name}" class="pt-club-logo" style="width:${s}px;height:auto;vertical-align:middle;" loading="lazy" decoding="async"/>`;
    }
  }else{
    html = `<img src="https://flagcdn.com/${code}.svg" alt="${name||code}" class="pt-flag-svg" style="width:${s}px;height:auto;vertical-align:middle;" loading="lazy" decoding="async"/>`;
  }
  _flagImgCache[key] = html;
  return html;
}
// URL logo/cờ cho một đội (CLB → media.api-sports.io, quốc gia → flagcdn)
export function teamFlagSrc(code){
  if(!code || code.startsWith('gen_')) return '';
  const club = CLUB_MAP[code];
  if(club) return club.logoId ? `https://media.api-sports.io/football/teams/${club.logoId}.png` : `https://flagcdn.com/${CLUB_COUNTRY[code]||'vn'}.svg`;
  return `https://flagcdn.com/${code}.svg`;
}