from pathlib import Path
p=Path('README.md');s=p.read_text(encoding='utf8')
s=s.replace('3차원 좌표 물리 + Canvas 원근 투영(2.5D 렌더링). WebGL 메시 엔진은 아닙니다.','3차원 물리 + Three.js WebGL 메시 렌더링. WebGL을 만들 수 없는 환경에서는 이전 Canvas 렌더링으로 대체합니다.')
s=s.replace('카메라는 이전에 제공한 대회 사진을 기준으로 후방 중앙의 망원 중계 시점으로 변경했습니다.','카메라는 후방에서 조금 낮은 대각 시점으로 변경했습니다.')
s=s.replace('렌더링은 3D 관절 좌표에 음영 캡슐과 폴리곤을 그리는 Canvas 방식이며 모션 캡처나 스킨 메시 애니메이션은 아닙니다.','렌더링은 WebGL 메시와 조명을 사용하며 성인 남성의 체형으로 어깨/상완/전완/몸통/허벅지/종아리/신발을 구성합니다. 메시를 각 관절 체인에 연결하는 절차적 리그이며, 고해상도 스킨 메시나 새로 학습한 동작 모델은 아닙니다.')
s=s.replace('외부 JS 라이브러리는 사용하지 않습니다.','Three.js는 `vendor/`에 번들되어 CDN 없이 동작합니다. 원본 버전은 package-lock.json에 고정하고 라이선스를 vendor/THREE-LICENSE에 보관합니다.')
s+='''
## v0.5 궤적·AI·영상 좌표 적용

- 드라이브 발사각 -2~4도, 푸시 -25~-4도, 드롭 -12~0도로 분리했습니다. 낮거나 늦은 타점에서는 네트 폴트가 가능합니다. 네트를 넘도록 구질을 강제로 띄우지 않습니다.
- 짧은 아래 사선 드래그도 드롭으로 분류하고 코스에 반영합니다. 수평에 가까운 드래그는 드라이브입니다.
- AI가 정확한 타점을 사전에 받는 동작을 제거했습니다. 0.25초(도전)/0.36초(편안하게) 관찰 후 현재 궤적으로 위치를 읽습니다. 이동 속도와 리치도 난이도에 따라 제한합니다.
- 셔틀의 최근 약 1.8초 실제 궤적을 WebGL 선으로 표시합니다.
- 사용자 제공 스텝 영상의 90~101초에서 12개 스크린샷 프레임을 샘플링했습니다. MediaPipe Pose Landmarker Full로 관절 좌표와 가시성/무릎·팔꿈치 각도를 추정했습니다. 프레임별 독립 추정이며 연속 영상 전체 추적이나 모델 재훈련을 수행한 것은 아닙니다.
- `data/footwork-reference.json`: 해부학적 좌우 이름을 유지한 이미지/3D 추정 좌표. `data/pose-contact-sheet.jpg`: 관절을 표시한 검증 이미지. 단일 카메라의 깊이 추정에는 오차가 있습니다.
- `tools/retarget_pose.py`: 골반 중심, 해부학적 우측/전방/상방 축으로 프레임별 회전을 제거합니다. 생성된 `footwork-clips.js`의 도달 포즈를 런지 발 위치/손목 목표에 블렌딩하고, 고정 뼈 길이 IK와 지면 높이로 제한합니다. 화면 좌우를 단순 반전하지 않습니다. 선수와 상대는 로컬 축을 월드로 각각 0/180도 회전합니다.
- 근거 도구: https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker?tab=Python

영상 추정 재실행에는 Python의 mediapipe, opencv-python, numpy와 `.cache/pose`에 저장한 원본 프레임/공식 pose_landmarker_full 모델이 필요합니다. 게임 실행에는 이 Python 도구들이 필요하지 않습니다.
'''
p.write_text(s,encoding='utf8')
