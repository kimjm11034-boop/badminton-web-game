# 복식 경기 장비

두 GLB는 미터 단위이며 게임이 시작될 때 로컬 서버에서 불러온다. [Blender 원본](source/Equipment.blend)에서 두 장비의 메시와 재질을 편집할 수 있다.

## 셔틀콕

Stanislas Perrin이 2002년에 촬영한 깃털 셔틀콕 사진을 사용했다. 원작자가 퍼블릭 도메인으로 공개한 사진이다. 배경을 마스킹한 [512픽셀 입력](source/shuttle-input.png)을 PC에서 TripoSR로 추론했다. [원본 사진과 저작자](https://commons.wikimedia.org/wiki/File:Koogan_badminton_feather_shuttlecock_01.JPG) · [Tripo AI와 Stability AI의 모델 카드](https://huggingface.co/stabilityai/TripoSR)

공식 TripoSR 코드 107cefdc244c39106fa830359024f6a2f1c78871과 공식 가중치 5b521936b01fbe1890f6f9baed0254ab6351c04a를 사용했다. CPU에서 144³ 격자의 밀도를 예측하고 등밀도 25인 표면을 marching cubes로 추출했다. 연결된 주 메시에는 정점 13,580개와 삼각형 27,156개가 있다. [추론 원본 PLY](source/tripo-reconstruction.ply) · [편집 전 세 방향 렌더](../evidence/tripo-raw.png)

단일 사진 추론에서는 깃털 끝이 막혔다. Blender에서 코르크 부분을 추출해 매끄럽게 다듬고, 남색 테이프, 16개 깃대와 깃판, 묶음실 두 줄을 구성했다. 게임용 크기는 길이 약 85 mm와 최대 폭 약 65 mm로 설정했다. 비행 중 코르크가 진행 방향을 향하며 물리 좌표는 코르크 끝에서 안으로 12 mm 들어간 곳에 있다. 최종 GLB는 16,668개 삼각형이다. Blender에서 보이는 옆면과 뒷면은 한 장의 사진에 기반한 복원·보정 결과다. [최종 세 방향 렌더](../evidence/tripo-shuttle.png)

## 라켓과 선수

라켓은 기존 [Astra-Court Blender 프로젝트](../../court-studio/Astra-Court.blend)에서 분리해 내보냈다. 세로 21줄과 가로 23줄, 나선형 그립, 샤프트와 프레임이 들어 있다. 1인칭 포핸드와 백핸드가 사용하는 타점은 그립 원점에서 455 mm 떨어진 스트링 중심이다. 값은 라켓 GLB 노드의 stringBedHeight에 저장했다.

파트너와 상대 두 명은 새 선수 메시를 공유한다. 가상 선수 정면 원화를 TripoSR로 복원한 뒤 Blender에서 몸통과 유니폼을 기존 리그의 기준 자세에 맞췄다. 얼굴, 손가락, 코트화는 기존 GameMog/MakeHuman 기반 메시를 보완에 사용했다. 66개 관절의 이름과 초기 바인딩 행렬, 기존 67클립의 관절·라켓 애니메이션 샘플은 비교 테스트로 확인했다. 뒷면과 깊이는 단일 시점 추정이다. [편집용 선수 파일](player-source/Athlete.blend) · [게임용 메시](player.glb) · [세 자세 렌더](../evidence/player-motions.png) · [기존 모션 출처](../../court-studio/SOURCES.md)

## 경기장과 소리

2018 일본 오픈 프로그램 10쪽의 경기 사진을 코트 배색 참고로 사용했다. 좌석 배치와 18.15 m 천장은 게임용 설계다. [대회 프로그램](https://www.badminton-archive.com/download/tournament/2018/13/26/1/1#page=10)

라켓 타구음은 Joseph Sardin의 셔틀콕 타격 녹음에서 세 임팩트를 잘라 썼다. 타구 종류, 출발 속도, 타점과 듣는 사람의 거리·방향으로 음량, 고역, 좌우 위치를 조절한다. [원본 녹음](https://bigsoundbank.com/badminton-volant-sur-raquette-s0537.html) · [편집 기록](audio/SOURCE.txt)
