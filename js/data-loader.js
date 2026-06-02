/**
 * 양구 가족 휴양 여행 가이드 Data Loader (V1.0)
 * JSON 데이터를 비동기 fetch하여 목록 구성, 검색 및 다차원 카테고리 필터링 구현
 */

// 데이터 캐시 변수
let spotsCache = [];
let restaurantsCache = [];
let emergencyCache = [];
let coursesCache = [];

/**
 * 관광지 데이터 불러오기 및 렌더링
 * @param {string} filterCategory - 선택된 카테고리 ('전체', '자연', '체험/역사' 등)
 * @param {string} searchKeyword - 검색 키워드
 */
async function loadAndRenderSpots(filterCategory = '전체', searchKeyword = '') {
  const container = document.getElementById('spots-list-container');
  if (!container) return;

  try {
    // 캐시가 비어있으면 로드
    if (spotsCache.length === 0) {
      if (window.location.protocol === 'file:') {
        console.log('📡 spots.json 오프라인 데이터 감지 로드');
        spotsCache = window.YANGGU_SPOTS_DATA || [];
      } else {
        try {
          const response = await fetch('../data/spots.json');
          spotsCache = await response.json();
        } catch (fetchErr) {
          console.warn("Fetch spots.json failed. Falling back to local window variables.", fetchErr);
          spotsCache = window.YANGGU_SPOTS_DATA || [];
        }
      }
    }

    // 필터링 적용
    let filtered = spotsCache;
    
    if (filterCategory !== '전체') {
      filtered = filtered.filter(item => item.category === filterCategory);
    }

    if (searchKeyword.trim() !== '') {
      const query = searchKeyword.toLowerCase();
      filtered = filtered.filter(item => 
        item.name.toLowerCase().includes(query) || 
        item.description.toLowerCase().includes(query) ||
        item.address.toLowerCase().includes(query)
      );
    }

    // 결과 렌더링
    if (filtered.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 40px 20px; color: var(--text-muted); font-size: 14px;">
          🔎 일치하는 관광지 정보가 없습니다.<br>다른 검색어나 필터를 선택해 보세요!
        </div>
      `;
      return;
    }

    container.innerHTML = filtered.map((item, index) => `
      <div class="item-list-card animate-fade-in" style="animation-delay: ${index * 0.05}s" onclick="handleSpotClick(${item.id})">
        <div class="item-list-img">
          <img src="../${item.image}" alt="${item.name}" loading="lazy">
          <span class="item-list-badge">${item.category}</span>
        </div>
        <div class="item-list-body">
          <div>
            <h3 class="item-title">${item.name}</h3>
            <div class="item-meta">
              <span>적정연령: ${item.age_group}</span>
              <span>•</span>
              <span style="color: #ffb300;">안전 ${item.safety_score}</span>
            </div>
            <p class="item-desc-snippet">${item.description}</p>
          </div>
          <div class="item-tag-row">
            ${item.facilities.slice(0, 2).map(f => `<span class="item-tag">${f}</span>`).join('')}
            ${item.facilities.length > 2 ? `<span class="item-tag">+${item.facilities.length - 2}</span>` : ''}
          </div>
        </div>
      </div>
    `).join('');

    // Lazy Loading 트리거 다시 활성화
    if (typeof initLazyLoading === 'function') initLazyLoading();

  } catch (error) {
    console.error('관광지 데이터를 로드하는 중 오류가 발생했습니다:', error);
    container.innerHTML = `<div style="text-align: center; color: var(--accent-color); padding: 20px;">⚠️ 데이터를 불러오지 못했습니다.</div>`;
  }
}

/**
 * 맛집 데이터 불러오기 및 렌더링
 * @param {string} filterCategory - 선택된 카테고리 ('전체', '가족식당', '한식', '카페' 등)
 * @param {string} searchKeyword - 검색 키워드
 */
async function loadAndRenderRestaurants(filterCategory = '전체', searchKeyword = '') {
  const container = document.getElementById('restaurants-list-container');
  if (!container) return;

  try {
    if (restaurantsCache.length === 0) {
      if (window.location.protocol === 'file:') {
        console.log('📡 restaurants.json 오프라인 데이터 감지 로드');
        restaurantsCache = window.YANGGU_RESTAURANTS_DATA || [];
      } else {
        try {
          const response = await fetch('../data/restaurants.json');
          restaurantsCache = await response.json();
        } catch (fetchErr) {
          console.warn("Fetch restaurants.json failed. Falling back to local window variables.", fetchErr);
          restaurantsCache = window.YANGGU_RESTAURANTS_DATA || [];
        }
      }
    }

    let filtered = restaurantsCache;

    if (filterCategory !== '전체') {
      filtered = filtered.filter(item => item.category === filterCategory);
    }

    if (searchKeyword.trim() !== '') {
      const query = searchKeyword.toLowerCase();
      filtered = filtered.filter(item => 
        item.name.toLowerCase().includes(query) || 
        item.description.toLowerCase().includes(query) ||
        item.address.toLowerCase().includes(query)
      );
    }

    if (filtered.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 40px 20px; color: var(--text-muted); font-size: 14px;">
          🍔 일치하는 맛집 정보가 없습니다.
        </div>
      `;
      return;
    }

    container.innerHTML = filtered.map((item, index) => `
      <div class="item-list-card animate-fade-in" style="animation-delay: ${index * 0.05}s" onclick="handleRestaurantClick(${item.id})">
        <div class="item-list-img">
          <img src="../${item.image}" alt="${item.name}" loading="lazy">
          <span class="item-list-badge" style="background-color: var(--secondary-color);">${item.category}</span>
        </div>
        <div class="item-list-body">
          <div>
            <h3 class="item-title">${item.name}</h3>
            <div class="item-meta">
              <span style="color: var(--primary-color); font-weight:700;">❤️ 가족 추천식당</span>
            </div>
            <p class="item-desc-snippet">${item.description}</p>
          </div>
          <div class="item-tag-row">
            ${item.facilities.slice(0, 2).map(f => `<span class="item-tag kids-tag">🧸 ${f}</span>`).join('')}
            ${item.facilities.length > 2 ? `<span class="item-tag">+${item.facilities.length - 2}</span>` : ''}
          </div>
        </div>
      </div>
    `).join('');

    if (typeof initLazyLoading === 'function') initLazyLoading();

  } catch (error) {
    console.error('맛집 데이터를 로드하는 중 오류가 발생했습니다:', error);
    container.innerHTML = `<div style="text-align: center; color: var(--accent-color); padding: 20px;">⚠️ 데이터를 불러오지 못했습니다.</div>`;
  }
}

/**
 * 응급 의료시설 데이터 불러오기 및 렌더링
 * @param {string} filterType - '전체' | '응급실' | '병원' | '약국' | '수유실'
 */
async function loadAndRenderEmergency(filterType = '전체') {
  const container = document.getElementById('emergency-list-container');
  if (!container) return;

  try {
    if (emergencyCache.length === 0) {
      if (window.location.protocol === 'file:') {
        console.log('📡 emergency.json 오프라인 데이터 감지 로드');
        emergencyCache = window.YANGGU_EMERGENCY_DATA || [];
      } else {
        try {
          const response = await fetch('../data/emergency.json');
          emergencyCache = await response.json();
        } catch (fetchErr) {
          console.warn("Fetch emergency.json failed. Falling back to local window variables.", fetchErr);
          emergencyCache = window.YANGGU_EMERGENCY_DATA || [];
        }
      }
    }

    let filtered = emergencyCache;

    if (filterType !== '전체') {
      filtered = filtered.filter(item => item.type === filterType);
    }

    container.innerHTML = filtered.map((item, index) => `
      <div class="premium-card animate-fade-in" style="animation-delay: ${index * 0.05}s; border-left: 5px solid ${item.has_emergency ? 'var(--accent-color)' : 'var(--secondary-color)'};">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
          <div>
            <span class="item-tag" style="background-color: ${item.has_emergency ? 'rgba(230, 57, 70, 0.1)' : 'var(--secondary-light)'}; color: ${item.has_emergency ? 'var(--accent-color)' : 'var(--secondary-color)'}; font-weight:700;">
              ${item.type}
            </span>
            <h3 style="font-size: 17px; font-weight:700; margin-top: 6px;">${item.name}</h3>
          </div>
          <a href="tel:${item.phone}" class="emergency-quick-btn" style="background-color: ${item.has_emergency ? 'var(--accent-color)' : 'var(--secondary-color)'}; border-radius: 50%; width: 40px; height: 40px; display:flex; justify-content:center; align-items:center; padding: 0; box-shadow: none;">
            <i class="fas fa-phone-alt" style="font-size: 16px;"></i>
          </a>
        </div>
        
        <p style="font-size: 13px; color: var(--text-dark); margin-bottom: 12px; line-height: 1.5;">${item.description}</p>
        
        <div style="font-size: 12px; color: var(--text-muted); display:flex; flex-direction:column; gap:4px; background-color: var(--gray-100); padding: 10px; border-radius: var(--radius-sm);">
          <div>⏰ <strong>운영시간:</strong> ${item.hours}</div>
          <div>📍 <strong>위치:</strong> ${item.address}</div>
        </div>
        
        <div style="margin-top: 10px; font-size: 12px; color: var(--text-dark); background-color: ${item.has_emergency ? 'rgba(230, 57, 70, 0.05)' : 'var(--primary-bg)'}; padding: 10px; border-radius: var(--radius-sm); border-left: 3px solid ${item.has_emergency ? 'var(--accent-color)' : 'var(--primary-color)'};">
          💡 ${item.tips}
        </div>
      </div>
    `).join('');

  } catch (error) {
    console.error('응급 데이터를 로드하는 중 오류가 발생했습니다:', error);
    container.innerHTML = `<div style="text-align: center; color: var(--accent-color); padding: 20px;">⚠️ 데이터를 불러오지 못했습니다.</div>`;
  }
}

/**
 * 추천 여행 코스 데이터 불러오기 및 렌더링
 * @param {number} courseId - 코스 ID (1 또는 2)
 */
async function loadAndRenderCourse(courseId) {
  const container = document.getElementById('course-detail-container');
  if (!container) return;

  try {
    if (coursesCache.length === 0) {
      if (window.location.protocol === 'file:') {
        console.log('📡 courses.json 오프라인 데이터 감지 로드');
        coursesCache = window.YANGGU_COURSES_DATA || [];
      } else {
        try {
          const response = await fetch('../data/courses.json');
          coursesCache = await response.json();
        } catch (fetchErr) {
          console.warn("Fetch courses.json failed. Falling back to local window variables.", fetchErr);
          coursesCache = window.YANGGU_COURSES_DATA || [];
        }
      }
    }

    const course = coursesCache.find(c => c.id === courseId);
    if (!course) return;

    container.innerHTML = `
      <div class="premium-card animate-fade-in" style="background: linear-gradient(135deg, #fdfbf7 0%, #f5f7f6 100%); border-top: 4px solid var(--primary-color);">
        <span class="item-tag kids-tag" style="font-size: 11px;">🏆 ${course.duration} 추천</span>
        <h2 style="font-size: 20px; font-weight: 700; margin-top: 6px; margin-bottom: 8px;">${course.title}</h2>
        <p style="font-size: 13px; color: var(--text-muted); margin-bottom: 12px;">${course.subtitle}</p>
        
        <div style="font-size: 12px; background-color: var(--white); padding: 12px; border-radius: var(--radius-sm); border: 1px dashed var(--gray-300);">
          <strong>🎯 추천 대상:</strong> ${course.target}<br>
          <strong style="margin-top: 4px; display:inline-block;">🏷️ 코스 키워드:</strong> ${course.theme}
        </div>
      </div>

      <h3 class="section-title" style="margin-top: 24px; padding: 0 4px;"><i class="fas fa-map-marked-alt" style="color: var(--primary-color);"></i> 시간별 상세 경로</h3>
      
      <div style="position: relative; padding-left: 24px; margin-top: 16px;">
        <!-- 타임라인 수직 선 -->
        <div style="position: absolute; left: 7px; top: 8px; bottom: 8px; width: 2px; background-color: var(--primary-light); opacity: 0.3;"></div>
        
        ${course.steps.map((step, index) => `
          <div class="animate-fade-in" style="position: relative; margin-bottom: 24px; animation-delay: ${index * 0.1}s">
            <!-- 동그라미 마커 -->
            <div style="position: absolute; left: -24px; top: 4px; width: 16px; height: 16px; border-radius: 50%; background-color: var(--primary-color); border: 3px solid var(--white); box-shadow: var(--shadow-sm); z-index: 2;"></div>
            
            <div style="font-size: 11px; font-weight: 700; color: var(--primary-color); background-color: var(--primary-bg); display: inline-block; padding: 2px 8px; border-radius: 100px; margin-bottom: 6px;">
              ⏱️ ${step.time} (${step.duration})
            </div>
            
            <div class="premium-card" style="margin-bottom: 0; padding: 16px;">
              <h4 style="font-size: 15px; font-weight: 700; color: var(--text-dark); margin-bottom: 6px;">${step.step_no}. ${step.name}</h4>
              <p style="font-size: 13px; color: var(--text-dark); opacity: 0.9; margin-bottom: 10px;">${step.description}</p>
              
              <div style="font-size: 11px; background-color: #fdf2f2; color: var(--accent-color); padding: 8px 12px; border-radius: var(--radius-sm); display: flex; align-items: center; gap: 6px; font-weight: 500;">
                🚨 <strong>안전 가이드:</strong> ${step.safety_tip}
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    `;

  } catch (error) {
    console.error('추천 코스 데이터를 로드하는 중 오류가 발생했습니다:', error);
    container.innerHTML = `<div style="text-align: center; color: var(--accent-color); padding: 20px;">⚠️ 데이터를 불러오지 못했습니다.</div>`;
  }
}

/**
 * 관광지 클릭 핸들러 (메인 및 spots 목록에서 공유)
 */
function handleSpotClick(id) {
  const data = spotsCache.find(s => s.id === id);
  if (data && typeof openBottomSheet === 'function') {
    openBottomSheet(data, 'spot');
  }
}

/**
 * 맛집 클릭 핸들러 (메인 및 restaurants 목록에서 공유)
 */
function handleRestaurantClick(id) {
  const data = restaurantsCache.find(r => r.id === id);
  if (data && typeof openBottomSheet === 'function') {
    openBottomSheet(data, 'restaurant');
  }
}
