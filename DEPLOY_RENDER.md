# Render 배포 안내

1. Render에서 New > Web Service 선택
2. GitHub 저장소 `incheon-flight-app` 연결
3. Runtime Node 선택
4. Build Command `npm install`
5. Start Command `npm start`
6. Environment에 다음 항목 등록
   - `DATA_GO_KR_SERVICE_KEY`: 기존 공공데이터포털 인증키
   - `APP_ACCESS_CODE`: 직원 공용 로그인 비밀번호
   - `NODE_ENV`: `production`
7. 배포 후 `https://서비스주소/health` 접속해 `ok: true` 확인

인증키와 비밀번호를 소스코드에 입력하거나 GitHub에 올리지 마세요.
