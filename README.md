# 음주내역신고센터 (ARS 2026) · v2

개인 음주 기록·절주 분석 웹앱의 **공공기관 전자민원 포털 스타일** 리디자인입니다.

> **가상 서비스 안내:** 이 프로젝트는 실제 정부기관 또는 공공기관에서 운영하는 서비스가 아닙니다.

## 기능
- 월간 음주 달력, 음주 기록 등록·수정 및 금주 표시
- 음주 동향·통계 분석, 개인 주량 및 절주 다짐
- JSON 기록 가져오기·내보내기
- Supabase 이메일 로그인 및 클라우드 동기화

기존 v1의 데이터 저장 키와 클라우드 연동 구조를 유지했습니다. 같은 GitHub Pages 도메인에서는 브라우저 localStorage가 공유되므로 v1과 v2가 같은 기록에 접근할 수 있습니다. **v2에서 기록을 수정하면 v1에도 영향을 줄 수 있으니** 실험 전에 JSON 백업을 권장합니다.

## 배포
GitHub 저장소 **Settings → Pages → Build and deployment → Deploy from a branch → main / (root) → Save**.

예상 주소: https://zinaga.github.io/sober-calendar-v2/

Supabase 이메일 로그인 사용 시 Supabase Authentication URL Configuration에 v2 주소를 허용해야 할 수 있습니다.

## 디자인
딥네이비, 백색, 회색, 절제된 적색을 사용한 가상 공공기관 서비스 스타일. 기존 앱의 기능과 분석 로직은 유지합니다.
