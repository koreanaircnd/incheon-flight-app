const $ = id => document.getElementById(id);
let direction = 'arrival', flights = [], loggedIn = false;
const today = new Date(); $('date').value = new Date(today.getTime()-today.getTimezoneOffset()*60000).toISOString().slice(0,10);
$('loginBtn').addEventListener('click', async () => {
  const button = $('loginBtn'); button.disabled = true; $('loginMsg').textContent = '로그인 확인 중…';
  try {
    const r = await fetch('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:$('accessCode').value})});
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { $('loginMsg').textContent = d.message || `로그인 실패 (HTTP ${r.status})`; return; }
    loggedIn = true; $('loginPanel').hidden = true; $('appPanel').hidden = false; loadFlights();
  } catch (e) { $('loginMsg').textContent = '서버 연결 오류: ' + e.message; }
  finally { button.disabled = false; }
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
let selectedLiveAirline = '';
const airlineCodeByName = {
  '대한항공':'KE','아시아나항공':'OZ','제주항공':'7C','진에어':'LJ','티웨이항공':'TW','에어부산':'BX','에어서울':'RS','이스타항공':'ZE','에어프레미아':'YP',
  '델타항공':'DL','유나이티드항공':'UA','아메리칸항공':'AA','중국동방항공':'MU','중국남방항공':'CZ','중국국제항공':'CA','일본항공':'JL','전일본공수':'NH','ANA':'NH',
  '캐세이퍼시픽':'CX','싱가포르항공':'SQ','타이항공':'TG','에미레이트항공':'EK','카타르항공':'QR','에티하드항공':'EY','베트남항공':'VN','비엣젯항공':'VJ','필리핀항공':'PR',
  '말레이시아항공':'MH','에어아시아':'AK','홍콩익스프레스':'UO','피치항공':'MM','스쿠트':'TR'
};
function liveAirlineInfo(f){
 const name=String(f.airline||'항공사 미상').trim();
 const flight=String(f.flightId||'').trim().toUpperCase();
 const prefix=(flight.match(/^([A-Z0-9]{2,3})/)||[])[1]||'';
 const code=prefix || airlineCodeByName[name] || (/^[A-Z0-9]{2,3}$/.test(name)?name:'');
 return {key:code||name,code:code||name.slice(0,3),name};
}
$('airlineQuickFilters').addEventListener('click',e=>{
 const btn=e.target.closest('[data-live-airline]'); if(!btn)return;
 selectedLiveAirline=btn.dataset.liveAirline; render();
});
function render(){
 const q=$('filter').value.trim().toLowerCase(), t=$('terminal').value;
 const groups=new Map();
 flights.forEach(f=>{const a=liveAirlineInfo(f);const g=groups.get(a.key)||{...a,count:0};g.count++;groups.set(a.key,g);});
 const chips=[...groups.values()].sort((a,b)=>a.name.localeCompare(b.name,'ko'));
 $('airlineQuickFilters').innerHTML='<button type="button" class="airline-chip '+(!selectedLiveAirline?'selected':'')+'" data-live-airline="">전체 항공사 <small>'+flights.length+'</small></button>'+chips.map(a=>`<button type="button" class="airline-chip ${selectedLiveAirline===a.key?'selected':''}" data-live-airline="${esc(a.key)}" title="${esc(a.name)} 조회" aria-pressed="${selectedLiveAirline===a.key}"><span class="airline-chip-mark">${esc(a.code)}</span><span>${esc(a.name)}</span><small>${a.count}</small></button>`).join('');
 const filtered=flights.filter(f=>{
  const hay=[f.airline,f.flightId,f.airport,f.remark].join(' ').toLowerCase();
  const a=liveAirlineInfo(f);
  const airlineMatch=!selectedLiveAirline||a.key===selectedLiveAirline;
  return airlineMatch&&(!q||hay.includes(q))&&(!t||f.terminalid===t);
 });
 $('results').innerHTML=filtered.map(f=>`<article class="flight"><strong>${esc(f.airline||'항공사 미상')} · ${esc(f.flightId||'편명 미상')}</strong> <span class="state">${esc(f.remark||'상태 미표시')}</span><div class="meta">${direction==='arrival'?'출발지':'도착지'}: ${esc(f.airport||'-')}<br>예정: ${fmt(f.scheduleDateTime)} · 변경: ${fmt(f.estimatedDateTime)}<br>터미널: ${esc(f.terminalid||'-')} · 게이트: ${esc(f.gatenumber||'-')} · ${direction==='arrival'?'수하물 수취대: '+esc(f.carousel||'-'):'체크인: '+esc(f.chkinrange||'-')}</div></article>`).join('')||'<p class="msg">조회된 운항 정보가 없습니다.</p>';
 $('status').textContent=`전체 ${flights.length}건 중 ${filtered.length}건 표시 · 항공사 선택으로 필터링 가능`;
}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function fmt(v){if(!v)return '-';const s=String(v);return s.length===12?`${s.slice(8,10)}:${s.slice(10,12)}`:s;}
setInterval(()=>{if(loggedIn)loadFlights()},60000);
