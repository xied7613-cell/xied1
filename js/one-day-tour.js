/**
 * 양구 가족 휴양 여행 가이드 GPS Guide Module (V1.0)
 * EXIF 메타데이터 해독, 하버사인 기반 최단 거리 매핑 및 모바일 소장용 1일 가이드 티켓 HTML 생성/다운로드 담당
 */

let spotsDataForGps = [];
let restaurantsDataForGps = [];
let emergencyDataForGps = [];

// 임시 매칭 결과 보관용
let matchedSpot = null;
let matchedRestaurant = null;
let matchedEmergency = null;
let uploadCoordinates = null; // {lat, lng}

document.addEventListener('DOMContentLoaded', async () => {
  if (document.getElementById('one-day-tour-view')) {
    await initGpsData();
  }
});

/**
 * 기초 데이터 비동기 병렬 로드
 */
async function initGpsData() {
  try {
    if (window.location.protocol === 'file:') {
      console.log('📡 로컬 파일 실행 환경(file://) 감지: GPS 매핑 오프라인 데이터 즉시 로드');
      if (window.YANGGU_SPOTS_DATA && window.YANGGU_RESTAURANTS_DATA && window.YANGGU_EMERGENCY_DATA) {
        spotsDataForGps = window.YANGGU_SPOTS_DATA;
        restaurantsDataForGps = window.YANGGU_RESTAURANTS_DATA;
        emergencyDataForGps = window.YANGGU_EMERGENCY_DATA;
        console.log('📡 GPS 매핑 데이터베이스 로컬 오프라인 데이터 매핑 완료');
      } else {
        console.error('오프라인 데이터베이스(tour-data.js)가 로드되지 않았습니다.');
      }
      return;
    }

    try {
      const [spotsRes, restRes, emerRes] = await Promise.all([
        fetch('../data/spots.json'),
        fetch('../data/restaurants.json'),
        fetch('../data/emergency.json')
      ]);

      spotsDataForGps = await spotsRes.json();
      restaurantsDataForGps = await restRes.json();
      emergencyDataForGps = await emerRes.json();

      console.log('📡 GPS 매핑 데이터베이스 로드 성공');
    } catch (fetchErr) {
      console.warn("Fetch GPS mapping data failed. Falling back to local window variables.", fetchErr);
      if (window.YANGGU_SPOTS_DATA && window.YANGGU_RESTAURANTS_DATA && window.YANGGU_EMERGENCY_DATA) {
        spotsDataForGps = window.YANGGU_SPOTS_DATA;
        restaurantsDataForGps = window.YANGGU_RESTAURANTS_DATA;
        emergencyDataForGps = window.YANGGU_EMERGENCY_DATA;
        console.log('📡 GPS 매핑 데이터베이스 로컬 폴백 로드 성공');
      } else {
        throw fetchErr;
      }
    }
  } catch (error) {
    console.error('GPS용 데이터를 로드하는 중 오류가 발생했습니다:', error);
  }
}

/**
 * EXIF 위경도 도분초(DMS) 배열을 십진수(Decimal Degrees)로 변환
 */
function convertDMSToDD(degrees, minutes, seconds, direction) {
  let dd = degrees + minutes / 60 + seconds / 3600;
  if (direction === "S" || direction === "W") {
    dd = dd * -1;
  }
  return dd;
}

/**
 * 하버사인(Haversine) 공식을 활용한 지구 두 지점 간 대원 거리 계산 (km)
 */
function getHaversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // 지구 반경 (km)
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // 킬로미터 반환
}

/**
 * 사용자가 이미지를 업로드했을 때 호출되는 핵심 핸들러
 */
function handleImageUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  // 로딩 UI 연출
  toggleGpsLoading(true);

  // EXIF 데이터 추출 시작
  EXIF.getData(file, function() {
    const latData = EXIF.getTag(this, "GPSLatitude");
    const lngData = EXIF.getTag(this, "GPSLongitude");
    const latRef = EXIF.getTag(this, "GPSLatitudeRef");
    const lngRef = EXIF.getTag(this, "GPSLongitudeRef");

    if (latData && lngData && latRef && lngRef) {
      // 도분초 파싱하여 십진수 변환
      const lat = convertDMSToDD(latData[0], latData[1], latData[2], latRef);
      const lng = convertDMSToDD(lngData[0], lngData[1], lngData[2], lngRef);
      
      processMatchedCoordinates(lat, lng, false);
    } else {
      // GPS 데이터가 존재하지 않을 때 폴백 UI 제공
      toggleGpsLoading(false);
      showFallbackGpsUI();
    }
  });
}

/**
 * 가상 또는 실제 위경도 좌표 기준 최적 매칭 분석 실행
 * @param {number} lat - 위도
 * @param {number} lng - 경도
 * @param {boolean} isFallback - 가상 매칭 여부
 */
function processMatchedCoordinates(lat, lng, isFallback) {
  uploadCoordinates = { lat, lng };
  
  // 1. 관광지 매칭 (최단 거리 탐색)
  let minSpotDist = Infinity;
  spotsDataForGps.forEach(spot => {
    const dist = getHaversineDistance(lat, lng, spot.lat, spot.lng);
    if (dist < minSpotDist) {
      minSpotDist = dist;
      matchedSpot = { ...spot, dist: dist.toFixed(2) };
    }
  });

  // 2. 식당 매칭 (최단 거리 탐색)
  let minRestDist = Infinity;
  restaurantsDataForGps.forEach(rest => {
    const dist = getHaversineDistance(lat, lng, rest.lat, rest.lng);
    if (dist < minRestDist) {
      minRestDist = dist;
      matchedRestaurant = { ...rest, dist: dist.toFixed(2) };
    }
  });

  // 3. 응급/안전 매칭 (최단 거리 탐색)
  let minEmerDist = Infinity;
  emergencyDataForGps.forEach(emer => {
    const dist = getHaversineDistance(lat, lng, emer.lat, emer.lng);
    if (dist < minEmerDist) {
      minEmerDist = dist;
      matchedEmergency = { ...emer, dist: dist.toFixed(2) };
    }
  });

  // 로딩 해제 및 결과 UI 표출
  toggleGpsLoading(false);
  renderGpsMatchResults(isFallback);
}

/**
 * GPS 로딩 애니메이션 제어
 */
function toggleGpsLoading(show) {
  const loader = document.getElementById('gps-loader');
  const fallbackBox = document.getElementById('gps-fallback-selector');
  const resultBox = document.getElementById('gps-result-card');

  if (loader) loader.style.display = show ? 'flex' : 'none';
  if (show) {
    if (fallbackBox) fallbackBox.style.display = 'none';
    if (resultBox) resultBox.style.display = 'none';
  }
}

/**
 * GPS 데이터 유실 시 가상 선택 드롭다운 박스 노출
 */
function showFallbackGpsUI() {
  const fallbackBox = document.getElementById('gps-fallback-selector');
  if (fallbackBox) {
    fallbackBox.style.display = 'block';
    // 부드러운 스크롤 이동
    fallbackBox.scrollIntoView({ behavior: 'smooth' });
  }
}

/**
 * 가상 랜드마크 선택 버튼 핸들러
 */
function selectFallbackLocation() {
  const selector = document.getElementById('fallback-select');
  if (!selector) return;

  const value = selector.value;
  let lat = 38.1158, lng = 127.9748; // 기본 한반도섬

  if (value === 'arboretum') {
    lat = 38.1706; lng = 128.0934; // 양구수목원
  } else if (value === 'museum') {
    lat = 38.2435; lng = 127.9944; // 백자박물관
  } else if (value === 'observatory') {
    lat = 38.0565; lng = 128.0264; // 천문대
  }

  toggleGpsLoading(true);
  
  // 0.5초 모의 로딩 연출 후 연산 실행
  setTimeout(() => {
    processMatchedCoordinates(lat, lng, true);
  }, 500);
}

/**
 * 매칭된 주변 3대 최적 시설 결과 카드 렌더링
 */
function renderGpsMatchResults(isFallback) {
  const resultBox = document.getElementById('gps-result-card');
  const resultAlert = document.getElementById('gps-result-alert');
  const spotsContainer = document.getElementById('gps-matched-spots');
  const restContainer = document.getElementById('gps-matched-restaurants');
  const emerContainer = document.getElementById('gps-matched-emergency');

  if (!resultBox || !spotsContainer || !restContainer || !emerContainer) return;

  // 알림 칩 내용 정의
  if (resultAlert) {
    resultAlert.innerHTML = isFallback 
      ? `<i class="fas fa-magic" style="color:var(--primary-color);"></i> 가상 매칭 성공! 양구 선택 거점 근처의 1일 최적 안심 코스를 큐레이션했습니다.`
      : `<i class="fas fa-check-circle" style="color:var(--primary-color);"></i> 사진 GPS 디코딩 완료! (위도: ${uploadCoordinates.lat.toFixed(4)}, 경도: ${uploadCoordinates.lng.toFixed(4)}) 촬영지 근처 주변 시설들을 매칭했습니다.`;
  }

  // 1. 관광지 바인딩
  spotsContainer.innerHTML = `
    <div style="display:flex; gap:12px; align-items:center;">
      <div style="background-color: var(--primary-bg); color: var(--primary-color); border-radius:10px; width:44px; height:44px; display:flex; justify-content:center; align-items:center; font-size:18px; flex-shrink:0;">
        <i class="fas fa-map-marker-alt"></i>
      </div>
      <div>
        <h4 style="font-size:14px; font-weight:700; color:var(--text-dark);">${matchedSpot.name}</h4>
        <p style="font-size:11px; color:var(--text-muted); margin-top:2px;">📍 직선거리 <strong>${matchedSpot.dist}km</strong> | ${matchedSpot.category}</p>
      </div>
    </div>
    <p style="font-size:12px; color:var(--text-dark); opacity:0.8; margin-top:8px; line-height:1.4;">${matchedSpot.description}</p>
  `;

  // 2. 식당 바인딩
  restContainer.innerHTML = `
    <div style="display:flex; gap:12px; align-items:center;">
      <div style="background-color: var(--secondary-light); color: var(--secondary-color); border-radius:10px; width:44px; height:44px; display:flex; justify-content:center; align-items:center; font-size:18px; flex-shrink:0;">
        <i class="fas fa-utensils"></i>
      </div>
      <div>
        <h4 style="font-size:14px; font-weight:700; color:var(--text-dark);">${matchedRestaurant.name}</h4>
        <p style="font-size:11px; color:var(--text-muted); margin-top:2px;">📍 직선거리 <strong>${matchedRestaurant.dist}km</strong> | ${matchedRestaurant.category}</p>
      </div>
    </div>
    <p style="font-size:12px; color:var(--text-dark); opacity:0.8; margin-top:8px; line-height:1.4;">${matchedRestaurant.description}</p>
  `;

  // 3. 응급/안전 바인딩
  emerContainer.innerHTML = `
    <div style="display:flex; gap:12px; align-items:center;">
      <div style="background-color: rgba(230, 57, 70, 0.1); color: var(--accent-color); border-radius:10px; width:44px; height:44px; display:flex; justify-content:center; align-items:center; font-size:18px; flex-shrink:0;">
        <i class="fas fa-ambulance"></i>
      </div>
      <div>
        <h4 style="font-size:14px; font-weight:700; color:var(--text-dark);">${matchedEmergency.name}</h4>
        <p style="font-size:11px; color:var(--text-muted); margin-top:2px;">📍 가장 가까운 응급대응처 <strong>${matchedEmergency.dist}km</strong> | ${matchedEmergency.type}</p>
      </div>
    </div>
    <p style="font-size:12px; color:var(--text-dark); opacity:0.8; margin-top:8px; line-height:1.4;">🚨 ${matchedEmergency.tips}</p>
  `;

  // 결과 박스 부드럽게 노출
  resultBox.style.display = 'block';
  resultBox.scrollIntoView({ behavior: 'smooth' });
}

/**
 * 매칭된 스케줄을 포함하여 미려한 오프라인 단일 HTML 가이드 티켓 파일 생성 및 다운로드 실행
 */
function downloadMatchedGuide() {
  if (!matchedSpot || !matchedRestaurant || !matchedEmergency) return;

  const todayStr = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });

  // 1. 위경도 -> SVG 2D 투영 연산 (오프라인 폴백용)
  const minLat = 38.03, maxLat = 38.28;
  const minLng = 127.95, maxLng = 128.12;

  function getXY(lat, lng) {
    // 가로 400px, 세로 300px 스케일링 (패딩 고려)
    const x = ((lng - minLng) / (maxLng - minLng)) * 280 + 60; 
    const y = 300 - (((lat - minLat) / (maxLat - minLat)) * 200 + 50); 
    return { x: Math.round(x), y: Math.round(y) };
  }

  const startCoords = uploadCoordinates || { lat: 38.1158, lng: 127.9748 }; // 기본 한반도섬
  const pStart = getXY(startCoords.lat, startCoords.lng);
  const pSpot = getXY(matchedSpot.lat, matchedSpot.lng);
  const pRest = getXY(matchedRestaurant.lat, matchedRestaurant.lng);
  const pEmer = getXY(matchedEmergency.lat, matchedEmergency.lng);

  // 오프라인용 인라인 감성 지도 템플릿 빌딩
  const htmlTemplate = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>우리가족 양구 맞춤 1일 안심 지도</title>
  <link href="https://fonts.googleapis.com/css2?family=Gowun+Batang:wght@400;700&family=Outfit:wght@400;700&family=Noto+Sans+KR:wght@400;500;700&display=swap" rel="stylesheet">
  <!-- Leaflet CSS (위성지도 로딩용) -->
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    body {
      font-family: 'Outfit', 'Noto Sans KR', -apple-system, sans-serif;
      background-color: #f7f1eb;
      color: #3a2e2b;
      margin: 0;
      padding: 20px;
      display: flex;
      justify-content: center;
    }
    .ticket-container {
      width: 100%;
      max-width: 440px;
      background-color: #fffaf4;
      border-radius: 20px 24px 18px 22px / 22px 18px 24px 20px; /* 불규칙한 다꾸 손그림 라운딩 */
      box-shadow: 0 16px 40px rgba(58, 46, 43, 0.15);
      overflow: visible; /* 마스킹 테이프가 바깥으로 비져나오도록 설정 */
      border: 2px solid #3a2e2b; /* 굵고 귀여운 테두리 */
      position: relative;
      margin-top: 25px;
    }
    /* 다이어리 꾸미기 파스텔 마스킹 테이프 */
    .ticket-container::before {
      content: '';
      position: absolute;
      top: -12px;
      left: 50%;
      transform: translateX(-50%) rotate(-3deg);
      width: 120px;
      height: 24px;
      background-color: rgba(254, 215, 170, 0.85); /* 파스텔 오렌지 살구 테이프 */
      border-left: 1px dashed rgba(255, 255, 255, 0.6);
      border-right: 1px dashed rgba(255, 255, 255, 0.6);
      box-shadow: 0 2px 5px rgba(0,0,0,0.06);
      z-index: 10;
    }
    
    /* 꼬마 전구 반짝임 스타일링 */
    .fairy-lights {
      display: flex;
      justify-content: space-around;
      align-items: center;
      width: 100%;
      height: 12px;
      padding: 0 20px;
      margin: 0;
      list-style: none;
      position: absolute;
      top: 4px;
      left: 0;
      z-index: 99;
    }
    .fairy-lights li {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background-color: #ff6b6b;
      color: #ff6b6b;
      box-shadow: 0 0 5px #ff6b6b;
      animation: bulb-flash 0.8s infinite ease-in-out alternate;
    }
    .fairy-lights li:nth-child(2n) {
      background-color: #f0a500;
      color: #f0a500;
      box-shadow: 0 0 5px #f0a500;
      animation-delay: 0.15s;
    }
    .fairy-lights li:nth-child(3n) {
      background-color: #4dabf7;
      color: #4dabf7;
      box-shadow: 0 0 5px #4dabf7;
      animation-delay: 0.3s;
    }
    .fairy-lights li:nth-child(4n) {
      background-color: #51cf66;
      color: #51cf66;
      box-shadow: 0 0 5px #51cf66;
      animation-delay: 0.45s;
    }
    @keyframes bulb-flash {
      0% { opacity: 0.3; transform: scale(0.85); }
      100% { opacity: 1; transform: scale(1.15); }
    }

    /* 참 잘했어요 💮 스탬프 */
    .vintage-stamp {
      position: absolute;
      top: 75px;
      right: 15px;
      width: 58px;
      height: 58px;
      border-radius: 50%;
      border: 2px dashed rgba(255, 107, 107, 0.85);
      color: #ff6b6b;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      font-size: 8px;
      font-weight: 800;
      text-align: center;
      transform: rotate(15deg);
      background-color: rgba(255, 240, 240, 0.9);
      box-shadow: 0 2px 4px rgba(0,0,0,0.05);
      z-index: 15;
      pointer-events: none;
      line-height: 1.1;
      font-family: 'Gowun Batang', serif;
    }
    .vintage-stamp span {
      font-size: 16px;
      margin-bottom: 1px;
    }

    .ticket-header {
      background: linear-gradient(135deg, #ff6b6b, #f0a500);
      color: #ffffff;
      padding: 34px 24px 24px 24px;
      text-align: center;
      position: relative;
      border-bottom: 2px solid #3a2e2b;
    }
    .ticket-header h1 {
      font-family: 'Gowun Batang', serif;
      font-size: 23px;
      margin: 0;
      font-weight: 700;
      letter-spacing: -0.5px;
      text-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .ticket-header p {
      font-size: 12px;
      opacity: 0.95;
      margin: 6px 0 0 0;
      font-weight: 500;
    }
    
    /* 감성 지도 보드 스타일링 (마스킹 테이프로 부착된 판넬 연출) */
    .map-board {
      margin: 24px 20px 0 20px;
      background-color: #faf3e8;
      border: 2px solid #3a2e2b;
      border-radius: 16px;
      padding: 12px;
      position: relative;
      overflow: hidden;
      box-shadow: 3px 3px 0px #3a2e2b;
    }
    /* 지도 고정 미니 스티커 테이프 */
    .map-board::before {
      content: '';
      position: absolute;
      top: -6px;
      left: 10%;
      width: 45px;
      height: 14px;
      background-color: rgba(167, 244, 222, 0.8); /* 민트 테이프 */
      transform: rotate(-5deg);
      border-left: 1px dashed rgba(255,255,255,0.4);
      border-right: 1px dashed rgba(255,255,255,0.4);
      z-index: 5;
    }
    .map-board::after {
      content: '';
      position: absolute;
      top: -4px;
      right: 10%;
      width: 45px;
      height: 14px;
      background-color: rgba(230, 204, 255, 0.8); /* 퍼플 테이프 */
      transform: rotate(3deg);
      border-left: 1px dashed rgba(255,255,255,0.4);
      border-right: 1px dashed rgba(255,255,255,0.4);
      z-index: 5;
    }
    
    .map-board-title {
      font-family: 'Gowun Batang', serif;
      font-size: 13px;
      font-weight: 700;
      color: #7d6e6a;
      display: flex;
      justify-content: space-between;
      margin-bottom: 8px;
      border-bottom: 1.5px solid #3a2e2b;
      padding-bottom: 4px;
    }
    
    /* 위성 지도용 캔버스 */
    #satellite-map-canvas {
      width: 100%;
      height: 300px;
      background-color: #eee;
      border-radius: 8px;
      border: 1.5px solid #3a2e2b;
      display: none; 
    }
    
    .vector-map-svg {
      width: 100%;
      height: auto;
      background-color: #fcf6eb;
      border-radius: 8px;
      border: 1.5px solid #3a2e2b;
    }
    
    .ticket-body {
      padding: 24px 20px;
    }
    .timeline-item {
      position: relative;
      padding-left: 24px;
      margin-bottom: 24px;
    }
    .timeline-item::before {
      content: '';
      position: absolute;
      left: 7px;
      top: 4px;
      bottom: -20px;
      width: 3px;
      background-color: #ff6b6b;
      opacity: 0.3;
    }
    .timeline-item:last-child::before {
      display: none;
    }
    .timeline-marker {
      position: absolute;
      left: 0;
      top: 4px;
      width: 16px;
      height: 16px;
      border-radius: 50%;
      background-color: #ff6b6b;
      border: 3px solid #3a2e2b;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      z-index: 2;
    }
    .timeline-time {
      font-size: 11px;
      font-weight: 700;
      color: #ff6b6b;
      background-color: #fff0f0;
      padding: 2px 8px;
      border-radius: 100px;
      border: 1px solid #ff6b6b;
      display: inline-block;
      margin-bottom: 6px;
    }
    
    /* 파스텔톤 다꾸 포스트잇(Post-it) 스케줄 카드 */
    .postit-card {
      background-color: #fff9db; /* 기본 파란 계열 노랑 포스트잇 */
      border: 2px solid #3a2e2b;
      border-radius: 12px 14px 10px 16px / 14px 10px 16px 12px; /* 손그림 느낌 */
      padding: 16px;
      box-shadow: 3px 3px 0px #3a2e2b;
      transform: rotate(-1deg);
      margin-top: 4px;
      position: relative;
    }
    /* 포스트잇 고정 마스킹 테이프 */
    .postit-card::before {
      content: '';
      position: absolute;
      top: -8px;
      left: 30%;
      width: 45px;
      height: 12px;
      background-color: rgba(167, 244, 222, 0.75); /* 민트 테이프 */
      transform: rotate(2deg);
      border-left: 1px dashed rgba(255,255,255,0.4);
      border-right: 1px dashed rgba(255,255,255,0.4);
      z-index: 5;
    }
    
    .postit-pink {
      background-color: #fff0f0;
      transform: rotate(1.2deg);
    }
    .postit-pink::before {
      background-color: rgba(254, 215, 170, 0.75); /* 살구 오렌지 테이프 */
      left: 45%;
    }
    
    .postit-blue {
      background-color: #e6f7ff;
      transform: rotate(-1.3deg);
    }
    .postit-blue::before {
      background-color: rgba(255, 182, 193, 0.75); /* 핑크 테이프 */
      left: 20%;
    }
    
    .card-title {
      font-family: 'Gowun Batang', serif;
      font-size: 15px;
      font-weight: 700;
      margin: 4px 0 6px 0;
      color: #3a2e2b;
    }
    .card-desc {
      font-size: 12.5px;
      color: #4e3d30;
      line-height: 1.5;
      margin: 0;
    }
    .badge {
      background-color: rgba(255, 255, 255, 0.8);
      color: #ff6b6b;
      font-size: 10px;
      font-weight: 800;
      padding: 3px 8px;
      border-radius: 100px;
      border: 1px solid currentColor;
      display: inline-block;
      margin-top: 8px;
      margin-right: 4px;
    }
    
    /* ✂️ 가위 절취선 & 좌우 둥근 티켓 Notch */
    .divider {
      height: 1px;
      border-top: 2px dashed #ff6b6b;
      margin: 28px -20px; /* 좌우 가득 채우기 */
      position: relative;
    }
    .divider::before, .divider::after {
      content: '';
      position: absolute;
      top: -11px;
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background-color: #f7f1eb; /* 바깥쪽 배경과 동일하게 맞추어 펀칭 홀 완성 */
      border: 2px solid #3a2e2b;
      z-index: 5;
    }
    .divider::before {
      left: -11px;
      box-shadow: inset -2px 0 4px rgba(0,0,0,0.05);
    }
    .divider::after {
      right: -11px;
      box-shadow: inset 2px 0 4px rgba(0,0,0,0.05);
    }
    
    .divider-label {
      position: absolute;
      top: -10px;
      left: 50%;
      transform: translateX(-50%);
      background-color: #fffaf4;
      padding: 0 12px;
      font-size: 9px;
      color: #ff6b6b;
      font-weight: 800;
      font-family: 'Gowun Batang', serif;
      letter-spacing: 3px;
      border: 1px solid #ff6b6b;
      border-radius: 100px;
    }
    
    .footer-bar {
      background-color: #fdfaf4;
      padding: 20px 16px;
      text-align: center;
      font-size: 11px;
      color: #a39591;
      border-top: 2px solid #3a2e2b;
    }
    
    /* 리플렛 팝업 사용자 정의 */
    .leaflet-popup-content-wrapper {
      background-color: #fffaf4;
      color: #3a2e2b;
      border-radius: 12px;
      border: 2px solid #3a2e2b;
    }
    .leaflet-popup-tip {
      background-color: #fffaf4;
      border: 2px solid #3a2e2b;
    }
  </style>
</head>
<body>

  <div class="ticket-container">
    
    <!-- 꼬마 전구 스트링 추가 -->
    <ul class="fairy-lights">
      <li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li>
    </ul>

    <!-- 💮 참 잘했어요 스탬프 추가 -->
    <div class="vintage-stamp">
      <span>💮</span>우리가족<br>안심인증
    </div>
    
    <div class="ticket-header">
      <h1>우리가족 맞춤 1일 안심 지도</h1>
      <p>🎈 실제 양구 위성 사진 지형 매칭 큐레이션</p>
      <div style="font-size: 11px; font-weight:700; color: #fff; opacity:0.95; margin-top:12px;">🗓️ 발급일: ${todayStr}</div>
    </div>

    <!-- 감성 벡터 및 대화형 위성 지도 영역 -->
    <div class="map-board">
      <div class="map-board-title">
        <span id="map-label-text">🗺️ 우리가족 맞춤 탐험 지도 (오프라인)</span>
        <span>양구군 안심가이드</span>
      </div>
      
      <!-- 대화형 위성 지도 캔버스 (온라인 시 구동) -->
      <div id="satellite-map-canvas"></div>
      
      <!-- 오프라인 감성 벡터 SVG 지도 (오프라인 폴백) -->
      <svg id="svg-fallback-map" class="vector-map-svg" viewBox="0 0 400 300">
        <!-- 1. 격자선 (Grid Lines) 및 위경도 텍스트 -->
        <g stroke="#e5ded6" stroke-dasharray="3,3" stroke-width="1">
          <line x1="100" y1="0" x2="100" y2="300" />
          <line x1="200" y1="0" x2="200" y2="300" />
          <line x1="300" y1="0" x2="300" y2="300" />
          <line x1="0" y1="75" x2="400" y2="75" />
          <line x1="0" y1="150" x2="400" y2="150" />
          <line x1="0" y1="225" x2="400" y2="225" />
        </g>
        <g fill="#a39591" font-size="8" font-family="sans-serif">
          <text x="105" y="295">128.00°E</text>
          <text x="205" y="295">128.05°E</text>
          <text x="305" y="295">128.10°E</text>
          <text x="5" y="70">38.20°N</text>
          <text x="5" y="145">38.15°N</text>
          <text x="5" y="220">38.10°N</text>
        </g>

        <!-- 2. 나침반 풍판 (Compass Rose) -->
        <g transform="translate(350, 45)">
          <circle cx="0" cy="0" r="18" fill="none" stroke="#dcd1c4" stroke-width="1" />
          <path d="M 0 -22 L 4 -4 L 20 0 L 4 4 L 0 22 L -4 4 L -20 0 L -4 -4 Z" fill="#7d6e6a" />
          <path d="M 0 -22 L 0 0 L 20 0 L 0 0 L 0 22 L 0 0 L -20 0 L 0 0 Z" stroke="#faf3e8" stroke-width="1.5" />
          <text x="-4" y="-24" font-size="8" fill="#7d6e6a" font-weight="700">N</text>
        </g>

        <!-- 3. 경로 동선 점선 (Travel Path Dash) -->
        <polyline points="${pStart.x},${pStart.y} ${pSpot.x},${pSpot.y} ${pRest.x},${pRest.y} ${pEmer.x},${pEmer.y}" 
                  fill="none" stroke="#ff6b6b" stroke-width="3" stroke-dasharray="6,4" stroke-linecap="round" stroke-linejoin="round" />

        <!-- 4. 마커 연결 원 후광 효과 -->
        <circle cx="${pStart.x}" cy="${pStart.y}" r="12" fill="rgba(240, 165, 0, 0.15)" />
        <circle cx="${pSpot.x}" cy="${pSpot.y}" r="12" fill="rgba(255, 107, 107, 0.15)" />
        <circle cx="${pRest.x}" cy="${pRest.y}" r="12" fill="rgba(240, 165, 0, 0.15)" />
        <circle cx="${pEmer.x}" cy="${pEmer.y}" r="12" fill="rgba(255, 74, 90, 0.15)" />

        <!-- 5. 마커 핀 본체 및 이모지 라벨링 -->
        <!-- 📸 출발 거점 -->
        <g transform="translate(${pStart.x}, ${pStart.y})">
          <circle cx="0" cy="0" r="8" fill="#f0a500" stroke="#ffffff" stroke-width="2" />
          <text x="0" y="3" font-size="10" text-anchor="middle">📸</text>
          <rect x="-24" y="-20" width="48" height="11" rx="3" fill="#faf3e8" stroke="#f0a500" stroke-width="1" />
          <text x="0" y="-12" font-size="7" fill="#3a2e2b" font-weight="700" text-anchor="middle">출발거점</text>
        </g>
        
        <!-- 🌲 오전 관광지 -->
        <g transform="translate(${pSpot.x}, ${pSpot.y})">
          <circle cx="0" cy="0" r="8" fill="#40916c" stroke="#ffffff" stroke-width="2" />
          <text x="0" y="3" font-size="10" text-anchor="middle">🌲</text>
          <rect x="-30" y="-20" width="60" height="11" rx="3" fill="#faf3e8" stroke="#40916c" stroke-width="1" />
          <text x="0" y="-12" font-size="7" fill="#3a2e2b" font-weight="700" text-anchor="middle">오전: ${matchedSpot.name.substring(0,6)}</text>
        </g>

        <!-- 🍴 점심 식사 -->
        <g transform="translate(${pRest.x}, ${pRest.y})">
          <circle cx="0" cy="0" r="8" fill="#f0a500" stroke="#ffffff" stroke-width="2" />
          <text x="0" y="3" font-size="10" text-anchor="middle">🍴</text>
          <rect x="-30" y="-20" width="60" height="11" rx="3" fill="#faf3e8" stroke="#f0a500" stroke-width="1" />
          <text x="0" y="-12" font-size="7" fill="#3a2e2b" font-weight="700" text-anchor="middle">점심: ${matchedRestaurant.name.substring(0,6)}</text>
        </g>

        <!-- 🚑 응급 센터 -->
        <g transform="translate(${pEmer.x}, ${pEmer.y})">
          <circle cx="0" cy="0" r="8" fill="#ff4a5a" stroke="#ffffff" stroke-width="2" />
          <text x="0" y="3" font-size="10" text-anchor="middle">🚑</text>
          <rect x="-30" y="-20" width="60" height="11" rx="3" fill="#faf3e8" stroke="#ff4a5a" stroke-width="1" />
          <text x="0" y="-12" font-size="7" fill="#3a2e2b" font-weight="700" text-anchor="middle">안전: ${matchedEmergency.name.substring(0,6)}</text>
        </g>
      </svg>
    </div>

    <!-- 상세 상세 스케줄 내용 -->
    <div class="ticket-body">
      
      <!-- 오전 스케줄 (포스트잇 스타일) -->
      <div class="timeline-item">
        <div class="timeline-marker" style="background-color:#40916c;"></div>
        <span class="timeline-time" style="color:#2d6a4f; background-color:#e8f5e9; border-color:#2d6a4f;">⏱️ 오전 10:30 (자연 힐링 코스)</span>
        <div class="postit-card">
          <h3 class="card-title">🌲 ${matchedSpot.name}</h3>
          <p class="card-desc">${matchedSpot.description}</p>
          <span class="badge" style="color:#2d6a4f;">📍 거점과의 거리 ${matchedSpot.dist}km</span>
          <span class="badge" style="color:#f0a500;">🍼 ${matchedSpot.age_group}</span>
        </div>
      </div>
 
      <!-- 점심 스케줄 (포스트잇 분홍 스타일) -->
      <div class="timeline-item">
        <div class="timeline-marker" style="background-color:#f0a500;"></div>
        <span class="timeline-time" style="color:#f0a500; background-color:#fef5e7; border-color:#f0a500;">⏱️ 오후 12:30 (점심 영양식/가족 쉼터)</span>
        <div class="postit-card postit-pink">
          <h3 class="card-title">🍴 ${matchedRestaurant.name}</h3>
          <p class="card-desc">${matchedRestaurant.description}</p>
          <span class="badge" style="color:#f0a500;">📍 오전 코스에서 ${matchedRestaurant.dist}km</span>
          <span class="badge" style="color:#ff6b6b;">📞 ${matchedRestaurant.phone}</span>
        </div>
      </div>

      <!-- 오후 안전 스케줄 (포스트잇 하늘 스타일) -->
      <div class="timeline-item">
        <div class="timeline-marker" style="background-color:#ff4a5a;"></div>
        <span class="timeline-time" style="color:#ff4a5a; background-color:#ffe3e3; border-color:#ff4a5a;">⏱️ 오후 비상 상황 대처 (가장 가까운 안전 쉼터)</span>
        <div class="postit-card postit-blue">
          <h3 class="card-title">🚑 ${matchedEmergency.name}</h3>
          <p class="card-desc">${matchedEmergency.description}</p>
          <span class="badge" style="color:#ff4a5a;">🚨 현 거점에서 ${matchedEmergency.dist}km 인접</span>
          <span class="badge" style="color:#3a2e2b;">📞 ${matchedEmergency.phone}</span>
        </div>
      </div>

      <!-- ✂️ 절취선에 펀치 Notch와 꼬마 가위 장식 매치 -->
      <div class="divider">
        <span class="divider-label">✂️ 절 취 선 ✂️</span>
      </div>

      <div style="background-color: #fef5e7; border: 2px solid #3a2e2b; padding: 14px; border-radius: 12px; font-size:12px; line-height:1.5; color:#5c4e4b; box-shadow: 2px 2px 0px #3a2e2b; transform: rotate(0.5deg);">
        <strong>💡 우리가족 안심 어드벤처 수첩 꿀팁:</strong><br>${matchedEmergency.tips}
      </div>

    </div>

    <div class="footer-bar">
      <p style="margin: 0; font-weight:700; color:#3a2e2b; font-family:'Gowun Batang', serif; font-size:13px;">🧸 양구 우리가족 안심 어드벤처 지도</p>
      <p style="margin: 6px 0 0 0; line-height:1.4;">오프라인 보존용 지도입니다. 이미지처럼 캡쳐해 두시면 데이터가 끊겨도 언제든 꺼내볼 수 있습니다.</p>
    </div>

  </div>

  <!-- Leaflet.js CDN (위성 지도 구동용) -->
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    window.onload = function() {
      const startLat = ${startCoords.lat}, startLng = ${startCoords.lng};
      const spotLat = ${matchedSpot.lat}, spotLng = ${matchedSpot.lng};
      const restLat = ${matchedRestaurant.lat}, restLng = ${matchedRestaurant.lng};
      const emerLat = ${matchedEmergency.lat}, emerLng = ${matchedEmergency.lng};

      // 1. Leaflet 및 타일 로딩 시도
      if (typeof L !== 'undefined') {
        try {
          // 위성 지도 컨테이너 노출 및 SVG 숨김
          document.getElementById('satellite-map-canvas').style.display = 'block';
          document.getElementById('svg-fallback-map').style.display = 'none';
          document.getElementById('map-label-text').innerText = '🛰️ 우리가족 1일 위성 항공 지도 (실시간)';

          const map = L.map('satellite-map-canvas', {
            zoomControl: true,
            scrollWheelZoom: true
          }).setView([startLat, startLng], 12);

          // Esri World Imagery 위성 타일 추가
          L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
            attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS'
          }).addTo(map);

          // 커스텀 디브 아이콘
          function createEmojiIcon(emoji, bgColor) {
            return L.divIcon({
              html: \`<div style="background-color:\${bgColor}; width:32px; height:32px; border-radius:50%; border:2px solid white; display:flex; justify-content:center; align-items:center; font-size:16px; box-shadow:0 2px 8px rgba(0,0,0,0.35);">\${emoji}</div>\`,
              className: '',
              iconSize: [32, 32],
              iconAnchor: [16, 16]
            });
          }

          // 마커 등록
          L.marker([startLat, startLng], {icon: createEmojiIcon('📸', '#f0a500')})
            .addTo(map).bindPopup('<div style="font-family:\\'Gowun Batang\\', serif; font-weight:700; font-size:13px;">📸 우리 가족 출발지</div>');
            
          L.marker([spotLat, spotLng], {icon: createEmojiIcon('🌲', '#40916c')})
            .addTo(map).bindPopup('<div style="font-family:\\'Gowun Batang\\', serif; font-weight:700; font-size:13px;">🌲 오전 코스: ${matchedSpot.name}</div>');
            
          L.marker([restLat, restLng], {icon: createEmojiIcon('🍴', '#f0a500')})
            .addTo(map).bindPopup('<div style="font-family:\\'Gowun Batang\\', serif; font-weight:700; font-size:13px;">🍴 점심 식사: ${matchedRestaurant.name}</div>');
            
          L.marker([emerLat, emerLng], {icon: createEmojiIcon('🚑', '#ff4a5a')})
            .addTo(map).bindPopup('<div style="font-family:\\'Gowun Batang\\', serif; font-weight:700; font-size:13px;">🚑 안전 쉼터: ${matchedEmergency.name}</div>');

          // 경로 점선 연결
          const latlngs = [
            [startLat, startLng],
            [spotLat, spotLng],
            [restLat, restLng],
            [emerLat, emerLng]
          ];
          const polyline = L.polyline(latlngs, {
            color: '#ff6b6b', 
            weight: 4, 
            dashArray: '6, 6',
            lineCap: 'round',
            lineJoin: 'round'
          }).addTo(map);

          // 지도 최적 포커스 영역 맞춤
          map.fitBounds(polyline.getBounds(), {padding: [40, 40]});

        } catch (mapErr) {
          console.error("위성지도를 초기화하는 중 오류가 발생하여 오프라인 지도로 전환합니다:", mapErr);
          fallbackToSvg();
        }
      } else {
        fallbackToSvg();
      }

      function fallbackToSvg() {
        document.getElementById('satellite-map-canvas').style.display = 'none';
        document.getElementById('svg-fallback-map').style.display = 'block';
        document.getElementById('map-label-text').innerText = '🗺️ 우리가족 맞춤 탐험 지도 (오프라인)';
      }
    };
  </script>
</body>
</html>`;

  // Blob 생성 및 가상 다운로드 클릭 트리거
  const blob = new Blob([htmlTemplate], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  
  const tempLink = document.createElement('a');
  tempLink.href = url;
  tempLink.download = `yanggu_my_family_guide.html`;
  
  document.body.appendChild(tempLink);
  tempLink.click();
  document.body.removeChild(tempLink);
  
  URL.revokeObjectURL(url);
}
