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
