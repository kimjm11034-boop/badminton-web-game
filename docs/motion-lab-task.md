# Astra: Badminton Human Motion Lab

사용자는 Astra 에이전트로 사람 모션 제작/검증에 사용할 전용 3D 렌더링 작업장을 요청했습니다. 사용자의 최우선 목표는 실제 배드민턴 선수처럼 자연스러운 몸/관절/풋워크를 먼저 완성하는 것입니다. 기존 게임 기능을 계속 늘리는 것보다 이 작업이 우선입니다. 단순 계획이 아니라 실행 가능한 화면을 제작하고 브라우저 검증까지 완료하세요.

## Workspace and existing implementation

- Workspace: C:/Users/Owner/orca/projects/배드민턴 웹 게임 개발
- 현재 게임: http://localhost:5173, `node server.mjs` / `npm run dev`. 라이브 SSE 변경 반영.
- `motion.js`: Two-bone IK, buildPose/updateMotion. 현재도 인형처럼 보이는 문제가 있으므로 이것을 완성형이라고 전제하지 말 것.
- `renderer3d.js`: Three.js WebGL 경기장/절차적 성인 남성 메시. `vendor/three.module.js` + `three.core.js`, Three 0.187.0 로컬 번들.
- `physics.js`, `game.js`, `index.html`, `style.css`: 기존 마우스 조작 게임. 루트 경기 화면의 행동과 진행 상태를 깨뜨리지 말 것.
- `data/footwork-reference.json`: 사용자 영상 https://www.youtube.com/watch?v=iqxuxEubedU 의 90~101초에서 12개 샘플 프레임에 MediaPipe Full을 적용한 18개 주요 관절의 이미지/추정 3D 좌표와 가시성/각도. 연속 모션 캡처나 모델 재훈련은 아님.
- `data/pose-contact-sheet.jpg`: 원본에 관절점이 표시된 검증 이미지.
- `footwork-clips.js`, `tools/retarget_pose.py`: 프레임별 골반 중심 + 해부학적 우측/전방/상방 좌표. 선수 정면 영상의 화면좌우를 단순 미러하지 않고, 플레이어/상대를 월드에서 각각 0/180도 회전. 이 규칙을 유지하세요.
- 참고 경기 영상: https://www.youtube.com/watch?v=7Cq6jc-8QzQ, BWF TV Watanabe vs Vitidsarn. 참고 시 실제 본 내용만 보고.
- 저장소의 프로젝트 파일 다수가 아직 untracked지만 모두 사용자 작업입니다. reset/clean/stash/delete를 하지 말 것.

## Deliverable

기존 경기와 독립된 `/motion-lab/` 경로의 한국어 3D 모션 실험실을 제작하세요. 모션 실험실용 파일은 `motion-lab/` 아래에 두세요. 작업에 필요하면 모션 전용 모듈을 추가하세요. 루트 `server.mjs`에는 `/motion-lab/`와 필요한 정적 파일을 안전하게 제공하도록 최소 변경이 허용됩니다. 경기 `game.js`, `physics.js` 등은 수정하지 마세요. 기존 `motion.js`를 바꾸기보다 실험실 전용 개선 리그로 먼저 검증하여 후속 게임 이식을 쉽게 만드세요.

### Essential scene and model

- 단색 또는 차분한 무대/코트, 한 명의 성인 남성 선수와 정교한 배드민턴 라켓. 관중은 필요 없음.
- 건장한 성인 남성 비율, 가슴/골반/어깨/상완/전완/손/허벅지/종아리/발의 부피, 자연스러운 관절 방향과 조명/접지 그림자. 단순 2D 선이나 둥근 관절을 과장한 막대 인형 수준에서 끝내지 말 것. 실제 가능한 아티큘레이션이 우선.
- 준비 자세/스플릿 스텝/사이드 셔플 또는 샤세/후방 크로스오버/전위 런지와 회복/오버헤드 스윙/점프 스매시와 착지 중 핵심 클립 선택 재생. 재생/일시정지, 0.25x/0.5x/1x 속도, 타임라인 스크럽/단계별 정지, 반복.
- 후면/정면/측면/자유 궤도 회전과 줌. 우리 게임 후면 기준에서 반드시 확인 가능해야 함.

### Motion quality and diagnostics

- 무릎은 발 방향에 맞게 굽히고, 지지발은 접지하는 동안 미끄러지지 않으며, 무게중심이 지지 다리를 통해 이동하도록 구현.
- 런지는 오른손 라켓 선수의 리드 발, 발목/무릎/골반/몸통의 순서와 회복을 구별. 교차 스텝에서 좌우 뼈가 뒤집히거나 관절 이름이 바뀌지 않아야 함.
- 오버헤드는 준비/몸통 회전/팔꿈치 선행/전완/손목/라켓 회전/팔로스루와 반대팔 균형을 구별. 점프는 이륙/공중/무릎 충격 흡수/회복.
- 관절점/뼈대/이름 표시 토글, 발 접지/중심 위치 등 실제 검증에 필요한 시각화. 선택 프레임의 관절 좌표 또는 각도를 확인/JSON 내보내기 가능하게 구성하면 유용함.
- 원본 추정 좌표를 활용할 경우 어느 클립/관절에 실제 사용했는지 기록. 새 학습이나 완전한 모션 캡처로 과장하지 말 것. 직접 작성한 키프레임/IK와 영상 추정 데이터의 역할을 명시.

## Autonomy and verification

- 상세 요청과 기존 문맥으로 구현 선택은 위임되어 있습니다. 디자인 승인 질문으로 멈추지 말고 실행 가능한 결과까지 완성하세요.
- 실제 브라우저로 장면, 카메라, 슬로 재생/스크럽, 관절 토글을 검증하세요. 브라우저/Orca 스킬을 따르세요.
- 기본 자세와 런지/스윙의 유한 좌표, 뼈 길이, 발 지면 등 의미 있는 확인을 수행. 기존 테스트 `npm test`도 필요한 변경에 맞게 확인.
- 기존 개발 서버가 있으면 재사용. 서버 코드 변경으로 재시작 필요 시 해당 게임 개발 서버만 다루고 다른 터미널은 건드리지 말 것.
- 최종 보고: 접속 URL, 변경 파일, 모델/모션 구현 방식, 실제 검증한 동작과 근거 스크린샷 경로, 남은 한계. 결과를 coordinator에 worker_done으로 보고하세요.

가능하다면 사용자에게 결과 화면을 열어두세요. 배포/외부 유료 서비스/모션 자산 결제 없이 로컬에서 수행하세요.

## 2026-11-27 로컬 복식 플레이테스트 체크포인트

- 담당 writer는 GPT/Codex다. 사용자는 공개 배포를 나중으로 미루고 경기 화면, 조작, 서브 대기, 타구음과 경기장을 로컬에서 바꾸도록 요청했다. 공개판의 마지막 확인 커밋은 018de79이며 그 뒤의 작업은 로컬에 있다.
- 기준선은 1인칭 복식 게임, 기존 타구 분류와 선수 모션, 독립된 모션 실험실이다. 경기 진입점은 index.html, doubles/match.js, doubles/simulation.js, doubles/court.js이고 로컬 서버는 dev-server.mjs다.
- 선수 복원을 재개해 doubles/assets/player.glb에 새 전신을 바인딩했다. 몸통과 유니폼은 TripoSR, 안면·손·신발의 정밀 부위는 기존 아티스트 메시를 활용했다. 정면 원화, 원시 복원, Blender 원본과 처리 스크립트는 doubles/assets/player-source/에 있다. 단일 시점에서의 깊이 및 뒷면 추정 한계가 있다.
- 화면은 전체 창 코트와 HUD로 변경했다. 설정·조작법·일시정지는 네이티브 dialog를 쓰고 경기 중 메뉴가 열리면 시계가 멈춘다. 마우스 상대 이동은 시점을 회전시키고 버튼을 누른 구간의 궤적은 타구에만 쓰인다. 상대 자동 서브 준비 시간은 3.5초다. 18.15 m 지붕, 빈 관중석, 녹색 코트, 적색 주변 바닥과 점수를 반영하는 전광판을 넣었다. BigSoundBank 0537의 실제 타격 세 샘플을 사용한다.
- 이번 실제 변경은 index.html, doubles/court.css, doubles/court.js, doubles/arena.js, doubles/match.js, doubles/simulation.js, doubles/impact-audio.js, doubles/assets/audio/, doubles/assets/SOURCES.md, vendor/lucide/, dev-server.mjs, tools/build-playtest.mjs, .gitignore, tests/doubles.test.mjs, tests/doubles-player.test.mjs 및 위 선수 자산과 doubles/evidence/의 로컬 증거 이미지다.
- npm test 27건 통과. node tools/build-playtest.mjs 성공. ego-browser로 두 도움말/설정 메뉴, 일시정지에서 설정 진입·복귀, 점프, 드래그 롱 서브, 상대 리턴, 녹음 재생을 확인했다. 독립 Chrome에서 Pointer Lock 획득, 마우스 회전, 드래그 중 시선 유지, 포인터 해제 시 일시정지를 확인했다. 같은 물리 엔진으로 계산한 클리어 최고점 8.339 m를 로컬 렌더러 중앙에 투영했다. 증거는 doubles/evidence/arena-lobby.png, arena-play.png, arena-settings.png, arena-pause.png, arena-clear.png와 player-motions.png에 있다.
- 외부 설문 관리자 화면을 조회한 시점에 응답은 0개였다. 이 변경은 채팅으로 받은 피드백을 사용했다. 외부 서비스에 새 커밋이나 배포를 보내지 않았다. 다음 단계는 사용자 로컬 플레이테스트에서 마우스 감도·콕 가독성·음량 체감을 확인하는 것이다. 배포 재개 시점은 사용자 결정 대기다.

## 2026-11-27 코트 로비와 스윙 시점

- 담당 writer는 GPT/Codex. 사용자가 로컬 경기 전 로비, 스윙을 따라가는 약한 시점 이동, DB 로그인 기록을 요청했다. 후속 답변에서 왼쪽 아래 연락처를 GitHub와 이메일로 지정했다. 저장소 origin의 소유자와 커밋 작성자의 주소를 적용했다.
- 기준선은 기존 1인칭 복식 경기와 모션 실험실이다. 로비는 /, 기존 경기는 /play/, 점수 없이 상대 AI가 반복해서 서브하는 모드는 /play/?mode=practice 이다. 멀티와 친구 초대는 업데이트 안내로 연결된다. 장비 판매는 준비 중이다.
- 일반 회전 대비 스윙 기본 회전량은 30%다. 설정에서 5~80%로 변경할 수 있다. 버튼을 누르면 호환 mousemove 이벤트가 억제되는 현상을 브라우저에서 재현한 뒤, 포인터 잠금 여부에 따라 pointermove와 mousemove를 분리했다. 타구 판정에는 전체 거리와 궤적을 전달한다.
- 변경 파일은 index.html, play/index.html, lobby/home.css, home.js, progress.js, accounts.mjs, doubles/match.js, simulation.js, court.css, doubles/assets/lobby.webp, vendor/lucide/lobby.svg, dev-server.mjs, tools/build-playtest.mjs, .gitignore, tests/lobby.test.mjs, 이 체크포인트다. 로비 배경은 이 화면용으로 생성한 스포츠 이미지이고 아이콘은 Lucide다. 계정 저장 위치 .local/accounts.sqlite는 정적 파일 제공 및 버전 관리 범위 밖이다. 비밀번호 확인은 salt를 포함한 scrypt, 세션 확인은 난수 토큰의 해시를 사용한다.
- 검증 결과 npm test 29건 통과, 정적 플레이테스트 빌드 성공. ego-browser에서 로비 메뉴 10개, 가입·로그아웃·다시 로그인·최근 기록 2건·새로고침 후 세션 유지(격리 DB), 싱글 및 AI 연습 진입과 AI 서브를 확인했다. 동일 50픽셀 이동 시 일반 -0.121 rad, 드래그 -0.0363 rad로 측정했다. 독립 Chrome 포인터 잠금에서도 30픽셀 드래그 -0.0198 rad와 포핸드 롱 서브, 잠금 해제 시 일시정지를 확인했다. 390px 폭 검증, 화면 증거 doubles/evidence/home-lobby.png, home-mobile.png. 테스트 계정은 실제 로컬 DB에 만들지 않았다.
- 로컬 게임 로비를 열어 두었다. 실제 배포는 이전 사용자 결정에 따라 보류 중이다. 공개 로그인은 영속 백엔드 연결이 필요하다. 다음 검토 대상은 사용자가 느끼는 스윙 감도다.

## 2026-11-27 로비 등급 표시·경기장 배경·선수 스포트라이트 (Claude 교대 수행)

- 담당 writer: Claude(GPT/Codex 세션 한도로 교대). 사용자 요청: 로그인 시 이름 뒤 싱글 등급 표시(예: `아이디 B조`), 로비 배경을 축구장 같은 이미지에서 배드민턴 경기장으로 교체, 사용자가 보낸 사진 2~8번만 사용해 선수·라켓만 분리하고 자세·체형은 유지한 채 게임 배경에 맞게 화질·색감 보정, 15초 간격 전환. 후속 요청: 8번 몸통 중간 빈 부분 채우기. 모바일은 나중에, 웹 우선.
- 시작 시 상태: index.html/home.js가 lobby/spotlight.js를 참조했지만 파일이 없어 로비 스크립트가 깨져 있었다(이전 세션 중단). 이번에 작성해 복구했다.
- 등급: doubles/ranks.js에 `standing(wins)` 공용 함수 추가. lobby/accounts.mjs에 `ranked_wins(account,match,rank,at)` 테이블과 `POST /api/account/result`(로그인 필요, 경기 ID 형식 검증, 현재 등급에서 이긴 경기만 1회 집계)를 추가했고 프로필 응답에 `standing`을 포함한다. doubles/match.js는 로그인 시 계정 등급을 불러와 결과를 서버에 저장하고, 게스트는 기존 localStorage 방식을 쓴다. home.js는 헤더와 프로필에 `이름 + 등급 배지`, 등급 카드(승수 진행 막대·다음 등급)를 표시한다. 게스트 시절 브라우저 등급은 계정으로 옮기지 않는다(미결).
- 배경: 기존 공개 사진(venue.webp)은 관중·광고·선수가 많아 쓰지 않고, 게임 경기장 모델(doubles/arena.js와 court.js의 코트 구성)을 헤드리스 Chrome으로 2560×1440 렌더해 lobby/photos/arena.webp로 사용했다. 렌더 페이지는 .cache/lobby-photos/arena-render.html.
- 선수 사진: 원본은 .cache/lobby-photos/src/user-2..8.png. 처리 순서는 Real-ESRGAN x4plus(spandrel), BiRefNet-general(rembg 2.0.88) 누끼, 다른 선수 조각 제거, 가장자리 배경색 번짐 제거(pymatting), 경기장 색보정과 윤곽광, 원본 테두리에 잘린 면 페이드다. 8번은 네트 띠에 가려진 허리 구간을 위쪽 상의 원단으로 채우고 네트 그물 무늬를 정리했다(fill8.py). 6번은 흰 재킷이 회색 배경으로 오인돼 생긴 구멍을 원본 픽셀로 복원했다. 6번 사진 위의 공식 엠블럼은 지우지 않았다. 스크립트는 .cache/lobby-photos/*.py에 있다. 이전 BWF/Wikimedia 사진 7장과 credits는 .cache/lobby-photos/retired/로 옮겼다.
- 선수 이름은 사진만으로 확인할 수 없어 캡션을 동작 설명으로 달았다(예: 리시브 준비 자세). 이 사진들은 언론·공식 사진으로 보여 공개 배포 전에 사용 허락 확인이 필요하다고 credits.json과 '사진 안내' 패널에 적었다. 배포 여부는 사용자 결정 대기 중이다.
- 변경 파일: index.html, lobby/home.js, lobby/home.css, lobby/spotlight.js(신규), lobby/accounts.mjs, lobby/photos/(arena.webp 등 선수 7장, credits.json), doubles/ranks.js, doubles/match.js, vendor/lucide/lobby.svg(pause 아이콘), tools/build-playtest.mjs(gallery.backdrop), tests/ranks.test.mjs(신규), 이 체크포인트.
- 검증: npm test 31건 통과. node tools/build-playtest.mjs 성공. 개발 서버 5173은 accounts.mjs 반영을 위해 재시작했다. 임시 DB를 쓰는 별도 서버(5174)에서 ego-browser로 가입, 초심 10승 후 D조 승급, 헤더 '검증선수 D조', 프로필 '1 / 10승 · 다음 등급 C조'를 확인했다. 7장 순환 표시, 다음·일시정지 버튼, 15초 진행 막대, 390px 가로 넘침 0도 확인했고 검증 DB는 삭제했다. 증거: doubles/evidence/lobby-spotlight.png, lobby-spotlight-all.jpg, lobby-tier-header.png, lobby-tier-profile.png, lobby-mobile.png.
- 다음 단계: 사용자 피드백 반영. 모바일 레이아웃은 사용자 지시에 따라 보류한다(겹침 수정 2줄만 적용). 배포·GitHub 반영은 사용자가 요청하면 진행한다.
- 후속(같은 날): 사용자가 2~8번 사진 작업을 철회하고 새 이미지 한 장(점프 스매시, 원본 우측 하단 표식으로 보아 AI 생성 추정)으로 대체하도록 지시했다. 결과 7장과 이전 credits는 .cache/lobby-photos/retired-user-photos/로 옮겼다. 원본은 src/user-jump.png, 결과는 lobby/photos/jump-smash.webp(845×1116)이다. 896×1200 원본이 깨끗해서 업스케일 없이 BiRefNet 누끼와 같은 색보정을 적용했고, 셔틀콕을 함께 남겼다(jump_mask.py, jump_grade.py). spotlight.js는 사진별 `fit`(full이면 하단 페이드 없이 공중 배치)과 한 장 모드를 지원한다. 한 장일 때는 타이머와 넘김 버튼을 숨긴다. tools/build-playtest.mjs는 빌드 때마다 lobby/photos 출력 폴더를 비워 철회한 사진이 배포물에 남지 않게 했다. npm test 31건 통과, 빌드 결과 사진은 arena.webp와 jump-smash.webp만 있음. 화면 증거는 doubles/evidence/lobby-spotlight.png(1600×900)다.
- 후속: 사용자가 사진 설명 박스와 출처를 없애라고 지시했다(AI로 만든 이미지라 출처가 필요 없음). index.html의 figcaption(캡션·버튼·사진 안내), home.js의 사진 안내 패널, credits.json의 설명·출처 문구, 관련 CSS를 제거했다. spotlight.js는 사진 표시와 여러 장일 때의 15초 자동 전환만 남겼다. npm test 31건 통과, 빌드 성공. 브라우저에서 캡션 없는 화면과 프로필 패널 동작을 확인했다(doubles/evidence/lobby-spotlight.png).

## 2026-11-27 난이도 모달·뒤로가기·상점/보상 미리보기 (Claude)

- 사용자 요청: 경기 화면과 로비 창에 뒤로 가기 추가. 난이도 드롭다운을 게임식 모달 등급 목록으로 바꾸고 내 등급 이하만 선택 가능하게. `승급전`은 9/10승일 때만 표시. 등급별 프로필 꾸미기 보상과 상점(코인·라켓·유니폼·신발)은 미리 보기만 두고 전부 잠금("추후 업데이트"). AI 연습은 원하는 난이도로 훈련.
- 구현: ranks.js에 등급 설명(blurb), promotionMatch, selectable 추가. simulation.js의 start()가 연습에서도 상대 능력치를 적용하되 s.rank는 null로 둔다(승급 집계 없음). play/index.html에 '로비로' 버튼, 등급 선택 버튼, 메뉴 dialog 안의 tier-view 추가. match.js는 select 대신 chosen과 renderTiers를 쓰고, 잠긴 행은 disabled에 "X조 승급 후" 표시. 로비 index.html과 home.js에는 패널 뒤로가기(내부 이동은 한 단계씩, 아니면 닫기), 상점 탭·목록, 프로필 등급 보상 목록을 넣었다. 데이터는 lobby/catalog.js(신규, 가상 장비명)에 있다. Lucide 0.460.0 아이콘을 lobby.svg와 court.svg에 추가했고, 라켓 아이콘만 같은 선 스타일로 직접 그렸다. dev-server.mjs와 build-playtest.mjs에 lobby/catalog.js를 등록했다. CSS는 doubles/court.css와 lobby/home.css에 있다.
- 검증: npm test 34건 통과(승급전 9/10, 선택 범위, 난이도 지정 연습의 무득점 반복 테스트 추가). 빌드 성공. ego-browser에서 임시 게스트 기록(C조 9/10)으로 '승급전' 배지, 초심~C조만 열림, 초심 선택 시 '하위 등급 대전 · 승급 집계 제외', 연습 8개 등급 모두 열림과 국가대표 선택, 상점 탭 전환, 보상 7개 잠금, 프로필→로그인→뒤로→프로필→뒤로 닫힘, 멀티 뒤로를 확인했다. 임시 기록 29건은 삭제했다. 증거: doubles/evidence/play-intro-tier.png, play-tier-modal.png, play-practice-tier.png, lobby-shop.png, lobby-profile-rewards.png.
- 미결: 코인 획득, 장비 효과, 보상 해제는 사용자 지시대로 잠금 상태다. 모바일은 보류 중이다.
- 배포(사용자 지시): f4e626c를 main에 커밋하고 푸시했다. Vercel 프로젝트 3개(badminton-web-game, -cica, -blt6) 모두 success. 공개 주소 https://badminton-web-game.vercel.app/에서 로비, 점프 스매시 이미지, 상점 4개 항목, /play/ 경기장 로딩, 난이도 모달(게스트 초심: 초심만 열림)을 확인했다. 정적 배포라 /api/account는 404이고 로그인 창에는 "계정 서버에 연결할 수 없습니다" 안내가 뜬다. 증거는 doubles/evidence/public-lobby.png, public-play.png. 이 기록 줄은 아직 커밋하지 않았다.

## 2026-11-28 GitHub 저장소 정리 (Claude)

- 사용자 요청: 게임 프로젝트답게 GitHub 사용 설명을 쓰고, 저장소를 깔끔하게 정리하고, 디자인도 다듬기.
- 변경: README.md를 Minton Web Game 기준으로 새로 썼다(소개, 스크린샷, 모드, 조작, 타구, 등급, 상점·보상, 실행·배포, 구조, 기술, 출처, 로드맵). 이전 SHUTTLE LAB README는 docs/legacy-prototype.md로 옮겨 보존했다. README 이미지는 docs/images/*.jpg 6장이다. 실수로 추적되던 court-studio/build/__pycache__/*.pyc는 추적만 해제했다. 참조가 없는 일회성 검증 스크립트 58개는 tools/archive/로 옮겼다. .gitignore에 README, docs/images, __pycache__ 규칙을 추가했다.
- 동시 작업: 정리하는 동안 Codex 프로세스가 doubles/match.js, doubles/simulation.js, physics.js, play/index.html을 수정하고 있었다(스매시 기준과 타구 세기 power 등). 한 파일에 한 명만 쓴다는 규칙에 따라 이 파일들은 건드리지 않았고 커밋에도 넣지 않았다. 해당 작업의 writer는 Codex다.
- 루트의 game.js, style.css, renderer3d.js, motion.js, footwork-clips.js와 motion-lab/, court-studio/ 이동은 구조 변경이라 하지 않았고 README에 '이전 버전 파일'로만 안내했다.

## 2026-11-28 타구 파워와 셔틀콕 궤도 (GPT/Codex)

- 기준선은 Claude가 공개한 f4e626c 및 위 배포 기록이다. 사용자 피드백에 따라 로컬 싱글/AI 연습의 타구 조작과 셔틀 비행을 수정했다.
- 상대 콕 또는 내 서브를 받을 때 하단 HUD가 예상 구질과 드래그 파워를 보여 준다. 120 CSS 픽셀을 최대 파워로 정했다. 높은 타점(1.55m 이상)의 위 드래그는 클리어, 아래 드래그는 파워 60% 미만 드롭·그 이상 스매시다. 낮은 타점의 위 드래그는 40%부터 언더 클리어다. 이전 타구에는 실제 파워와 속도가 표시된다.
- 복식 엔진에서 구질별 목표 길이와 클리어 발사각을 파워에 연결했다. 타이밍은 비행 해를 구하기 전에 목표 깊이에 반영한다. 공통 물리는 중력·속도 제곱 항력을 중점법으로 적분한다. 드롭의 네트 통과 각도를 직접 탐색하며 직전 0.16초의 실제 비행 위치를 잔상으로 그린다.
- 변경 파일은 physics.js, doubles/simulation.js, doubles/match.js, doubles/court.js, doubles/court.css, play/index.html, tests/doubles.test.mjs 및 이 기록이다. npm test 36건 통과, node tools/build-playtest.mjs 및 git diff --check 성공. 기본 코트의 같은 타점에서 드롭 20%/54%의 네트 통과 높이는 1.667/1.635m, 착지는 1.312/1.725m였다. 클리어 25/60/100%의 최고점은 4.973/6.595/9.505m, 착지는 4.370/5.332/6.425m였다.
- ego-browser로 실제 코트에서 롱 서브 70% 프리뷰와 릴리스 기록 일치, AI 연습에서 포핸드 드롭 30%와 클리어 80% 리턴 성공을 확인했다. 증거 doubles/evidence/stroke-power.png, doubles/evidence/shot-curves.png. 로컬 연습 진입 화면을 열어 두었다. 실제 셔틀 촬영 데이터로 계수를 맞춘 것은 아니며 이번 변경은 배포 전 로컬 버전이다. 다음 단계는 사용자 플레이 체감 확인이다.

## 2026-11-28 스매시·드라이브·커트 임팩트 궤도 (GPT/Codex 작업 → Claude 인계 마무리)

- 요청(2026-11-28 00:26): 스매시를 직선 궤적과 게이지·임팩트에 따른 속도로 구분, 커트는 내 코트 2~4m 타점에서 낮은 타점은 네트까지 떠올랐다 떨어지고 높은 타점은 거의 직선으로 네트 뒤 0~3m 착지, 임팩트가 나쁘면 더 뜨거나 네트, 드라이브는 정타면 직선·하향이고 빗맞으면 살짝 뜸, 수비·중간 볼 고려.
- Codex 구현(미커밋, 같은 파일): physics.js `impactFlight`(스매시·드라이브·커트·블록은 발사 조건만 맞추고 이후 자유 비행, 커트 항력 증가, 타이밍 품질로 속도·면 각도 변화), doubles/simulation.js(구질별 파워 깊이, AI는 스매시를 받으면 블록·높은 드롭은 커트), doubles/match.js(하단 파워 HUD, 직전 타구에 파워·방향·타이밍 표시), play/index.html 조작법, tests 4건, 증거 doubles/evidence/impact-shot-curves.png.
- 인계: Codex가 00:34:59 사용량 한도로 종료됨을 세션 로그로 확인한 뒤 Claude가 이어 받았다(writer: Claude).
- Claude 수정 2건
  - physics.js: 늦은 커트가 GOOD 판정(0.085~0.25초)인데 네트에 걸리던 불일치 수정. GOOD 범위의 늦은 커트는 테이프를 스치며 넘어가고(여유 3~8cm) BAD에서만 면이 닫혀 네트에 걸린다. 이른 커트가 더 뜨는 동작은 그대로. tests/doubles.test.mjs에 0.12·0.2초 늦은 커트가 네트를 넘는 단언 추가.
  - doubles/match.js: 직전 타구 문구의 정타 기준(±0.08초)을 판정 함수(±0.085초 PERFECT)와 같게 맞춤. 'PERFECT · 이른 타점' 같은 표시 불일치 제거.
- 측정(기본 코트, 내 코트 3m, 85% 커트): 타이밍 −0.28/−0.12/0/+0.12/+0.2/+0.28초에 높은 타점(2.4m) 네트 여유 0.61/0.23/0.08/0.05/0.03/−0.29m(마지막만 네트 실점), 낮은 타점(1.1m) 0.65/0.27/0.12/0.08/0.03/−0.25m. 착지 네트 뒤 약 2.6m(50% 파워 1.8m). 85% 드라이브(1.5m 타점) 정타 102km/h·4.7° 상향(네트보다 낮은 타점이라 상향 필요), ±0.28초 81km/h·12.5°. 100% 스매시 정타 252km/h·−13.5°, ±0.28초 199km/h·−10.1°.
- 검증: `npm test` 39/39 통과, `node tools/build-playtest.mjs` 성공, `git diff --check` 성공. ego-browser 실제 경기(Codex 스크립트 .cache/doubles/impact-playtest.mjs)에서 플랫·강타 스매시, 드라이브, 공격·수비 커트를 마우스로 쳐 직전 타구 HUD(파워·방향·판정·타이밍) 일치 확인. 한 번은 AI 공 배급 상황을 기다리다 드라이브 단계에서 시간 초과, 재실행에서 5종 모두 통과.
- 제한: 실제 셔틀 측정으로 계수를 맞춘 것은 아니다. 플레이테스트는 AI 공 배급에 따라 상황이 달라진다. 커밋·배포하지 않았다(로컬 상태).
- 다음 한 단계: 사용자 플레이 체감 확인 후 커밋·배포 여부 결정.

## 2026-11-28 타점 높이대 수정 (Claude, 사용자 지시)

- 지적: 궤적 그래프에서 스매시·드라이브·공격 커트의 타점이 모두 2.4m로 같았다. 사용자 기준: 스매시 2.0~2.5m, 드라이브·공격 커트 1.25~2.0m. 게임 판정도 높이 기준이 1.55m 하나라 1.55m부터 스매시·공격 커트가 나갔다.
- 변경: doubles/simulation.js에 `smashHeight=2.0`, `attackCutHeight=1.25`. 아래 드래그 60% 이상은 2.0m 이상에서만 스매시, 1.55~2.0m에서는 공격 드라이브(하향 가능). 반원 스윙은 1.25m 이상 공격 커트, 미만 수비 커트. 스매시 목표 깊이는 2.0~2.5m 구간에서 보간. physics.js 드라이브의 하향 각도는 네트 높이 위에서 시작해 2.0m에서 최대(기존 1.82~2.67m). doubles/match.js 하단 힌트와 play/index.html 조작법 문구를 높이대에 맞춤. AI는 이미 2.0m 초과에서만 스매시.
- 측정(내 코트 3m, 정타): 드라이브 85% 타점 1.25/1.5/1.75/2.0m → +9.2/+4.7/+0.2/−3.6°, 102km/h. 공격 커트 85% 1.5/1.75/2.0m → +8.4/+2.9/−2.6°, 착지 2.6m. 강타 스매시 2.25/2.5m → −10.7°·223km/h / −15.3°·252km/h. 1.8m 강한 아래 드래그는 드라이브 −1.3°·112km/h.
- 검증: `npm test` 40/40(높이대 테스트 1건 추가, 드라이브 테스트 타점 1.9m, 커트 테스트 1.1·1.8m), `node tools/build-playtest.mjs`, `git diff --check` 성공. 그래프 doubles/evidence/impact-shot-curves.png 재생성(.cache/doubles/impact-curves.mjs, impact-plot.py의 타점 변경).
- 관찰(미변경): 65% 플랫 스매시(2.45m)는 79km/h로 85% 드라이브(102km/h)보다 느리다. 높은 여유로 직선에 가깝게 넘기도록 설계된 결과다. 1.8m 이하에서 짧은 커트는 네트를 넘으려면 살짝 떠오를 수밖에 없다(물리적 제약).
- 상태: 커밋·배포하지 않음. writer: Claude.

## 2026-11-28 타구 위치·착지 범위와 네트 아래 타점 궤적 (Claude, 사용자 지시)

- 지시: 플랫 스매시(하프 스매시와 같은 개념)는 제거하고 나중에 검토. 타구 위치(네트 기준 내 코트 음수)와 착지 범위: 스매시·드롭·클리어 −6~−4, 드라이브 −5~−2 → 3~6, 공격 커트 −5~−3 → 1~3.5, 수비 커트 −5~−3 → 1~3. 네트보다 낮은 타점의 드라이브·커트는 네트까지 살짝 올라 네트 위치에서 1.55~2.0m를 지나고, 드라이브는 그대로 뻗다 떨어지며, 커트는 네트를 타고 넘어 0.5~0.7m 지점부터 떨어진다. 판정이 어려운 곳은 그래프와 샷 이름으로 보고.
- 변경
  - physics.js: 플랫 스매시 여유 계산 삭제(스매시 하나, 파워는 속도 78~100%에만 반영). 네트보다 낮은 타점의 커트는 항력 0.22~0.72 중 속도 120km/h 이하에서 정점이 네트 뒤 0.6m에 가장 가까운 값을 고른다. 드라이브는 같은 발사각에서 속도를 조정해 착지를 네트 뒤 3~6m로 맞춘다.
  - doubles/simulation.js: 착지 목표 공격 커트 1.0+2.5×파워, 수비 커트 1.0+2.0×파워(m).
  - doubles/match.js·play/index.html: '플랫/강타 스매시' 문구 제거, 커트 거리 안내 갱신.
  - tests/doubles.test.mjs: 스매시 테스트를 −6/−5/−4m 단일 스매시로, 커트 테스트를 −3/−4/−5m·착지 범위로, 드라이브 착지 3~6m 테스트 추가(41건).
- 측정(.cache/doubles/shot-ranges.mjs → shot-ranges.json, 그래프 doubles/evidence/shot-ranges.png): 스매시 65%/100% 181~203/224~252km/h, 네트 위 1.63m, 착지 4.4~5.7m. 드롭 착지 1.44~1.74m. 클리어 4.5~6.4m. 드라이브 착지 3.0~6.0m. 공격 커트 1.75~3.25m, 수비 커트 1.6~2.8m.
- 판정이 어려워 사용자 확인 필요
  1. 네트 아래 타점 커트의 정점은 네트 앞 −1.4~+0.4m. 정점을 네트 뒤 0.6m에 두고 1~3m에 떨어뜨리려면 −4~−5m에서 약 250~320km/h가 필요(계산 예: 1.1m 타점 −5m·항력 0.5 → 320km/h·착지 2.4m). 120km/h 이하로 제한해 가장 가까운 궤적을 쓴다.
  2. −5m·약한 드라이브는 3m 이상 보내려면 네트 위 2.09m로 지나(상한 2.0m 초과).
  3. −6~−5m 약한 드롭은 2.5~2.6m까지 먼저 떠올랐다 떨어진다.
  4. 스매시 2.0m 경계: 떨어지는 셔틀은 0.065초 사이 약 0.3m 내려가 늦게 놓으면 드라이브로 판정된다(설계대로).
- 검증: `npm test` 41/41, `node tools/build-playtest.mjs`, `git diff --check` 성공. ego-browser 실제 경기에서 스매시 65%·100%(202·249km/h, '스매시' 단일 표시), 드라이브, 공격·수비 커트 판정 확인. 스매시 타점 2.3m로 둔 첫 실행은 놓는 순간 셔틀이 2.0m 아래로 내려가 드라이브로 판정되어 시간 초과(4번 항목).
- 상태: 커밋·배포하지 않음. writer: Claude. 다음 단계: 위 1~4에 대한 사용자 좌표 조정.

## 2026-11-28 파워·임팩트로 착지 범위 전체 커버, 샷별 궤적 모양 (Claude, 사용자 지시)

- 지시: 같은 타구 위치에서도 파워·임팩트에 따라 범위 전체(최소~최대)에 떨어져야 함(예: −6 스매시 → 4~6, −5 드라이브 → 6까지, −2 드라이브 → 3). 클리어 최고 높이 6~8m. 커트는 약하게 치는 컨트롤 샷(느림). 네트보다 낮은 타점 드라이브는 강하게 쳐 4~6m, 네트까지 살짝 오르고 넘어서 쭉 가다 떨어짐(사용자 빨간선 그림). 드롭은 타점이 최고점, 거의 평평하게 네트를 스치고 떨어짐(빨간선 그림). 스윙할 때 콕이 2.0m 이상이면 접촉 때 조금 내려와도 스매시.
- 변경
  - physics.js `integrate`: 공에 `brake`·`dir`·`early` 필드(선택). 네트를 넘고 하강 중(early면 네트 직후)일 때 수평 속도를 감쇠 → 셔틀이 꺾여 떨어지는 지점을 착지 목표에 맞춘다. brake가 없는 공(기존 game.js 등)은 영향 없음.
  - physics.js `impactFlight` 재작성: 착지 목표(시뮬레이션이 정함)에 맞춰 샷 모양별로 풀이. 스매시=직선 하향, 파워=속도, 네트 위 1.60~2.0m(최대 파워 −6m는 항력 감소로 6m 도달). 클리어=자연 비행, 최고 높이 6+2×파워. 드롭=발사각 0(타점 1.6~1.8m는 1~6° 상향), 네트 1.67~1.83m 후 brake. 드라이브=위 타점 평평/하향, 아래 타점 네트 1.64~1.72m·정점 네트 뒤; 55m/s(198km/h) 이상 필요하면 항력을 줄임. 커트=통과 높이보다 낮은 타점이면 항력 0.05로 느리게 올라 네트 뒤 0.5~0.7m 정점(높이 최소 +0.25m 상승), 높으면 거의 직선 후 네트 직후 brake. 이른 타점 GOOD의 뜸은 네트 위 +0.45m까지, BAD 늦음은 네트.
  - doubles/simulation.js: 착지 규칙 `span(최소,최대,파워)×임팩트`(임팩트 .35~1, GOOD 끝 .35·정타 1): 스매시·클리어 4~6, 드롭 1~2, 드라이브 3~6(네트 아래 타점 4~6), 공격 커트 1~3.5, 수비 커트 1~3(커트 파워는 인식 최소 20%부터 환산). `readSwing(...,release)`: 놓을 때 콕 높이로 스매시 판정. drop·clear도 shaped 경로.
  - play/index.html·doubles/match.js: 안내 문구 갱신.
  - tests/doubles.test.mjs: 범위 테스트 4건 추가(45건).
- 측정: `.cache/doubles/envelope.mjs`(타구 위치×타점 높이×파워×타이밍 PERFECT·GOOD 2,915건, 게임 스텝 1/120) 전 항목 범위 안(결과 `.cache/doubles/envelope.txt`). 그래프 `doubles/evidence/shot-ranges.png`(최장·최단 궤적), `doubles/evidence/landing-ranges.png`(타구 위치별 착지 범위). 브라우저 실제 경기 8샷 확인(스매시 65%/100% 4.25/5.94m, 클리어 정점 7.6m·5.29m, 드롭 1.34m, 드라이브 아래 5.49m·4.72m, 공격 커트 정점 0.65m·2.24m, 수비 커트 정점 0.56m·1.80m).
- 판단 필요(사용자 확인): ① 높은 타점(1.8~1.95m) 공격 커트를 이르게(GOOD) 치면 네트 위 2.03~2.18m로 뜸(벌칙으로 둠). ② 스매시 판정을 놓는 순간 높이로 바꿔, 빠르게 떨어지는 콕은 접촉 1.7m에서도 스매시가 됨. ③ 셔틀이 네트 뒤에서 급히 꺾이는 brake는 게임용 단순화(실제 물리보다 강함, 짧은 커트 1m일 때 특히).
- 검증: `npm test` 45/45, `node tools/build-playtest.mjs`, `git diff --check` 성공.
- 상태: 커밋·배포하지 않음. writer: Claude. 다음 단계: 사용자 확인 후 조정.

### 2026-11-28 사용자 결정 반영 (Claude)
- ① 결정: GOOD 타이밍 커트의 네트 통과 높이는 2.0m 이하로 제한. physics.js 커트: GOOD이면 통과 높이 상한 1.98m, 타점+0.25m가 1.98m를 넘으면(높은 타점) 올라가는 궤적 대신 거의 직선 궤적. 측정: 공격·수비 커트 GOOD 포함 네트 1.54~1.97m, 속도 110km/h 이하. 테스트 1건 추가(46건). BAD 이른 타점은 계속 더 뜸.
- ② 결정: 놓는 순간 높이로 스매시 판정하는 방식은 그대로 유지(접촉 1.7m 스매시 허용).
- 검증: `npm test` 46/46, build, `git diff --check` 성공. 커밋·배포하지 않음. writer: Claude.
