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
