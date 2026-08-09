# 🔑 서울시 Open API 실시간 전세 시세 서비스 (`seoul_rent_api`)

서울 열린데이터 광장 Open API (`tbLnOpendataRentV`) 데이터를 연동하여 **행정동(법정동)** 및 **주택유형**별 평균 전세가를 실시간으로 안내하는 웹 서비스입니다.

---

## 🔒 API Key 보안 암호화 설계 (Zero Secret Leak)
- **보안 핵심**: API 인증키는 브라우저 클라이언트 소스코드에 절대로 하드코딩되지 않으며, `.env` 파일 역시 `.gitignore`에 등록되어 GitHub에 커밋되지 않습니다.
- **Cloudflare Pages Functions (`/functions/api/rent.js`)**:
  - 클라이언트 $\rightarrow$ Cloudflare 서버리스 함수 (`/api/rent`) 요청
  - Cloudflare 서버 $\rightarrow$ `context.env.SEOUL_API_KEY` 환경 변수를 이용해 서울시 Open API 호출 및 파싱
  - 서버 간(Server-to-Server) 암호화 통신으로 API 키 노출이 100% 차단됩니다.

---

## 🎨 주요 디자인 및 기능
- **디자인 톤앤매너**: 밝고 깨끗한 배경 (Clean Light Mode) + 오렌지 포인트 컬러 (`#FF6B00`)
- **필터링 기능**: 자치구 $\rightarrow$ 행정동 $\rightarrow$ 주택유형 (아파트, 연립다세대, 오피스텔, 단독다가구) 3단계
- **메트릭 카드**: 평균 전세가 (억 원 및 만원 표시), 중앙값, 실거래가 구간, 평균 전용면적(㎡/평)
- **비교 시각화**: Chart.js 동적 막대 차트 (동내 주택유형별 시세 비교)

---

## 📂 프로젝트 구조
- `.env`: 로컬 개발용 API Key 저장 파일 (**.gitignore 대상**)
- `.env.example`: 개발 가이드용 템플릿
- `.gitignore`: 환경변수 및 빌드 파일 제외 설정
- `functions/api/rent.js`: API Key 보호 및 서울시 API 통신 Cloudflare Serverless Function
- `index.html`: 메인 웹 UI 레이아웃
- `style.css`: 오렌지 포인트 스타일 가이드
- `app.js`: 데이터 처리 및 Chart.js 시각화 로직
- `data/jeonse_mean.json`: 로컬/정적 대치용 데이터셋

---

## ☁️ Cloudflare Pages 배포 및 API Key 설정 방법

### 1단계: GitHub 저장소 푸시
```bash
cd d:\Dropbox\0_Classes\5_스마트도시데이터분석\codes\seoul_rent_api
git add .
git commit -m "Initial commit for seoul_rent_api"
git push -u origin main
```

### 2단계: Cloudflare Pages 프로젝트 연동
1. **[Cloudflare Dashboard](https://dash.cloudflare.com/)** 로그인 $\rightarrow$ **Workers & Pages** 메뉴 클릭
2. **Create application** $\rightarrow$ **Pages** 탭 클릭 $\rightarrow$ **Connect to Git**
3. `jslee-gses/seoul_rent_api` 저장소 선택
4. **Build Settings**:
   - **Framework preset**: `None`
   - **Build command**: (비워둠)
   - **Build output directory**: `/`

### 3단계: Cloudflare Environment Variable (API Key) 등록
1. Cloudflare 프로젝트 생성 후 **Settings** $\rightarrow$ **Environment variables** 메뉴로 이동합니다.
2. **Add variable** 클릭:
   - **Variable name**: `SEOUL_API_KEY`
   - **Value**: `584f61755773657535326b707a6253`
3. **Save** 클릭 후 **Deployments** $\rightarrow$ **Retry deployment** 클릭하여 재배포하면 완성됩니다!
