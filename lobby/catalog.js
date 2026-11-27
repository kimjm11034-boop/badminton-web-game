// Preview-only catalogue. Every reward and shop item stays locked until the progression update.

// Profile cosmetics granted on promotion, keyed by the tier index you reach (1 = D조 … 7 = 국가대표).
export const rewards = [
  { tier: 1, icon: 'palette', name: '프로필 테두리 · 그린 라인', detail: '프로필 카드에 코트 라인 테두리를 두릅니다.' },
  { tier: 2, icon: 'sparkles', name: '닉네임 색상', detail: '이름 색을 고를 수 있습니다.' },
  { tier: 3, icon: 'badge-check', name: '자기소개 문구', detail: '프로필에 한 줄 소개를 남길 수 있습니다.' },
  { tier: 4, icon: 'medal', name: '칭호 · 코트의 해결사', detail: '이름 위에 칭호를 표시합니다.' },
  { tier: 5, icon: 'gem', name: '프로필 배경 · 야간 경기장', detail: '프로필 카드 배경을 경기장 이미지로 바꿉니다.' },
  { tier: 6, icon: 'crown', name: '움직이는 네임플레이트', detail: '빛이 흐르는 이름표를 장착합니다.' },
  { tier: 7, icon: 'crown', name: '국가대표 엠블럼 · 골드 테두리', detail: '최고 등급 전용 엠블럼과 골드 테두리입니다.' },
];

// Shop categories. owned: default equipment everyone has; the rest are previews with prices in coins.
export const shop = [
  { id: 'racket', name: '라켓', icon: 'racket', items: [
    { name: '스타터 라켓', owned: true, specs: [['무게', '4U · 83g'], ['밸런스', '이븐'], ['샤프트', '보통']], effect: '기본 장비' },
    { name: '파워 프레임 88', price: 1200, specs: [['무게', '3U · 88g'], ['밸런스', '헤드 헤비'], ['샤프트', '단단함']], effect: '스매시 속도 +4%' },
    { name: '스피드 블레이드 66', price: 1100, specs: [['무게', '5U · 78g'], ['밸런스', '헤드 라이트'], ['샤프트', '유연함']], effect: '드라이브·수비 스윙 속도 +5%' },
    { name: '컨트롤 아크 77', price: 1000, specs: [['무게', '4U · 82g'], ['밸런스', '이븐'], ['샤프트', '보통']], effect: '헤어핀·드롭 정확도 +5%' },
  ] },
  { id: 'uniform', name: '유니폼', icon: 'shirt', items: [
    { name: '기본 경기복', owned: true, specs: [['소재', '폴리에스터'], ['색상', '네이비']], effect: '기본 장비' },
    { name: '에어 메시 저지', price: 600, specs: [['소재', '메시 통풍'], ['색상', '라임 · 블랙']], effect: '긴 랠리 후반 이동 감소 완화' },
    { name: '쿨 드라이 세트', price: 800, specs: [['소재', '냉감 원단'], ['색상', '화이트 · 레드']], effect: '외형 변경' },
  ] },
  { id: 'shoes', name: '신발', icon: 'footprints', items: [
    { name: '기본 코트화', owned: true, specs: [['밑창', '검 러버'], ['무게', '340g']], effect: '기본 장비' },
    { name: '그립 프로 코트화', price: 900, specs: [['밑창', '고접지 러버'], ['무게', '330g']], effect: '방향 전환 가속 +4%' },
    { name: '라이트 스텝', price: 950, specs: [['밑창', '경량 폼'], ['무게', '290g']], effect: '이동 속도 +3%' },
  ] },
];
