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
    url.searchParams.set('serviceKey', SERVICE_KEY);
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

app.get('/health', (_req, res) => res.json({ ok: true, service: 'incheon-flight-app', time: new Date().toISOString() }));
app.get('*', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.listen(PORT, () => console.log(`Flight app listening on ${PORT}`));
