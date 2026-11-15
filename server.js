import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';
const app=express(); const __dirname=path.dirname(fileURLToPath(import.meta.url));
const PORT=process.env.PORT||3000; const SERVICE_KEY=process.env.DATA_GO_KR_SERVICE_KEY; const ACCESS_CODE=process.env.APP_ACCESS_CODE;
const SCHEDULE_SERVICE_KEY=process.env.PAX_FLT_SCHED_SERVICE_KEY||SERVICE_KEY;
function key(v){if(!v)return v;try{return decodeURIComponent(v)}catch{return v}}
const normalizedServiceKey = key;
app.use(helmet({contentSecurityPolicy:false})); app.use(express.json({limit:'20kb'})); app.use('/api/',rateLimit({windowMs:60000,limit:90})); app.use(express.static(path.join(__dirname,'public')));
const cache=new Map();
app.post('/api/login',(req,res)=>{if(!ACCESS_CODE)return res.status(503).json({message:'서버 접근 비밀번호가 설정되지 않았습니다.'});if(req.body?.code!==ACCESS_CODE)return res.status(401).json({message:'비밀번호가 올바르지 않습니다.'});res.json({ok:true})});
function xmlVal(s,t){const m=s.match(new RegExp(`<${t}[^>]*>([\s\S]*?)<\/${t}>`,'i'));return m?m[1].replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'").trim():''}
function parseXml(xml){const hb=xml.match(/<header[^>]*>([\s\S]*?)<\/header>/i)?.[1]||xml;const bb=xml.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1]||xml;const items=[...bb.matchAll(/<item[^>]*>([\s\S]*?)<\/item>/gi)].map(m=>{const o={};for(const t of ['airline','flightId','flightid','airport','airportCode','airportcode','scheduleDateTime','scheduleDate','scheduleTime','estimatedDateTime','estimatedDate','estimatedTime','terminalid','terminal','gatenumber','gate','carousel','chkinrange','remark','status','scheduleDatetime','changeDatetime','airportName','airportname']){const v=xmlVal(m[1],t);if(v)o[t]=v}return o});return {response:{header:{resultCode:xmlVal(hb,'resultCode'),resultMsg:xmlVal(hb,'resultMsg')},body:{items:{item:items},totalCount:Number(xmlVal(bb,'totalCount')||items.length),numOfRows:Number(xmlVal(bb,'numOfRows')||items.length),pageNo:Number(xmlVal(bb,'pageNo')||1)}}}}
function normFlight(f){return {...f,airline:f.airline||f.airlineName||'',flightId:f.flightId||f.flightid||f.flightno||f.flightNo||'',airport:f.airport||f.airportName||f.airportname||f.airportEngName||'',scheduleDateTime:f.scheduleDateTime||f.scheduleDatetime||f.scheduleDate||f.scheduleTime||f.schedule||'',estimatedDateTime:f.estimatedDateTime||f.changeDatetime||f.estimatedDate||f.estimatedTime||'',terminalid:f.terminalid||f.terminal||f.terminalId||'',gatenumber:f.gatenumber||f.gate||f.gateNo||'',carousel:f.carousel||f.baggage||f.carouselNo||'',chkinrange:f.chkinrange||f.checkin||f.checkInCounter||'',remark:f.remark||f.status||f.flightStatus||''}}
app.get('/api/flights',async(req,res)=>{if(!SERVICE_KEY)return res.status(503).json({message:'항공편 API 인증키가 서버에 설정되지 않았습니다.'});const dir=req.query.direction==='departure'?'departure':'arrival';const date=String(req.query.date||'').replaceAll('-','');if(!/^\d{8}$/.test(date))return res.status(400).json({message:'날짜 형식이 올바르지 않습니다.'});const ck=`live:${dir}:${date}`;const old=cache.get(ck);if(old&&Date.now()-old.time<20000)return res.json(old.data);try{const op=dir==='arrival'?'getFltArrivalsDeOdp':'getFltDeparturesDeOdp';const u=new URL(`https://apis.data.go.kr/B551177/statusOfAllFltDeOdp/${op}`);u.searchParams.set('serviceKey',key(SERVICE_KEY));u.searchParams.set('pageNo','1');u.searchParams.set('numOfRows','500');u.searchParams.set('searchdtCode','E');u.searchParams.set('searchDate',date);u.searchParams.set('searchFrom','0000');u.searchParams.set('searchTo','2400');u.searchParams.set('passengerOrCargo','P');u.searchParams.set('type','json');const r=await fetch(u,{headers:{Accept:'application/json, application/xml, text/xml'}});const raw=await r.text();if(!r.ok)return res.status(502).json({message:`실시간 운항 API HTTP 오류 (${r.status})`,detail:raw.slice(0,500)});let d;try{d=JSON.parse(raw)}catch{if(!raw.trim().startsWith('<'))return res.status(502).json({message:'실시간 API 응답 형식을 해석하지 못했습니다.',detail:raw.slice(0,500)});d=parseXml(raw)}const h=d?.response?.header||d?.header||{};if(h.resultCode&&!['00','0000'].includes(String(h.resultCode)))return res.status(502).json({message:`실시간 운항 API 오류: ${h.resultMsg||h.resultCode}`,detail:JSON.stringify(h)});const body=d?.response?.body||d?.body||{};let items=body?.items?.item??body?.items??[];if(!Array.isArray(items))items=items?[items]:[];const normalized={response:{header:h,body:{...body,items:{item:items.map(normFlight)},totalCount:body.totalCount??items.length}}};cache.set(ck,{time:Date.now(),data:normalized});res.json(normalized)}catch(e){res.status(502).json({message:'실시간 운항 API 연결 실패',detail:e.message})}});

// 여객기 정기운항편 일정 정보: 기존 실시간 API와 분리
function xmlValue(block, tag) {
  const match = block.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  if (!match) return '';
  return match[1]
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'").trim();
}

function parseScheduleXml(xml) {
  const itemBlocks = [...xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi)];
  const items = itemBlocks.map(match => {
    const item = {};
    for (const tag of [
      'airline', 'airport', 'airportcode', 'codeshare', 'firstdate',
      'flightid', 'friday', 'lastdate', 'monday', 'masterflightid',
      'saturday', 'season', 'st', 'sunday', 'thursday', 'tuesday',
      'wednesday', 'tmp1', 'tmp2'
    ]) item[tag] = xmlValue(match[1], tag);
    return item;
  });
  const header = xml.match(/<header(?:\s[^>]*)?>([\s\S]*?)<\/header>/i)?.[1] || xml;
  const body = xml.match(/<body(?:\s[^>]*)?>([\s\S]*?)<\/body>/i)?.[1] || xml;
  return {
    response: {
      header: { resultCode: xmlValue(header, 'resultCode'), resultMsg: xmlValue(header, 'resultMsg') },
      body: {
        items: { item: items },
        numOfRows: Number(xmlValue(body, 'numOfRows') || items.length),
        pageNo: Number(xmlValue(body, 'pageNo') || 1),
        totalCount: Number(xmlValue(body, 'totalCount') || items.length)
      }
    }
  };
}

app.get('/api/scheduled-flights', async (req, res) => {
  if (!SCHEDULE_SERVICE_KEY) return res.status(503).json({ message: '정기운항편 API 인증키가 서버에 설정되지 않았습니다.' });
  const direction = req.query.direction === 'departure' ? 'departure' : 'arrival';
  const operation = direction === 'arrival' ? 'getPaxFltSchedArrivals' : 'getPaxFltSchedDepartures';
  const params = {
    pageNo: String(req.query.pageNo || '1'),
    numOfRows: String(Math.min(Number(req.query.numOfRows || 1000), 1000)),
    lang: 'K',
    type: 'json'
  };
  const airport = String(req.query.airport || '').trim().toUpperCase();
  if (airport) {
    if (!/^[A-Z]{3}$/.test(airport)) return res.status(400).json({ message: '공항코드는 영문 3자리로 입력해 주세요.' });
    params.airport = airport;
  }
  const cacheKey = `schedule:${direction}:${JSON.stringify(params)}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.time < 300_000) return res.json(cached.data);

  try {
    const url = new URL(`https://apis.data.go.kr/B551177/PaxFltSched/${operation}`);
    url.searchParams.set('serviceKey', normalizedServiceKey(SCHEDULE_SERVICE_KEY));
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    const response = await fetch(url, { headers: { Accept: 'application/json, application/xml, text/xml' } });
    const body = await response.text();
    if (!response.ok) return res.status(502).json({ message: `정기운항편 API 오류 (HTTP ${response.status})`, detail: body.slice(0, 300) });

    let data;
    try {
      data = JSON.parse(body);
    } catch {
      if (!body.trim().startsWith('<')) {
        return res.status(502).json({ message: '정기운항편 API 응답을 해석하지 못했습니다.', detail: body.slice(0, 300) });
      }
      data = parseScheduleXml(body);
    }
    const resultCode = data?.response?.header?.resultCode ?? data?.header?.resultCode;
    if (resultCode && !['00', '0000'].includes(String(resultCode))) {
      const resultMsg = data?.response?.header?.resultMsg ?? data?.header?.resultMsg ?? '알 수 없는 API 오류';
      return res.status(502).json({ message: `정기운항편 API 오류: ${resultMsg}` });
    }
    cache.set(cacheKey, { time: Date.now(), data });
    res.json(data);
  } catch (error) {
    res.status(502).json({ message: '정기운항편 API 연결에 실패했습니다.', detail: error.message });
  }
});


app.get('/health',(_req,res)=>res.json({ok:true,service:'incheon-flight-app',time:new Date().toISOString()}));
app.get('*',(_req,res)=>res.sendFile(path.join(__dirname,'public','index.html')));
app.listen(PORT,()=>console.log(`Flight app listening on ${PORT}`));
