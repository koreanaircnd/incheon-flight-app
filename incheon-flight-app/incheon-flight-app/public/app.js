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
async function loadFlights(){
 if(!loggedIn)return;
 $('status').textContent='운항 정보를 조회하고 있습니다…';
 try{
  const r=await fetch(`/api/flights?direction=${direction}&date=${$('date').value}`);
  const d=await r.json(); if(!r.ok)throw new Error(d.message||'조회 실패');
  const body=d?.response?.body || d?.body || {};
  const items=body?.items?.item ?? body?.items ?? [];
  flights=Array.isArray(items)?items:(items?[items]:[]);
  $('status').textContent=`${flights.length}건 조회 · 1분마다 자동 갱신`;
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
async function loadScheduledFlights() {
  if (!loggedIn) return;
  $('scheduleStatus').textContent = '정기운항편 일정을 조회하고 있습니다…';
  const params = new URLSearchParams({ direction: scheduleDirection });
  const flightId = $('scheduleSearch').value.trim();
  const airportCode = $('airportCode').value.trim().toUpperCase();
  const season = $('season').value.trim().toUpperCase();
  const terminalId = $('scheduleTerminal').value;
  if (flightId) params.set('flightId', flightId);
  if (airportCode) params.set('airportCode', airportCode);
  if (season) params.set('season', season);
  if (terminalId) params.set('terminalId', terminalId);
  try {
    const r = await fetch(`/api/scheduled-flights?${params}`);
    const d = await r.json();
    if (!r.ok) throw new Error(d.message || '정기운항편 조회 실패');
    const body = d?.response?.body || d?.body || {};
    const items = body?.items?.item ?? body?.items ?? d?.items?.item ?? d?.items ?? [];
    scheduledFlights = Array.isArray(items) ? items : (items ? [items] : []);
    $('scheduleStatus').textContent = `${scheduledFlights.length}건 조회 · 정기운항 일정 정보`;
    renderScheduledFlights();
  } catch (e) {
    $('scheduleStatus').textContent = e.message;
    $('scheduleResults').innerHTML = '';
  }
}
function renderScheduledFlights() {
  const q = $('scheduleSearch').value.trim().toLowerCase();
  const list = scheduledFlights.filter(f => !q || String(f.flightId || f.flight_id || '').toLowerCase().includes(q));
  const fields = [
    ['운항 항공사', ['airline','airlineName','airlineNm']],
    ['편명', ['flightId','flight_id','masterFlightId']],
    [scheduleDirection === 'arrival' ? '출발 공항' : '도착 공항', ['airport','airportName','airportNm']],
    ['공항 코드', ['airportCode','airport_code']],
    ['운항 시간', ['scheduleStartTime','scheduleTime','startTime']],
    ['운항 시작일', ['scheduleStartDate','startDate','startDt']],
    ['운항 종료일', ['scheduleEndDate','endDate','endDt']],
    ['시즌', ['season','seasonName']],
    ['터미널', ['terminalId','terminalid']],
    ['요일 정보', ['dayOfWeek','weekday','sun','mon','tue','wed','thu','fri','sat']],
    ['공동운항', ['codeshare','codeShare']],
    ['마스터 편명', ['masterFlightId','masterFlight']]
  ];
  $('scheduleResults').innerHTML = list.map(f => {
    const get = keys => keys.map(k => f[k]).find(v => v !== undefined && v !== null && v !== '');
    const title = get(['airline','airlineName','airlineNm']) || '항공사 정보 없음';
    const flight = get(['flightId','flight_id','masterFlightId']) || '편명 정보 없음';
    const rows = fields.slice(2).map(([label, keys]) => {
      const value = get(keys);
      return value === undefined ? '' : `<div><b>${esc(label)}:</b> ${esc(Array.isArray(value) ? value.join(', ') : value)}</div>`;
    }).join('');
    return `<article class="flight"><strong>${esc(title)} · ${esc(flight)}</strong><div class="meta">${rows || '세부 일정 항목이 제공되지 않았습니다.'}</div></article>`;
  }).join('') || '<p class="msg">조건에 맞는 정기운항편이 없습니다.</p>';
}
