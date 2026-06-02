/**
 * 양구 가족 휴양 여행 가이드 Global Javascript (V1.0)
 * 공통 UI 인터랙션, 내비게이션 매칭, Lazy Loading 및 프리미엄 모달 처리
 */

document.addEventListener('DOMContentLoaded', () => {
  // 1. 하단 탭바 활성화 자동 맵핑
  initBottomNavigation();

  // 2. 이미지 Lazy Loading 처리
  initLazyLoading();

  // 3. 플로팅/퀵 긴급 버튼 바운스 피드백 효과
  initEmergencyButtons();

  // 4. 모바일 및 데스크톱 반응형 뷰 서포트 콘솔 로그
  console.log('💚 양구 가족 휴양 가이드 MVP가 활성화되었습니다.');
});

/**
 * 현재 페이지의 URL 경로를 비교하여 일치하는 하단 내비게이션 탭에 'active' 클래스 부여
 */
function initBottomNavigation() {
  const currentPath = window.location.pathname;
  const navItems = document.querySelectorAll('.bottom-nav-item');

  navItems.forEach(item => {
    const href = item.getAttribute('href');
    if (!href) return;

    // 경로 일치성 파악 (메인 홈 vs 서브페이지)
    const isHome = (href === 'index.html' || href === '../index.html' || href === '/') && 
                   (currentPath.endsWith('index.html') || currentPath.endsWith('/') || currentPath === '');
    
    const isSubPage = currentPath.includes(href.replace('../', '').replace('pages/', ''));

    if (isHome || (!isHome && isSubPage && href !== 'index.html' && href !== '../index.html')) {
      // 기존 active 제거 후 추가
      navItems.forEach(i => i.classList.remove('active'));
      item.classList.add('active');
    }
  });
}

/**
 * IntersectionObserver를 이용한 프리미엄 이미지 레이지 로딩
 */
function initLazyLoading() {
  const lazyImages = document.querySelectorAll('img[loading="lazy"]');

  if ('IntersectionObserver' in window) {
    const imageObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const image = entry.target;
          // loaded 클래스를 추가하여 CSS 필터 블러 해제
          image.classList.add('loaded');
          imageObserver.unobserve(image);
        }
      });
    }, {
      rootMargin: '50px 0px',
      threshold: 0.01
    });

    lazyImages.forEach(image => {
      // 기본적으로 흐리게 표기하고 Observer에 등록
      image.classList.add('lazy-image');
      imageObserver.observe(image);
    });
  } else {
    // 대체제 (IntersectionObserver 미지원 구형 브라우저)
    lazyImages.forEach(image => {
      image.classList.add('loaded');
    });
  }
}

/**
 * 긴급 응급 버튼들의 터치 감도를 위한 바운스 인터랙션 및 무드 추가
 */
function initEmergencyButtons() {
  const quickBtns = document.querySelectorAll('.emergency-quick-btn, .floating-emergency-trigger');
  
  quickBtns.forEach(btn => {
    btn.addEventListener('touchstart', () => {
      btn.style.transform = 'scale(0.92) translateY(1px)';
    });

    btn.addEventListener('touchend', () => {
      btn.style.transform = 'scale(1) translateY(0)';
    });
  });
}

/**
 * 공통 상세 정보 모달(Bottom Sheet) 열기/닫기 헬퍼 함수
 * @param {Object} data - 표시할 JSON 데이터 객체
 * @param {string} type - 'spot' | 'restaurant' | 'emergency'
 */
function openBottomSheet(data, type) {
  // 모달 요소 동적 탐색 또는 생성
  let overlay = document.getElementById('global-modal-overlay');
  let sheet = document.getElementById('global-bottom-sheet');

  if (!overlay || !sheet) {
    createBottomSheetElements();
    overlay = document.getElementById('global-modal-overlay');
    sheet = document.getElementById('global-bottom-sheet');
  }

  const modalBody = sheet.querySelector('.modal-body');
  
  // 타입에 따른 모달 콘텐츠 빌딩
  let contentHtml = '';
  
  if (type === 'spot') {
    contentHtml = `
      <img src="${data.image || '../assets/hero.png'}" class="modal-header-img" alt="${data.name}" loading="lazy">
      <div class="modal-title">${data.name}</div>
      <div class="item-meta" style="font-size: 14px; margin-bottom: 12px;">
        <span class="item-tag kids-tag">${data.category}</span>
        <span>•</span>
        <span style="color: var(--primary-color); font-weight: 700;">적정연령: ${data.age_group}</span>
        <span>•</span>
        <span style="color: #ffb300;">안전점수: ${data.safety_score}</span>
      </div>
      <p style="font-size: 14px; color: var(--text-dark); margin-bottom: 16px; line-height: 1.6;">${data.description}</p>
      
      <div class="modal-divider"></div>
      
      <h4 style="font-size: 15px; font-weight: 700; margin-bottom: 8px; color: var(--primary-color);">👨‍👩‍👧‍👦 가족 추천 편의시설</h4>
      <ul style="list-style: none; display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px;">
        ${data.facilities.map(f => `<li class="item-tag" style="background-color: var(--primary-bg); color: var(--primary-color); font-size: 12px; padding: 4px 10px; border-radius: 8px;">✔️ ${f}</li>`).join('')}
      </ul>
      
      <div class="modal-divider"></div>

      <div style="background-color: var(--gray-100); padding: 12px 16px; border-radius: var(--radius-sm); margin-bottom: 16px;">
        <span style="font-weight: 700; font-size: 13px; color: var(--text-dark);">📍 주소:</span>
        <p style="font-size: 13px; color: var(--text-dark); margin-top: 4px;">${data.address}</p>
      </div>

      <div style="background-color: var(--secondary-light); border-left: 4px solid var(--secondary-color); padding: 12px 16px; border-radius: 0 var(--radius-sm) var(--radius-sm) 0;">
        <span style="font-weight: 700; font-size: 13px; color: var(--secondary-color);">💡 가족 동반 꿀팁!</span>
        <p style="font-size: 13px; color: var(--text-dark); margin-top: 4px;">${data.tips}</p>
      </div>
    `;
  } else if (type === 'restaurant') {
    contentHtml = `
      <img src="${data.image || '../assets/food.png'}" class="modal-header-img" alt="${data.name}" loading="lazy">
      <div class="modal-title">${data.name}</div>
      <div class="item-meta" style="font-size: 14px; margin-bottom: 12px;">
        <span class="item-tag" style="background-color: var(--secondary-light); color: var(--secondary-color);">${data.category}</span>
        <span>•</span>
        <span style="color: var(--primary-color); font-weight: 700;">❤️ 아이동반 추천식당</span>
      </div>
      <p style="font-size: 14px; color: var(--text-dark); margin-bottom: 16px; line-height: 1.6;">${data.description}</p>
      
      <div class="modal-divider"></div>
      
      <h4 style="font-size: 15px; font-weight: 700; margin-bottom: 8px; color: var(--primary-color);">👶 아이 친화적 편의 요소</h4>
      <ul style="list-style: none; display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px;">
        ${data.facilities.map(f => `<li class="item-tag" style="background-color: var(--primary-bg); color: var(--primary-color); font-size: 12px; padding: 4px 10px; border-radius: 8px;">🧸 ${f}</li>`).join('')}
      </ul>
      
      <div class="modal-divider"></div>

      <div style="display: flex; gap: 12px; margin-bottom: 16px;">
        <div style="flex: 1; background-color: var(--gray-100); padding: 12px; border-radius: var(--radius-sm);">
          <span style="font-weight: 700; font-size: 12px;">📍 식당 위치:</span>
          <p style="font-size: 12px; margin-top: 4px;">${data.address}</p>
        </div>
        <div style="flex: 1; background-color: var(--gray-100); padding: 12px; border-radius: var(--radius-sm);">
          <span style="font-weight: 700; font-size: 12px;">📞 전화번호:</span>
          <a href="tel:${data.phone}" style="display: block; font-size: 12px; margin-top: 4px; color: var(--secondary-color); font-weight: 700; text-decoration: none;">📞 ${data.phone}</a>
        </div>
      </div>

      <div style="background-color: var(--secondary-light); border-left: 4px solid var(--secondary-color); padding: 12px 16px; border-radius: 0 var(--radius-sm) var(--radius-sm) 0;">
        <span style="font-weight: 700; font-size: 13px; color: var(--secondary-color);">💡 주문 및 이용 팁:</span>
        <p style="font-size: 13px; color: var(--text-dark); margin-top: 4px;">${data.tips}</p>
      </div>
    `;
  }

  modalBody.innerHTML = contentHtml;
  
  // 모달 열기 클래스 부착 (애니메이션 구동)
  overlay.classList.add('active');
  sheet.classList.add('open');
  
  // 바디 스크롤 차단하여 모바일 앱 느낌 완성
  document.body.style.overflow = 'hidden';
}

/**
 * 모달창 닫기 처리
 */
function closeBottomSheet() {
  const overlay = document.getElementById('global-modal-overlay');
  const sheet = document.getElementById('global-bottom-sheet');
  
  if (overlay && sheet) {
    overlay.classList.remove('active');
    sheet.classList.remove('open');
  }
  
  document.body.style.overflow = 'auto';
}

/**
 * 바텀시트 모달을 위한 HTML 엘리먼트들을 동적으로 화면에 생성해 붙임
 */
function createBottomSheetElements() {
  // 1. Overlay
  const overlay = document.createElement('div');
  overlay.id = 'global-modal-overlay';
  overlay.className = 'modal-overlay';
  overlay.addEventListener('click', closeBottomSheet);
  document.body.appendChild(overlay);

  // 2. Sheet
  const sheet = document.createElement('div');
  sheet.id = 'global-bottom-sheet';
  sheet.className = 'modal-bottom-sheet';
  
  sheet.innerHTML = `
    <div class="modal-drag-handle"></div>
    <button class="modal-close-btn" onclick="closeBottomSheet()">✕</button>
    <div class="modal-body">
      <!-- 동적 주입 -->
    </div>
  `;
  document.body.appendChild(sheet);
}
