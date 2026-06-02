/**
 * 양구 가족 휴양 여행 가이드 Checklist Module (V1.0)
 * LocalStorage 기반 영속적 준비물 관리, 커스텀 아이템 CRUD 및 Chart.js 원형 도넛 시각화 제공
 */

// 초기 기본 가족 동반 권장 준비물 세트
const DEFAULT_CHECKLIST = [
  { id: 1, text: "아이 해열제 및 상비약", checked: false, category: "안전/의료" },
  { id: 2, text: "유모차 및 아기띠", checked: false, category: "이동편의" },
  { id: 3, text: "아동용 모기퇴치 패치/스프레이", checked: false, category: "안전/의료" },
  { id: 4, text: "자외선 차단 선크림 & 챙 넓은 모자", checked: false, category: "위생/보호" },
  { id: 5, text: "어린이 멀미약 (산길 이동용)", checked: false, category: "안전/의료" },
  { id: 6, text: "여벌 옷 및 얇은 겉옷 (숲속 저온 대비)", checked: false, category: "의류" },
  { id: 7, text: "휴대용 물티슈 및 아기 소독제", checked: false, category: "위생/보호" },
  { id: 8, text: "개인 물병 및 아이 전용 수저 세트", checked: false, category: "식사" }
];

let checklistData = [];
let chartInstance = null; // Chart.js 객체 캐싱

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('checklist-view')) {
    initChecklist();
  }
});

/**
 * 체크리스트 초기화
 */
function initChecklist() {
  const localData = localStorage.getItem('yanggu_family_checklist');
  
  if (localData) {
    checklistData = JSON.parse(localData);
  } else {
    // 최초 방문 시 디폴트 데이터 주입
    checklistData = [...DEFAULT_CHECKLIST];
    saveToLocalStorage();
  }

  renderChecklist();
  initChecklistChart();
  
  // 추가 폼 이벤트 바인딩
  const addForm = document.getElementById('checklist-add-form');
  if (addForm) {
    addForm.addEventListener('submit', handleAddItem);
  }
}

/**
 * LocalStorage 저장
 */
function saveToLocalStorage() {
  localStorage.setItem('yanggu_family_checklist', JSON.stringify(checklistData));
}

/**
 * 체크리스트 화면 렌더링
 */
function renderChecklist() {
  const listContainer = document.getElementById('checklist-items-container');
  if (!listContainer) return;

  if (checklistData.length === 0) {
    listContainer.innerHTML = `
      <div style="text-align: center; padding: 40px 20px; color: var(--text-muted); font-size: 14px;">
        📝 준비물이 비어 있습니다.<br>아래 양식에서 필요한 물품을 추가해 보세요!
      </div>
    `;
    return;
  }

  listContainer.innerHTML = checklistData.map((item, index) => `
    <div class="checklist-row animate-fade-in" style="animation-delay: ${index * 0.03}s; display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; background-color: var(--white); border: 1px solid var(--gray-200); border-radius: var(--radius-sm); margin-bottom: 8px; transition: all 0.2s ease;">
      <div style="display: flex; align-items: center; gap: 12px; cursor: pointer; flex-grow: 1;" onclick="toggleItemCheck(${item.id})">
        <div style="width: 22px; height: 22px; border-radius: 6px; border: 2px solid ${item.checked ? 'var(--primary-color)' : 'var(--gray-300)'}; display:flex; justify-content:center; align-items:center; background-color: ${item.checked ? 'var(--primary-color)' : 'var(--white)'}; color: var(--white); font-size: 12px; transition: all 0.2s ease;">
          ${item.checked ? '✓' : ''}
        </div>
        <span style="font-size: 14px; text-decoration: ${item.checked ? 'line-through' : 'none'}; color: ${item.checked ? 'var(--text-muted)' : 'var(--text-dark)'}; font-weight: ${item.checked ? '400' : '500'}; transition: all 0.2s ease;">
          ${item.text}
        </span>
      </div>
      <div style="display:flex; align-items:center; gap:8px;">
        <span class="item-tag" style="font-size: 10px; padding: 2px 6px; border-radius: 4px;">${item.category || '기타'}</span>
        <button onclick="deleteItem(${item.id})" style="background: none; border: none; color: var(--accent-color); font-size: 14px; cursor: pointer; padding: 4px;">✕</button>
      </div>
    </div>
  `).join('');
}

/**
 * 아이템 체크 여부 토글
 */
function toggleItemCheck(id) {
  checklistData = checklistData.map(item => {
    if (item.id === id) {
      return { ...item, checked: !item.checked };
    }
    return item;
  });
  saveToLocalStorage();
  renderChecklist();
  updateChart();
  
  // 메인 페이지에서 호출 시 진척도 뱃지 리프레시 대응
  if (typeof updateMainChecklistBadge === 'function') {
    updateMainChecklistBadge();
  }
}

/**
 * 아이템 삭제
 */
function deleteItem(id) {
  checklistData = checklistData.filter(item => item.id !== id);
  saveToLocalStorage();
  renderChecklist();
  updateChart();
}

/**
 * 새 준비물 아이템 추가
 */
function handleAddItem(e) {
  e.preventDefault();
  
  const input = document.getElementById('checklist-input');
  const select = document.getElementById('checklist-category-select');
  
  if (!input || !input.value.trim()) return;

  const newItem = {
    id: Date.now(),
    text: input.value.trim(),
    checked: false,
    category: select ? select.value : "일반"
  };

  checklistData.push(newItem);
  saveToLocalStorage();
  
  input.value = '';
  
  renderChecklist();
  updateChart();
}

/**
 * Chart.js를 이용한 진행도 도넛 차트 구성
 */
function initChecklistChart() {
  const ctx = document.getElementById('checklist-chart-canvas');
  if (!ctx) return;

  const checkedCount = checklistData.filter(i => i.checked).length;
  const totalCount = checklistData.length;
  const uncheckedCount = totalCount - checkedCount;
  
  const progressPercent = totalCount > 0 ? Math.round((checkedCount / totalCount) * 100) : 0;
  
  // 수치 텍스트 표기
  const percentText = document.getElementById('checklist-percent-text');
  if (percentText) {
    percentText.innerText = `${progressPercent}%`;
  }

  // Chart.js 인스턴스 생성
  if (typeof Chart !== 'undefined') {
    chartInstance = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['준비완료', '미완료'],
        datasets: [{
          data: [checkedCount, totalCount === 0 ? 1 : uncheckedCount],
          backgroundColor: ['#ff6b6b', '#e5ded6'],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { enabled: totalCount > 0 }
        },
        cutout: '75%', // 두께 조절
        rotation: -90,
        circumference: 360
      }
    });
  } else {
    // Chart.js CDN 실패 시 순수 CSS 폴백 프로그레스 바로 대체
    const fallbackBar = document.getElementById('checklist-progress-fallback');
    if (fallbackBar) {
      fallbackBar.style.width = `${progressPercent}%`;
    }
  }
}

/**
 * 차트 실시간 갱신
 */
function updateChart() {
  const checkedCount = checklistData.filter(i => i.checked).length;
  const totalCount = checklistData.length;
  const uncheckedCount = totalCount - checkedCount;
  
  const progressPercent = totalCount > 0 ? Math.round((checkedCount / totalCount) * 100) : 0;
  
  const percentText = document.getElementById('checklist-percent-text');
  if (percentText) {
    percentText.innerText = `${progressPercent}%`;
  }

  if (chartInstance) {
    chartInstance.data.datasets[0].data = [checkedCount, totalCount === 0 ? 1 : uncheckedCount];
    chartInstance.update();
  } else {
    const fallbackBar = document.getElementById('checklist-progress-fallback');
    if (fallbackBar) {
      fallbackBar.style.width = `${progressPercent}%`;
    }
  }
}
