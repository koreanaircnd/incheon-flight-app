import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';

const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;
const SERVICE_KEY = process.env.DATA_GO_KR_SERVICE_KEY;
const ACCESS_CODE = process.env.APP_ACCESS_CODE;
// 정기운항편 전용 키가 없으면 기존 공공데이터포털 키를 그대로 재사용합니다.
const SCHEDULE_SERVICE_KEY = process.env.PAX_FLT_SCHED_SERVICE_KEY || SERVICE_KEY;

function normalizedServiceKey(value) {
  if (!value) return value;
  // 공공데이터포털의 Encoding 키가 %2B 형태로 저장된 경우 이중 인코딩 방지
  try { return decodeURIComponent(value); } catch { return value; }
}

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '20kb' }));
app.use('/api/', rateLimit({ windowMs: 60_000, limit: 90 }));
app.use(express.static(path.join(__dirname, 'public')));

let cache = new Map();
app.post('/api/login', (req, res) => {
  if (!ACCESS_CODE) return res.status(503).json({ message: '서버 접근 비밀번호가 설정되지 않았습니다.' });
  if (req.body?.code !== ACCESS_CODE) return res.status(401).json({ message: '비밀번호가 올바르지 않습니다.' });
  res.json({ ok: true });
});

app.get('/api/flights', async (req, res) => {
  if (!SERVICE_KEY) return res.status(503).json({ message: '항공편 API 인증키가 서버에 설정되지 않았습니다.' });
  const direction = req.query.direction === 'departure' ? 'departure' : 'arrival';
  const searchday = String(req.query.date || '').replaceAll('-', '');
  if (!/^\d{8}$/.test(searchday)) return res.status(400).json({ message: '날짜 형식이 올바르지 않습니다.' });
  const endpoint = direction === 'arrival'
    ? 'getPassengerArrivalsDeOdp'
    : 'getPassengerDeparturesDeOdp';
  const cacheKey = `${direction}:${searchday}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.time < 45_000) return res.json(cached.data);

  try {
    const url = new URL(`https://apis.data.go.kr/B551177/StatusOfPassengerFlightsDeOdp/${endpoint}`);
    url.searchParams.set('serviceKey', normalizedServiceKey(SERVICE_KEY));
    url.searchParams.set('type', 'json');
    url.searchParams.set('searchday', searchday);
    url.searchParams.set('numOfRows', '500');
    url.searchParams.set('pageNo', '1');
    const response = await fetch(url, { headers: { Accept: 'application/json' } });
    const body = await response.text();
    if (!response.ok) return res.status(502).json({ message: `공공데이터 API 오류 (${response.status})` });
    let data;
    try { data = JSON.parse(body); }
    catch { return res.status(502).json({ message: 'API 응답을 JSON으로 해석하지 못했습니다.', detail: body.slice(0, 300) }); }
    cache.set(cacheKey, { time: Date.now(), data });
    res.json(data);
  } catch (error) {
    res.status(502).json({ message: '항공편 API 연결에 실패했습니다.', detail: error.message });
  }
});



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

app.get('/health', (_req, res) => res.json({ ok: true, service: 'incheon-flight-app', time: new Date().toISOString() }));
app.get('*', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.listen(PORT, () => console.log(`Flight app listening on ${PORT}`));
