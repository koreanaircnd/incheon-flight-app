const $ = id => document.getElementById(id);
let direction = 'arrival', flights = [], loggedIn = false;
const today = new Date(); $('date').value = new Date(today.getTime()-today.getTimezoneOffset()*60000).toISOString().slice(0,10);
$('loginBtn').addEventListener('click', async () => {
  const r = await fetch('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:$('accessCode').value})});
  const d = await r.json();
  if (!r.ok) { $('loginMsg').textContent = d.message || '로그인 실패'; return; }
  loggedIn = true; $('loginPanel').hidden = true; $('appPanel').hidden = false; loadFlights();
});
document.querySelectorAll('[data-dir]').forEach(b=>b.addEventListener('click',()=>{direction=b.dataset.dir;document.querySelectorAll('[data-dir]').forEach(x=>x.classList.toggle('active',x===b));loadFlights()}));
$('refreshBtn').onclick = loadFlights; $('date').onchange = loadFlights; $('filter').oninput = render; $('terminal').onchange = render;

function firstValue(obj, keys) {
  for (const key of keys) if (obj?.[key] !== undefined && obj[key] !== null && obj[key] !== '') return obj[key];
  return '';
}
function normalizeLiveFlight(f) {
  return {
    ...f,
    airline: firstValue(f, ['airline','airlineName','airlineKor','airlineNm']),
    flightId: firstValue(f, ['flightId','flightid','flightNo','flight']),
    airport: firstValue(f, ['airport','airportName','airportNm','airportKor']),
    airportCode: firstValue(f, ['airportCode','airportcode']),
    scheduleDateTime: firstValue(f, ['scheduleDateTime','scheduleDatetime','scheduleDate','scheduleTime','schedule']),
    estimatedDateTime: firstValue(f, ['estimatedDateTime','estimatedDatetime','changeDateTime','estimatedTime']),
    terminalid: firstValue(f, ['terminalid','terminalId','terminal','terminalCode']),
    gatenumber: firstValue(f, ['gatenumber','gateNumber','gate']),
    carousel: firstValue(f, ['carousel','carouselNo','baggageClaim']),
    chkinrange: firstValue(f, ['chkinrange','checkInCounter','chkinRange']),
    remark: firstValue(f, ['remark','status','flightStatus','rmk'])
  };
}

async function loadFlights(){
 if(!loggedIn)return;
 $('status').textContent='운항 정보를 조회하고 있습니다…';
 try{
  const r=await fetch(`/api/flights?direction=${direction}&date=${$('date').value}`);
  const d=await r.json(); if(!r.ok)throw new Error(d.message||'조회 실패');
  const body=d?.response?.body || d?.body || {};
  const raw=body?.items?.item ?? body?.items ?? d?.items?.item ?? d?.items ?? [];
  const items=Array.isArray(raw)?raw:(raw?[raw]:[]);
  flights=items.map(normalizeLiveFlight);
  const total=body?.totalCount ?? flights.length;
  $('status').textContent=`${flights.length}건 표시 / 전체 ${total}건 · 1분마다 자동 갱신`;
  render();
 }catch(e){$('status').textContent=e.message;$('results').innerHTML='';}
}
function render(){
 const q=$('filter').value.trim().toLowerCase(), t=$('terminal').value;
 const filtered=flights.filter(f=>{
  const hay=[f.airline,f.flightId,f.airport,f.remark].join(' ').toLowerCase();
  return (!q||hay.includes(q))&&(!t||f.terminalid===t);
 });
 $('results').innerHTML=filtered.map(f=>`<article class="flight"><strong>${esc(f.airline||'항공사 미상')} · ${esc(f.flightId||'편명 미상')}</strong> <span class="state">${esc(f.remark||'상태 미표시')}</span><div class="meta">${direction==='arrival'?'출발지':'도착지'}: ${esc(f.airport||'-')}<br>예정: ${fmt(f.scheduleDateTime)} · 변경: ${fmt(f.estimatedDateTime)}<br>터미널: ${esc(f.terminalid||'-')} · 게이트: ${esc(f.gatenumber||'-')} · ${direction==='arrival'?'수하물 수취대: '+esc(f.carousel||'-'):'체크인: '+esc(f.chkinrange||'-')}</div></article>`).join('')||'<p class="msg">조회된 운항 정보가 없습니다.</p>';
}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function fmt(v){if(!v)return '-';const s=String(v);return s.length===12?`${s.slice(8,10)}:${s.slice(10,12)}`:s;}
setInterval(()=>{if(loggedIn)loadFlights()},60000);


// 정기운항편 메뉴: 실시간 운항현황과 독립적으로 동작
let scheduleDirection = 'arrival', scheduledFlights = [];
$('liveMenu').addEventListener('click', () => {
  $('liveMenu').classList.add('active'); $('scheduleMenu').classList.remove('active');
  $('livePanel').hidden = false; $('schedulePanel').hidden = true;
});
$('scheduleMenu').addEventListener('click', () => {
  $('scheduleMenu').classList.add('active'); $('liveMenu').classList.remove('active');
  $('livePanel').hidden = true; $('schedulePanel').hidden = false;
});
document.querySelectorAll('[data-sdir]').forEach(b => b.addEventListener('click', () => {
  scheduleDirection = b.dataset.sdir;
  document.querySelectorAll('[data-sdir]').forEach(x => x.classList.toggle('active', x === b));
}));
$('scheduleSearchBtn').addEventListener('click', loadScheduledFlights);
$('scheduleSearch').addEventListener('keydown', e => { if (e.key === 'Enter') loadScheduledFlights(); });
$('airportCode').addEventListener('keydown', e => { if (e.key === 'Enter') loadScheduledFlights(); });

async function loadScheduledFlights() {
  if (!loggedIn) return;
  $('scheduleStatus').textContent = '정기운항편 일정을 조회하고 있습니다…';
  const params = new URLSearchParams({ direction: scheduleDirection, numOfRows: '1000' });
  const airport = $('airportCode').value.trim().toUpperCase();
  if (airport) params.set('airport', airport);
  try {
    const r = await fetch(`/api/scheduled-flights?${params}`);
    const d = await r.json();
    if (!r.ok) throw new Error(d.message || '정기운항편 조회 실패');
    const body = d?.response?.body || d?.body || {};
    const items = body?.items?.item ?? body?.items ?? d?.items?.item ?? d?.items ?? [];
    scheduledFlights = Array.isArray(items) ? items : (items ? [items] : []);
    const total = body.totalCount ?? scheduledFlights.length;
    $('scheduleStatus').textContent = `${scheduledFlights.length}건 표시 / 전체 ${total}건 · 시즌별 정기운항 일정`;
    renderScheduledFlights();
  } catch (e) {
    $('scheduleStatus').textContent = e.message;
    $('scheduleResults').innerHTML = '';
  }
}

function renderScheduledFlights() {
  const q = $('scheduleSearch').value.trim().toLowerCase();
  const season = $('season').value.trim().toLowerCase();
  const list = scheduledFlights.filter(f =>
    (!q || `${f.flightid || ''} ${f.airline || ''}`.toLowerCase().includes(q)) &&
    (!season || String(f.season || '').toLowerCase().includes(season))
  );
  const weekdays = [
    ['월', 'monday'], ['화', 'tuesday'], ['수', 'wednesday'],
    ['목', 'thursday'], ['금', 'friday'], ['토', 'saturday'], ['일', 'sunday']
  ];
  $('scheduleResults').innerHTML = list.map(f => {
    const days = weekdays.filter(([, key]) => String(f[key] || '').toUpperCase() === 'Y').map(([day]) => day).join(' · ') || '운항 요일 정보 없음';
    const time = String(f.st || '');
    const formattedTime = time.length >= 4 ? `${time.slice(0,2)}:${time.slice(2,4)}` : (time || '-');
    const dateRange = `${formatScheduleDate(f.firstdate)} ~ ${formatScheduleDate(f.lastdate)}`;
    const share = String(f.codeshare || '').toLowerCase();
    const shareLabel = share === 'master' ? '마스터편' : share === 'slave' ? '공동운항편' : (f.codeshare || '-');
    const rows = [
      [scheduleDirection === 'arrival' ? '출발 공항' : '도착 공항', `${f.airport || '-'} (${f.airportcode || '-'})`],
      ['정기운항 시간', formattedTime],
      ['운항 기간', dateRange],
      ['운항 요일', days],
      ['시즌', f.season || '-'],
      ['공동운항 구분', shareLabel],
      ['마스터 편명', f.masterflightid || '-']
    ];
    return `<article class="flight"><strong>${esc(f.airline || '항공사 정보 없음')} · ${esc(f.flightid || '편명 정보 없음')}</strong><div class="meta">${rows.map(([label,value]) => `<div><b>${esc(label)}:</b> ${esc(value)}</div>`).join('')}</div></article>`;
  }).join('') || '<p class="msg">조건에 맞는 정기운항편이 없습니다.</p>';
}

function formatScheduleDate(value) {
  const s = String(value || '');
  return /^\d{8}$/.test(s) ? `${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}` : (s || '-');
}


// 항공사별 스케줄 디렉터리: 정기운항 API 결과를 항공사 단위로 묶어 표시합니다.
let airlineSchedules = { arrival: [], departure: [] };
let airlineDirectory = [];
let selectedAirline = null;
let airlineDirection = 'arrival';
let airlineDataLoaded = false;

$('airlineMenu').addEventListener('click', () => {
  $('airlineMenu').classList.add('active');
  $('liveMenu').classList.remove('active');
  $('scheduleMenu').classList.remove('active');
  $('livePanel').hidden = true;
  $('schedulePanel').hidden = true;
  $('airlinePanel').hidden = false;
  if (!airlineDataLoaded) loadAirlineDirectory();
});
$('liveMenu').addEventListener('click', () => {
  $('liveMenu').classList.add('active');
  $('scheduleMenu').classList.remove('active');
  $('airlineMenu').classList.remove('active');
  $('livePanel').hidden = false;
  $('schedulePanel').hidden = true;
  $('airlinePanel').hidden = true;
});
$('scheduleMenu').addEventListener('click', () => {
  $('scheduleMenu').classList.add('active');
  $('liveMenu').classList.remove('active');
  $('airlineMenu').classList.remove('active');
  $('livePanel').hidden = true;
  $('schedulePanel').hidden = false;
  $('airlinePanel').hidden = true;
});
$('airlineRefreshBtn').addEventListener('click', loadAirlineDirectory);
$('airlineBackBtn').addEventListener('click', () => {
  selectedAirline = null;
  $('airlineDetail').hidden = true;
  $('airlineDirectory').hidden = false;
});
document.querySelectorAll('[data-adir]').forEach(b => b.addEventListener('click', () => {
  airlineDirection = b.dataset.adir;
  document.querySelectorAll('[data-adir]').forEach(x => x.classList.toggle('active', x === b));
  renderSelectedAirlineSchedule();
}));
$('airlineFlightFilter').addEventListener('input', renderSelectedAirlineSchedule);
$('airlineSeasonFilter').addEventListener('input', renderSelectedAirlineSchedule);

function airlineCodeFromFlight(f) {
  const id = String(f.flightid || f.flightId || '').trim().toUpperCase();
  const match = id.match(/^([A-Z0-9]{2})/);
  return match ? match[1] : 'ETC';
}
function airlineBrand(code) {
  const brands = {
    KE: { color: '#07539b', bg: '#e7f1fb', mark: '대한항공' },
    OZ: { color: '#8b1e5a', bg: '#f8eaf2', mark: '아시아나' },
    LJ: { color: '#c92b35', bg: '#fff0f0', mark: '진에어' },
    '7C': { color: '#f07819', bg: '#fff2e5', mark: '제주항공' },
    TW: { color: '#c92732', bg: '#fff0f1', mark: '티웨이' },
    BX: { color: '#087b9a', bg: '#e7f6fa', mark: '에어부산' },
    RS: { color: '#c6293b', bg: '#fff0f2', mark: '에어서울' },
    ZE: { color: '#5a9b35', bg: '#eff8e9', mark: '이스타' },
    YP: { color: '#153e73', bg: '#eaf0f8', mark: '에어프레미아' },
    '8Y': { color: '#4d5c77', bg: '#edf0f5', mark: '화물항공' }
  };
  return brands[code] || { color: '#315b83', bg: '#edf3f8', mark: code === 'ETC' ? '기타' : code };
}
function normalizeAirlineName(f) {
  return String(f.airline || f.airlineName || '항공사 정보 없음').trim();
}
async function fetchAirlineSchedules(direction) {
  const params = new URLSearchParams({ direction, numOfRows: '1000' });
  const response = await fetch(`/api/scheduled-flights?${params}`);
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || '정기운항편 조회에 실패했습니다.');
  const body = data?.response?.body || data?.body || {};
  const raw = body?.items?.item ?? body?.items ?? data?.items?.item ?? data?.items ?? [];
  return Array.isArray(raw) ? raw : (raw ? [raw] : []);
}
async function loadAirlineDirectory() {
  $('airlineStatus').textContent = '항공사별 도착·출발 정기운항 정보를 불러오고 있습니다…';
  $('airlineDirectory').innerHTML = '';
  $('airlineDetail').hidden = true;
  $('airlineDirectory').hidden = false;
  try {
    const [arrivals, departures] = await Promise.all([
      fetchAirlineSchedules('arrival'), fetchAirlineSchedules('departure')
    ]);
    airlineSchedules = { arrival: arrivals, departure: departures };
    const map = new Map();
    [...arrivals, ...departures].forEach(f => {
      const code = airlineCodeFromFlight(f);
      const name = normalizeAirlineName(f);
      const key = `${code}|${name}`;
      if (!map.has(key)) map.set(key, { code, name, arrivalCount: 0, departureCount: 0 });
      const item = map.get(key);
      if (airlineSchedules.arrival.includes(f)) item.arrivalCount++;
      else item.departureCount++;
    });
    airlineDirectory = [...map.values()].sort((a,b) => a.name.localeCompare(b.name, 'ko'));
    airlineDataLoaded = true;
    $('airlineStatus').textContent = `총 ${airlineDirectory.length}개 항공사 · 도착 ${arrivals.length}편 · 출발 ${departures.length}편`;
    renderAirlineDirectory();
  } catch (error) {
    $('airlineStatus').textContent = error.message;
    $('airlineDirectory').innerHTML = '<p class="msg">항공사 목록을 불러오지 못했습니다. 잠시 후 새로고침해 주세요.</p>';
  }
}
function renderAirlineDirectory() {
  $('airlineDirectory').innerHTML = airlineDirectory.map((a, index) => {
    const brand = airlineBrand(a.code);
    return `<button type="button" class="airline-card" data-airline-index="${index}">
      <span class="airline-mark" style="--brand:${brand.color};--brand-bg:${brand.bg}"><img class="airline-logo-img" src="/airline-logos/${encodeURIComponent(a.code)}.svg" alt="${esc(a.name)} 로고" onerror="this.remove();this.parentElement.textContent='${esc(a.code)}'"></span>
      <span class="airline-card-copy"><strong>${esc(a.name)}</strong><small>${esc(a.code)} · 도착 ${a.arrivalCount}편 · 출발 ${a.departureCount}편</small></span>
      <span class="airline-arrow">›</span>
    </button>`;
  }).join('') || '<p class="msg">조회된 항공사 정보가 없습니다.</p>';
  $('airlineDirectory').querySelectorAll('[data-airline-index]').forEach(button => {
    button.addEventListener('click', () => {
      const item = airlineDirectory[Number(button.dataset.airlineIndex)];
      if (item) selectAirline(item);
    });
  });
}
function selectAirline(airline) {
  selectedAirline = airline;
  $('airlineDirectory').hidden = true;
  $('airlineDetail').hidden = false;
  const brand = airlineBrand(airline.code);
  $('selectedAirlineIdentity').innerHTML = `<span class="airline-mark large" style="--brand:${brand.color};--brand-bg:${brand.bg}"><img class="airline-logo-img" src="/airline-logos/${encodeURIComponent(airline.code)}.svg" alt="${esc(airline.name)} 로고" onerror="this.remove();this.parentElement.textContent='${esc(airline.code)}'"></span><span><strong>${esc(airline.name)}</strong><small>${esc(airline.code)} · 항공사 정기운항 스케줄</small></span>`;
  renderSelectedAirlineSchedule();
}
function renderSelectedAirlineSchedule() {
  if (!selectedAirline) return;
  const q = $('airlineFlightFilter').value.trim().toLowerCase();
  const season = $('airlineSeasonFilter').value.trim().toLowerCase();
  const items = airlineSchedules[airlineDirection].filter(f =>
    airlineCodeFromFlight(f) === selectedAirline.code &&
    normalizeAirlineName(f) === selectedAirline.name &&
    (!q || String(f.flightid || '').toLowerCase().includes(q)) &&
    (!season || String(f.season || '').toLowerCase().includes(season))
  );
  const days = [['월','monday'],['화','tuesday'],['수','wednesday'],['목','thursday'],['금','friday'],['토','saturday'],['일','sunday']];
  $('airlineDetailStatus').textContent = `${selectedAirline.name} ${airlineDirection === 'arrival' ? '도착' : '출발'} 정기편 ${items.length}건`;
  $('airlineScheduleResults').innerHTML = items.map(f => {
    const time = String(f.st || '');
    const formatted = time.length >= 4 ? `${time.slice(0,2)}:${time.slice(2,4)}` : (time || '-');
    const weekdays = days.filter(([,key]) => String(f[key] || '').toUpperCase() === 'Y').map(([day]) => day).join(' · ') || '-';
    const date = `${formatScheduleDate(f.firstdate)} ~ ${formatScheduleDate(f.lastdate)}`;
    const airportLabel = airlineDirection === 'arrival' ? '출발 공항' : '도착 공항';
    return `<article class="flight"><strong>${esc(f.flightid || '-')}</strong><div class="meta">
      <div><b>${airportLabel}:</b> ${esc(f.airport || '-')} (${esc(f.airportcode || '-')})</div>
      <div><b>운항 시간:</b> ${esc(formatted)}</div><div><b>운항 요일:</b> ${esc(weekdays)}</div>
      <div><b>운항 기간:</b> ${esc(date)}</div><div><b>시즌:</b> ${esc(f.season || '-')}</div>
      <div><b>공동운항:</b> ${esc(f.codeshare || '-')}</div>
    </div></article>`;
  }).join('') || '<p class="msg">선택한 항공사의 조건에 맞는 정기운항편이 없습니다.</p>';
}
