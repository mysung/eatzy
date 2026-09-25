import express from "express";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";
import { createServer as createViteServer } from "vite";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// 음식 카테고리별 고화질 대표 사진 라이브러리 (실제 접근 가능한 고해상도 미디어)
// 음식 카테고리별 고화질 대표 사진 및 폴백 이미지 라이브러리
interface FoodImageRule {
  keywords: string[];
  image: string;
  fallbackImage: string;
}

const FOOD_IMAGE_RULES: FoodImageRule[] = [
  // 1. 육회, 육회비빔밥, 한우육회 (일반 구이 소고기보다 반드시 먼저 매칭!)
  {
    keywords: ["육회", "한우육회", "육회비빔밥", "한우 육회", "육회 비빔밥", "소고기육회", "육사시미"],
    image: "images/yukhoe.jpg",
    fallbackImage: "images/beef-bbq.jpg"
  },
  // 2. 규카츠, 비프카츠, 화로구이 규카츠 (정통 소고기 카츠)
  {
    keywords: ["규카츠", "비프카츠", "비프 카츠", "소고기카츠", "소고기 카츠", "규카츠 화로구이"],
    image: "images/gyukatsu.jpg",
    fallbackImage: "images/beef-bbq.jpg"
  },
  // 3. 냉모밀, 메밀소바, 냉소바, 자루소바, 판모밀, 냉모밀 돈카츠 세트 (돈카츠 단독보다 먼저 매칭하여 세트 요리 시 소바 사진 제공!)
  {
    keywords: ["냉모밀", "모밀", "소바", "판모밀", "자루소바", "냉소바", "모밀국수", "메밀소바", "메밀국수", "모밀정식", "냉모밀정식", "모밀세트", "냉모밀세트", "냉모밀 돈카츠", "모밀 돈카츠"],
    image: "images/naengmomi.jpg",
    fallbackImage: "images/bibim-naeng.jpg"
  },
  // 4. 치즈돈까스, 치즈카츠, 치즈돈카츠
  {
    keywords: ["치즈돈까스", "치즈돈카츠", "치즈카츠", "치즈 돈카츠", "치즈 돈까스"],
    image: "images/cheese-tonkatsu.jpg",
    fallbackImage: "images/tonkatsu.jpg"
  },
  // 5. 소고기 덮밥, 규동, 우삼겹덮밥, 스테키동 (구이보다 먼저 매칭!)
  {
    keywords: ["규동", "소고기덮밥", "소고기 덮밥", "우삼겹덮밥", "차돌덮밥", "비프돈부리", "소고기볶음밥", "스테키동", "스테이크덮밥", "스테이크 덮밥"],
    image: "images/gyudon.jpg",
    fallbackImage: "images/beef-bbq.jpg"
  },
  // 6. 소고기 보양탕, 갈비탕, 곰탕, 설렁탕, 도가니탕, 사골, 소고기국밥 (구이보다 먼저 매칭!)
  {
    keywords: ["갈비탕", "왕갈비탕", "소갈비탕", "곰탕", "꼬리곰탕", "설렁탕", "도가니탕", "사골", "우족탕", "소고기국밥", "소고기 국밥", "소고기국", "소고기 무국", "소고기무국", "나주곰탕", "우거지탕", "장터국밥", "소머리국밥", "한우곰탕", "보양탕"],
    image: "images/seolleongtang.jpg",
    fallbackImage: "images/beef-soup.jpg"
  },
  // 7. 소갈비찜, 갈비찜 (구이보다 먼저 매칭!)
  {
    keywords: ["소갈비찜", "갈비찜", "매운갈비찜", "궁중갈비찜", "돼지갈비찜"],
    image: "images/beef-soup.jpg",
    fallbackImage: "images/seolleongtang.jpg"
  },
  // 8. 소불고기, 뚝배기불고기
  {
    keywords: ["뚝배기불고기", "뚝배기 불고기", "뚝불", "소불고기", "한우불고기", "간장불고기", "광양불고기", "언양불고기"],
    image: "images/gyudon.jpg",
    fallbackImage: "images/beef-bbq.jpg"
  },
  // 9. 샤브샤브, 스키야키, 훠궈, 밀푀유나베
  {
    keywords: ["샤브샤브", "샤브", "스키야키", "훠궈", "밀푀유나베", "편백찜", "소고기전골", "버섯전골", "나베", "소고기샤브"],
    image: "https://images.unsplash.com/photo-1582878826629-29b7ad1cdc43?auto=format&fit=crop&w=900&q=80",
    fallbackImage: "images/seolleongtang.jpg"
  },
  // 10. 순수 소고기 구이, 스테이크, 한우 등심/안심 (정확한 구이 단어만 매칭!)
  {
    keywords: ["소고기구이", "소고기 구이", "등심구이", "안심구이", "살치살", "채끝", "부채살", "토시살", "치마살", "차돌박이구이", "차돌구이", "소갈비구이", "갈비살구이", "갈비살", "스테이크", "와규구이", "소등심", "꽃등심", "양념소갈비", "la갈비", "소구이", "숯불갈비", "한우구이", "티본스테이크", "안심스테이크", "등심스테이크", "한우 숙성 등심"],
    image: "images/beef-bbq.jpg",
    fallbackImage: "https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=900&q=80"
  },
  // 11. 삼겹살, 오겹살, 목살구이, 돼지갈비
  {
    keywords: ["삼겹살", "오겹살", "목살구이", "삼겹살구이", "항정살", "가브리살", "돼지갈비구이", "대패삼겹", "숯불삼겹살", "돼지고기구이", "생삼겹"],
    image: "images/samgyeopsal.jpg",
    fallbackImage: "images/bossam.jpg"
  },
  // 12. 보쌈, 수육, 족발
  {
    keywords: ["보쌈", "수육", "족발", "보쌈정식", "마늘보쌈", "불족발", "모둠보쌈"],
    image: "images/bossam.jpg",
    fallbackImage: "images/jeyuk.jpg"
  },
  // 13. 제육볶음, 두루치기
  {
    keywords: ["제육볶음", "제육", "두루치기", "고추장불고기", "돼지불백", "제육덮밥"],
    image: "images/jeyuk.jpg",
    fallbackImage: "images/bossam.jpg"
  },
  // 14. 곱창, 막창, 대창, 양대창
  {
    keywords: ["곱창", "막창", "대창", "양대창", "곱창구이", "곱창전골", "야채곱창", "소곱창", "돼지곱창"],
    image: "images/samgyeopsal.jpg",
    fallbackImage: "images/beef-bbq.jpg"
  },
  // 15. 치킨, 닭강정, 가라아게
  {
    keywords: ["치킨", "닭강정", "가라아게", "후라이드", "양념치킨", "통닭", "순살치킨", "치킨버거"],
    image: "https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?auto=format&fit=crop&w=900&q=80",
    fallbackImage: "images/spicy-chicken.jpg"
  },
  // 16. 닭갈비, 찜닭, 닭볶음탕
  {
    keywords: ["닭갈비", "찜닭", "닭볶음탕", "닭도리탕", "안동찜닭", "치즈닭갈비"],
    image: "images/spicy-chicken.jpg",
    fallbackImage: "https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?auto=format&fit=crop&w=900&q=80"
  },
  // 17. 삼계탕, 백숙, 닭곰탕
  {
    keywords: ["삼계탕", "백숙", "닭백숙", "닭곰탕", "한방삼계탕", "누룽지백숙"],
    image: "images/seolleongtang.jpg",
    fallbackImage: "images/beef-soup.jpg"
  },
  // 18. 돈카츠, 돈까스, 가츠동, 히레카츠, 로스카츠
  {
    keywords: ["돈카츠", "돈까스", "돈가스", "가츠동", "히레카츠", "로스카츠", "돈카츠정식", "카츠", "돈가츠", "등심돈까스", "안심돈까스", "수제카츠", "상로스카츠", "특등심", "수제 등심 돈카츠"],
    image: "images/tonkatsu.jpg",
    fallbackImage: "images/cheese-tonkatsu.jpg"
  },
  // 15. 초밥, 스시, 모둠초밥, 후토마키
  {
    keywords: ["초밥", "스시", "모둠초밥", "특선초밥", "연어초밥", "광어초밥", "캘리포니아롤", "후토마키", "마키", "특선 모둠 초밥"],
    image: "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?auto=format&fit=crop&w=900&q=80",
    fallbackImage: "images/salmon-bowl.jpg"
  },
  // 16. 회, 사시미, 숙성회, 카이센동, 회덮밥
  {
    keywords: ["사시미", "숙성회", "활어회", "모둠회", "회덮밥", "카이센동", "물회", "오마카세", "숙성회 오마카세"],
    image: "https://images.unsplash.com/photo-1534482421-64566f976cfa?auto=format&fit=crop&w=900&q=80",
    fallbackImage: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=900&q=80"
  },
  // 17. 연어덮밥, 사케동
  {
    keywords: ["연어덮밥", "사케동", "생연어", "연어"],
    image: "images/salmon-bowl.jpg",
    fallbackImage: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=900&q=80"
  },
  // 18. 장어구이, 장어덮밥, 히츠마부시
  {
    keywords: ["장어", "장어구이", "장어덮밥", "히츠마부시", "우나기", "민물장어", "바다장어"],
    image: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=900&q=80",
    fallbackImage: "https://images.unsplash.com/photo-1590301157890-4810ed352733?auto=format&fit=crop&w=900&q=80"
  },
  // 19. 생선구이, 조림
  {
    keywords: ["생선구이", "고등어구이", "갈치구이", "삼치구이", "갈치조림", "고등어조림", "생선조림", "옥돔", "보리굴비", "조기"],
    image: "https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?auto=format&fit=crop&w=900&q=80",
    fallbackImage: "https://images.unsplash.com/photo-1534482421-64566f976cfa?auto=format&fit=crop&w=900&q=80"
  },
  // 20. 해물탕, 매운탕, 아구찜, 해물찜, 꽃게탕
  {
    keywords: ["해물탕", "매운탕", "아구찜", "해물찜", "꽃게탕", "조개구이", "조개찜", "연포탕", "동태탕", "알탕"],
    image: "https://images.unsplash.com/photo-1547592166-23ac45744acd?auto=format&fit=crop&w=900&q=80",
    fallbackImage: "images/spicy-octopus.jpg"
  },
  // 21. 제육볶음, 두루치기
  {
    keywords: ["제육볶음", "제육", "두루치기", "고추장불고기", "돼지불백", "제육덮밥"],
    image: "images/jeyuk.jpg",
    fallbackImage: "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=900&q=80"
  },
  // 22. 낙지, 오징어, 주꾸미
  {
    keywords: ["낙지", "낙지볶음", "오징어볶음", "오징어", "주꾸미", "쭈꾸미", "주꾸미볶음", "오삼불고기", "낙곱새"],
    image: "images/spicy-octopus.jpg",
    fallbackImage: "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=900&q=80"
  },
  // 23. 보쌈, 수육, 족발
  {
    keywords: ["보쌈", "수육", "족발", "보쌈정식", "마늘보쌈", "불족발"],
    image: "images/bossam.jpg",
    fallbackImage: "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=900&q=80"
  },
  // 24. 김치찌개, 김치찜
  {
    keywords: ["김치찌개", "김치찜", "돼지고기 김치찌개", "참치김치찌개", "묵은지김치찜"],
    image: "images/kimchi-stew.jpg",
    fallbackImage: "https://images.unsplash.com/photo-1547592166-23ac45744acd?auto=format&fit=crop&w=900&q=80"
  },
  // 25. 된장찌개, 청국장
  {
    keywords: ["된장찌개", "차돌된장찌개", "해물된장찌개", "청국장", "된장국", "우렁된장"],
    image: "images/seolleongtang.jpg",
    fallbackImage: "https://images.unsplash.com/photo-1547592166-23ac45744acd?auto=format&fit=crop&w=900&q=80"
  },
  // 26. 순두부찌개
  {
    keywords: ["순두부찌개", "해물순두부", "순두부", "차돌순두부"],
    image: "images/kimchi-stew.jpg",
    fallbackImage: "https://images.unsplash.com/photo-1547592166-23ac45744acd?auto=format&fit=crop&w=900&q=80"
  },
  // 27. 부대찌개
  {
    keywords: ["부대찌개", "부대", "존슨탕"],
    image: "images/kimchi-stew.jpg",
    fallbackImage: "https://images.unsplash.com/photo-1547592166-23ac45744acd?auto=format&fit=crop&w=900&q=80"
  },
  // 28. 감자탕, 뼈해장국
  {
    keywords: ["감자탕", "뼈해장국", "뼈다귀해장국", "뼈찜"],
    image: "images/beef-soup.jpg",
    fallbackImage: "https://images.unsplash.com/photo-1547592166-23ac45744acd?auto=format&fit=crop&w=900&q=80"
  },
  // 29. 육개장, 순대국, 해장국
  {
    keywords: ["육개장", "순대국", "순댓국", "선지해장국", "황태해장국", "콩나물국밥"],
    image: "images/beef-soup.jpg",
    fallbackImage: "https://images.unsplash.com/photo-1547496502-affa22d38842?auto=format&fit=crop&w=900&q=80"
  },
  // 30. 미역국
  {
    keywords: ["미역국", "소고기미역국", "조개미역국", "가자미미역국"],
    image: "images/miyeokguk.jpg",
    fallbackImage: "images/seolleongtang.jpg"
  },
  // 31. 비빔밥, 돌솥비빔밥
  {
    keywords: ["비빔밥", "돌솥비빔밥", "산채비빔밥", "전주비빔밥"],
    image: "images/bibimbap.jpg",
    fallbackImage: "https://images.unsplash.com/photo-1590301157890-4810ed352733?auto=format&fit=crop&w=900&q=80"
  },
  // 32. 간장계란밥 (명확한 계란밥만 매칭)
  {
    keywords: ["간장계란밥", "간장 계란밥", "계란밥", "타마고카케"],
    image: "images/egg-rice.jpg",
    fallbackImage: "images/bibimbap.jpg"
  },
  // 33. 김치볶음밥
  {
    keywords: ["김치볶음밥", "김치 볶음밥", "스팸김치볶음밥"],
    image: "https://images.unsplash.com/photo-1603133872878-684f208fb84b?auto=format&fit=crop&w=900&q=80",
    fallbackImage: "images/egg-rice.jpg"
  },
  // 34. 볶음밥, 필라프, 잡채밥, 리조또
  {
    keywords: ["볶음밥", "필라프", "잡채밥", "유산슬", "오므라이스", "김밥", "나시고랭", "리조또", "도리아", "새우볶음밥"],
    image: "https://images.unsplash.com/photo-1603133872878-684f208fb84b?auto=format&fit=crop&w=900&q=80",
    fallbackImage: "images/bibimbap.jpg"
  },
  // 35. 부타동, 돼지고기 덮밥
  {
    keywords: ["부타동", "돼지고기덮밥", "오야코동", "치킨마요", "돈부리"],
    image: "images/gyudon.jpg",
    fallbackImage: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=900&q=80"
  },
  // 36. 마파두부
  {
    keywords: ["마파두부", "마파두부밥"],
    image: "images/mapo-tofu.jpg",
    fallbackImage: "https://images.unsplash.com/photo-1547592166-23ac45744acd?auto=format&fit=crop&w=900&q=80"
  },
  // 37. 카레, 커리
  {
    keywords: ["카레", "커리", "하이라이스", "일본카레", "인도커리"],
    image: "https://images.unsplash.com/photo-1565557623262-b51c2513a641?auto=format&fit=crop&w=900&q=80",
    fallbackImage: "images/gyudon.jpg"
  },
  // 38. 짜장면, 간짜장
  {
    keywords: ["짜장면", "짜장", "간짜장", "쟁반짜장", "유니짜장"],
    image: "https://images.unsplash.com/photo-1585032226651-759b368d7246?auto=format&fit=crop&w=900&q=80",
    fallbackImage: "images/jjambbong.jpg"
  },
  // 39. 짬뽕
  {
    keywords: ["짬뽕", "해물짬뽕", "차돌짬뽕", "백짬뽕", "나가사키짬뽕"],
    image: "images/jjambbong.jpg",
    fallbackImage: "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=900&q=80"
  },
  // 40. 탕수육, 꿔바로우, 중화요리
  {
    keywords: ["탕수육", "꿔바로우", "유린기", "깐풍기", "칠리새우", "크림새우"],
    image: "https://images.unsplash.com/photo-1563245372-f21724e3856d?auto=format&fit=crop&w=900&q=80",
    fallbackImage: "images/tonkatsu.jpg"
  },
  // 41. 마라탕, 마라샹궈
  {
    keywords: ["마라탕", "마라샹궈", "마라반"],
    image: "images/malatang.jpg",
    fallbackImage: "https://images.unsplash.com/photo-1582878826629-29b7ad1cdc43?auto=format&fit=crop&w=900&q=80"
  },
  // 42. 라멘, 돈코츠, 탄탄멘
  {
    keywords: ["라멘", "돈코츠라멘", "미소라멘", "소유라멘", "탄탄멘", "단단면", "츠케멘"],
    image: "images/tonkotsu-ramen.jpg",
    fallbackImage: "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=900&q=80"
  },
  // 43. 칼국수, 수제비
  {
    keywords: ["칼국수", "바지락칼국수", "들깨칼국수", "닭칼국수", "장칼국수", "수제비"],
    image: "images/kalguksu.jpg",
    fallbackImage: "https://images.unsplash.com/photo-1618841557871-b4664fbf0cb3?auto=format&fit=crop&w=900&q=80"
  },
  // 44. 우동
  {
    keywords: ["우동", "가쓰오우동", "유부우동", "튀김우동", "야끼우동"],
    image: "https://images.unsplash.com/photo-1618841557871-b4664fbf0cb3?auto=format&fit=crop&w=900&q=80",
    fallbackImage: "images/janchi-guksu.jpg"
  },
  // 45. 냉면, 소바, 모밀
  {
    keywords: ["냉면", "물냉면", "비빔냉면", "평양냉면", "함흥냉면", "모밀", "소바", "판모밀", "막국수"],
    image: "images/bibim-naeng.jpg",
    fallbackImage: "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=900&q=80"
  },
  // 46. 국수, 잔치국수, 비빔국수, 쫄면
  {
    keywords: ["잔치국수", "비빔국수", "쫄면", "열무국수", "콩국수", "고기국수"],
    image: "images/bibim-noodle.jpg",
    fallbackImage: "images/janchi-guksu.jpg"
  },
  // 47. 쌀국수, 분짜, 팟타이
  {
    keywords: ["쌀국수", "소고기쌀국수", "분짜", "팟타이", "나시고랭", "똠얌꿍"],
    image: "images/pho.jpg",
    fallbackImage: "https://images.unsplash.com/photo-1618841557871-b4664fbf0cb3?auto=format&fit=crop&w=900&q=80"
  },
  // 48. 파스타, 스파게티
  {
    keywords: ["파스타", "스파게티", "까르보나라", "토마토파스타", "오일파스타", "알리오올리오", "로제파스타", "투움바"],
    image: "images/carbonara.jpg",
    fallbackImage: "https://images.unsplash.com/photo-1551183053-bf91a1d81141?auto=format&fit=crop&w=900&q=80"
  },
  // 49. 피자
  {
    keywords: ["피자", "화덕피자", "페퍼로니피자", "고르곤졸라"],
    image: "https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=900&q=80",
    fallbackImage: "images/sandwich.jpg"
  },
  // 50. 버거, 햄버거
  {
    keywords: ["버거", "햄버거", "수제버거", "치즈버거"],
    image: "images/spicy-burger.jpg",
    fallbackImage: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=900&q=80"
  },
  // 51. 샌드위치, 토스트
  {
    keywords: ["샌드위치", "토스트", "파니니", "베이글", "클럽샌드위치"],
    image: "images/sandwich.jpg",
    fallbackImage: "https://images.unsplash.com/photo-1528735602780-2552fd46c7af?auto=format&fit=crop&w=900&q=80"
  },
  // 52. 샐러드, 포케
  {
    keywords: ["샐러드", "포케", "연어포케", "닭가슴살샐러드", "리코타샐러드"],
    image: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=900&q=80",
    fallbackImage: "images/sandwich.jpg"
  },
  // 53. 떡볶이, 분식
  {
    keywords: ["떡볶이", "라볶이", "로제떡볶이", "튀김", "순대", "분식"],
    image: "images/tteokbokki.jpg",
    fallbackImage: "https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?auto=format&fit=crop&w=900&q=80"
  },
  // 54. 만두, 딤섬
  {
    keywords: ["만두", "딤섬", "교자", "샤오롱바오", "군만두", "물만두", "찐만두"],
    image: "https://images.unsplash.com/photo-1496116218417-1a781b1c416c?auto=format&fit=crop&w=900&q=80",
    fallbackImage: "https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?auto=format&fit=crop&w=900&q=80"
  }
];

export function getBestFoodImage(
  menuName: string,
  searchKeyword?: string,
  category?: string,
  staple?: string,
  flavor?: string,
  itemIndex: number = 0,
  usedImages?: Set<string>
): { image: string; fallbackImage: string } {
  const targetText = `${menuName || ""} ${searchKeyword || ""} ${category || ""}`.toLowerCase().trim();

  const resolveUnique = (img: string, fallback: string): { image: string; fallbackImage: string } => {
    let finalImg = img;
    let finalFallback = fallback;
    if (usedImages && usedImages.has(finalImg)) {
      if (finalFallback && !usedImages.has(finalFallback)) {
        finalImg = finalFallback;
      } else {
        const altPool = [
          "images/gyukatsu.jpg",
          "images/naengmomi.jpg",
          "images/cheese-tonkatsu.jpg",
          "images/beef-bbq.jpg",
          "images/samgyeopsal.jpg",
          "images/yukhoe.jpg",
          "images/bossam.jpg",
          "images/jeyuk.jpg",
          "images/salmon-bowl.jpg",
          "images/tonkotsu-ramen.jpg",
          "images/kalguksu.jpg",
          "images/bibim-naeng.jpg",
          "images/seolleongtang.jpg",
          "images/bibimbap.jpg",
          "images/carbonara.jpg"
        ];
        for (const alt of altPool) {
          if (!usedImages.has(alt)) {
            finalImg = alt;
            break;
          }
        }
      }
    }
    if (usedImages) {
      usedImages.add(finalImg);
    }
    return { image: finalImg, fallbackImage: finalFallback };
  };

  // 1. 구체적인 음식 키워드 매칭 (규칙 순서대로 정밀 검사)
  for (const rule of FOOD_IMAGE_RULES) {
    for (const kw of rule.keywords) {
      if (targetText.includes(kw.toLowerCase())) {
        return resolveUnique(rule.image, rule.fallbackImage);
      }
    }
  }

  // 2. 조리 형태별 형태소 분석 (구이보다 국물/덮밥/면을 먼저 확인하여 오매칭 원천 차단)
  // 2-1. 육회 / 회
  if (/(육회|사시미|활어회|숙성회)/.test(targetText)) {
    return resolveUnique("images/yukhoe.jpg", "images/beef-bbq.jpg");
  }

  // 2-2. 탕 / 국 / 곰탕 / 설렁탕 / 국밥
  if (/(갈비탕|곰탕|설렁탕|국밥|보양탕|도가니|사골|우족|탕|해장국|순대국|육개장)/.test(targetText)) {
    return resolveUnique("images/seolleongtang.jpg", "images/beef-soup.jpg");
  }

  // 2-3. 찌개 / 전골 / 샤브 / 조림
  if (/(찌개|전골|샤브|스키야키|나베|조림|찜)/.test(targetText)) {
    return resolveUnique("images/kimchi-stew.jpg", "images/beef-soup.jpg");
  }

  // 2-4. 모밀 / 소바 / 면 / 국수
  if (/(모밀|소바|냉면|국수|라멘|칼국수|우동|면|스파게티|파스타)/.test(targetText)) {
    return resolveUnique("images/naengmomi.jpg", "images/kalguksu.jpg");
  }

  // 2-5. 덮밥 / 볶음밥 / 비빔밥
  if (/(덮밥|규동|돈부리|볶음밥|비빔밥|라이스|필라프|리조또)/.test(targetText)) {
    return resolveUnique("images/gyudon.jpg", "images/bibimbap.jpg");
  }

  // 2-6. 카츠 / 튀김
  if (/(카츠|까스|튀김|가츠|크로켓|텐동)/.test(targetText)) {
    return resolveUnique("images/tonkatsu.jpg", "images/cheese-tonkatsu.jpg");
  }

  // 2-7. 고기 구이 / 바베큐 / 스테이크
  if (/(구이|스테이크|바베큐|bbq|로스|직화|갈비|등심|안심|살치|채끝|부채살|삼겹)/.test(targetText)) {
    return resolveUnique("images/beef-bbq.jpg", "images/samgyeopsal.jpg");
  }

  // 2-8. 회 / 초밥 / 해물
  if (/(회|초밥|스시|해물|생선|사시미|해산물)/.test(targetText)) {
    return resolveUnique("https://images.unsplash.com/photo-1579871494447-9811cf80d66c?auto=format&fit=crop&w=900&q=80", "images/salmon-bowl.jpg");
  }

  // 3. 사용자 선택 조건 (밥 vs 면, 매콤 vs 담백)
  if (staple === "rice") {
    if (flavor === "spicy") {
      return resolveUnique("images/jeyuk.jpg", "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=900&q=80");
    } else {
      return resolveUnique("images/seolleongtang.jpg", "https://images.unsplash.com/photo-1547496502-affa22d38842?auto=format&fit=crop&w=900&q=80");
    }
  } else if (staple === "noodle") {
    if (flavor === "spicy") {
      return resolveUnique("images/jjambbong.jpg", "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=900&q=80");
    } else {
      return resolveUnique("images/janchi-guksu.jpg", "https://images.unsplash.com/photo-1618841557871-b4664fbf0cb3?auto=format&fit=crop&w=900&q=80");
    }
  }

  // 4. 완전 신규 미식 인덱스별 고유 사진 (Card 1, 2, 3 각각 100% 다른 고품질 사진)
  const defaultFeasts = [
    {
      image: "https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=900&q=80",
      fallbackImage: "https://images.unsplash.com/photo-1558030006-450675393462?auto=format&fit=crop&w=900&q=80"
    },
    {
      image: "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=900&q=80",
      fallbackImage: "images/tonkatsu.jpg"
    },
    {
      image: "https://images.unsplash.com/photo-1590301157890-4810ed352733?auto=format&fit=crop&w=900&q=80",
      fallbackImage: "images/bibimbap.jpg"
    }
  ];

  const chosen = defaultFeasts[Math.abs(itemIndex) % defaultFeasts.length];
  return resolveUnique(chosen.image, chosen.fallbackImage);
}

// 풍성한 오프라인/폴백 메뉴 풀 (한식, 중식, 일식, 양식, 분식 완벽 구비)
const FALLBACK_MENUS: Record<string, Array<{ name: string; emoji: string; category: string; reason: string; tip: string; image: string; fallbackImage: string }>> = {
  "spicy-rice": [
    // 한식
    { name: "제육볶음 덮밥", emoji: "🥘", category: "한식", reason: "매콤달콤한 특제 양념에 불향 가득한 돼지고기와 따끈한 쌀밥의 불패 조합!", tip: "계란프라이 반숙을 얹어 슥슥 비벼 드시면 더욱 맛있습니다.", image: "images/jeyuk.jpg", fallbackImage: "https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e5/Jeyuk-bokkeum_2.jpg/960px-Jeyuk-bokkeum_2.jpg" },
    { name: "돼지고기 김치찌개", emoji: "🍲", category: "한식", reason: "잘 익은 묵은지와 두툼한 생돼지고기가 푹 끓여져 칼칼하고 깊은 국물 맛!", tip: "라면사리나 계란말이를 곁들이면 든든함이 2배가 됩니다.", image: "images/kimchi-stew.jpg", fallbackImage: "https://upload.wikimedia.org/wikipedia/commons/d/d6/Korean.cuisine-Kimchi_jjigae-01.jpg" },
    { name: "매콤 낙지덮밥", emoji: "🐙", category: "한식", reason: "탱글탱글 쫄깃한 통낙지와 매콤한 불맛 양념이 지친 활력을 번쩍 깨워줍니다.", tip: "데친 콩나물과 참기름을 듬뿍 넣고 슥슥 비벼 드세요.", image: "images/spicy-octopus.jpg", fallbackImage: "https://thumb.wikimedia.org/wikipedia/commons/thumb/6/60/Nakji-bokkeum.jpg/960px-Nakji-bokkeum.jpg" },
    { name: "얼큰 해물 순두부찌개", emoji: "🌶️", category: "한식", reason: "몽글몽글 부드러운 순두부와 시원한 해물이 칼칼한 고추기름 국물에 퐁당!", tip: "뚝배기가 끓을 때 생계란 하나 톡 깨 넣어 노른자를 풀어주세요.", image: "https://thumb.wikimedia.org/wikipedia/commons/thumb/4/4c/Sundubu-jjigae_3.jpg/960px-Sundubu-jjigae_3.jpg", fallbackImage: "https://thumb.wikimedia.org/wikipedia/commons/thumb/4/4c/Sundubu-jjigae_3.jpg/960px-Sundubu-jjigae_3.jpg" },
    { name: "묵은지 닭볶음탕", emoji: "🍗", category: "한식", reason: "포슬포슬 감자와 쫄깃한 닭다리살, 깊은 양념 국물이 밥도둑 그 자체!", tip: "남은 진국 양념에 밥과 김가루를 넣고 볶음밥으로 마무리하세요.", image: "images/spicy-chicken.jpg", fallbackImage: "https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e5/Dak-bokkeum-tang_2.jpg/960px-Dak-bokkeum-tang_2.jpg" },
    { name: "소고기 육개장", emoji: "🥩", category: "한식", reason: "잘게 찢은 양지머리와 대파, 토란대가 푹 우러난 칼칼하고 진한 보양 국물!", tip: "밥을 반 공기 먼저 말아 국물과 건더기를 먼저 즐겨보세요.", image: "images/beef-soup.jpg", fallbackImage: "https://thumb.wikimedia.org/wikipedia/commons/thumb/4/4e/Yukgaejang_2.jpg/960px-Yukgaejang_2.jpg" },
    { name: "의정부식 부대찌개", emoji: "🥘", category: "한식", reason: "진한 사골 육수에 고급 햄, 소시지, 치즈와 김치가 어우러진 푸짐한 찌개!", tip: "라면사리를 먼저 건져먹고 진해진 국물에 밥을 비벼 드세요.", image: "https://thumb.wikimedia.org/wikipedia/commons/thumb/d/d4/Budae-jjigae.jpg/960px-Budae-jjigae.jpg", fallbackImage: "https://thumb.wikimedia.org/wikipedia/commons/thumb/d/d4/Budae-jjigae.jpg/960px-Budae-jjigae.jpg" },
    // 중식
    { name: "사천 마파두부 덮밥", emoji: "🍛", category: "중식", reason: "알싸한 사천 마라향과 부드러운 연두부, 다진 고기의 감칠맛이 밥알에 쏙쏙!", tip: "산초가루를 살짝 뿌리면 정통 중화풍 풍미가 살아납니다.", image: "images/mapo-tofu.jpg", fallbackImage: "https://thumb.wikimedia.org/wikipedia/commons/thumb/5/58/Mapo_Doufu.jpg/960px-Mapo_Doufu.jpg" },
    { name: "매콤 중화 잡채밥", emoji: "🥢", category: "중식", reason: "탱글한 당면과 각종 채소, 돼지고기를 고추기름에 센 불로 볶아낸 감칠맛!", tip: "짜장 소스와 짬뽕 국물을 곁들여 먹으면 더욱 든든합니다.", image: "https://thumb.wikimedia.org/wikipedia/commons/thumb/9/91/Japchaebap.jpg/960px-Japchaebap.jpg", fallbackImage: "https://thumb.wikimedia.org/wikipedia/commons/thumb/9/91/Japchaebap.jpg/960px-Japchaebap.jpg" },
    { name: "얼큰 중화 비빔밥", emoji: "🍳", category: "중식", reason: "대구식 중화 비빔밥의 불향 가득한 해물 고기 볶음과 계란후라이의 황홀한 만남!", tip: "반숙 노른자를 터뜨려 센 불맛 양념과 골고루 비벼 드세요.", image: "images/bibimbap.jpg", fallbackImage: "https://thumb.wikimedia.org/wikipedia/commons/thumb/4/44/Dolsot-bibimbap.jpg/960px-Dolsot-bibimbap.jpg" },
    // 일식
    { name: "매운 가츠동", emoji: "🍱", category: "일식", reason: "바삭한 돈카츠에 매콤달콤한 특제 소스와 부드러운 계란이 얹어진 별미 덮밥!", tip: "돈카츠의 바삭함과 촉촉한 양념 밥을 함께 떠서 드세요.", image: "images/tonkatsu.jpg", fallbackImage: "https://thumb.wikimedia.org/wikipedia/commons/thumb/8/8b/Tonkatsu_by_cuckoomis.jpg/960px-Tonkatsu_by_cuckoomis.jpg" },
    { name: "매콤 비프 카레라이스", emoji: "🍛", category: "일식", reason: "오랜 시간 푹 끓여 깊고 진한 일본식 카레에 매콤한 풍미와 부드러운 소고기!", tip: "마늘 후레이크나 대파 토핑을 곁들이면 식감이 바삭합니다.", image: "https://thumb.wikimedia.org/wikipedia/commons/thumb/d/d4/Japanese_curry_rice_by_jetalone_in_Tokyo.jpg/960px-Japanese_curry_rice_by_jetalone_in_Tokyo.jpg", fallbackImage: "https://thumb.wikimedia.org/wikipedia/commons/thumb/d/d4/Japanese_curry_rice_by_jetalone_in_Tokyo.jpg/960px-Japanese_curry_rice_by_jetalone_in_Tokyo.jpg" },
    { name: "매운 부타동", emoji: "🍲", category: "일식", reason: "불향 가득 구워낸 삼겹살에 매콤한 타레 소스가 배어든 홋카이도식 덮밥!", tip: "와사비를 살짝 올려 기름진 고소함과 매콤함을 함께 즐기세요.", image: "https://thumb.wikimedia.org/wikipedia/commons/thumb/7/77/Samgyeopsal-gui.jpg/960px-Samgyeopsal-gui.jpg", fallbackImage: "https://thumb.wikimedia.org/wikipedia/commons/thumb/7/77/Samgyeopsal-gui.jpg/960px-Samgyeopsal-gui.jpg" },
    // 양식
    { name: "매콤 토마토 해산물 리조또", emoji: "🥘", category: "양식", reason: "신선한 조개와 새우, 오징어가 매콤한 토마토 소스와 어우러진 촉촉한 리조또!", tip: "파마산 치즈 가루를 솔솔 뿌려 감칠맛을 배가시켜 드세요.", image: "https://thumb.wikimedia.org/wikipedia/commons/thumb/d/d3/Risotto_ai_frutti_di_mare_01.jpg/960px-Risotto_ai_frutti_di_mare_01.jpg", fallbackImage: "https://thumb.wikimedia.org/wikipedia/commons/thumb/d/d3/Risotto_ai_frutti_di_mare_01.jpg/960px-Risotto_ai_frutti_di_mare_01.jpg" },
    { name: "스파이시 치킨 도리아", emoji: "🧀", category: "양식", reason: "매콤하게 볶아낸 밥 위에 고소한 닭가슴살과 모짜렐라 치즈를 듬뿍 얹어 구운 요리!", tip: "쭉 늘어나는 치즈와 매콤한 밥을 뜨거울 때 호호 불어 드세요.", image: "https://thumb.wikimedia.org/wikipedia/commons/thumb/6/66/Mushroom_risotto_%28Unsplash%29.jpg/960px-Mushroom_risotto_%28Unsplash%29.jpg", fallbackImage: "https://thumb.wikimedia.org/wikipedia/commons/thumb/6/66/Mushroom_risotto_%28Unsplash%29.jpg/960px-Mushroom_risotto_%28Unsplash%29.jpg" },
    // 분식 & 기타
    { name: "매콤 스팸 김치볶음밥", emoji: "🍳", category: "분식", reason: "잘 익은 김치와 짭조름한 스팸을 고슬고슬 볶아 계란후라이를 얹은 국민 밥도둑!", tip: "치즈 토핑을 추가하거나 김가루를 듬뿍 뿌려 드세요.", image: "https://thumb.wikimedia.org/wikipedia/commons/thumb/c/cd/Kimchi_bokkeumbap.jpg/960px-Kimchi_bokkeumbap.jpg", fallbackImage: "https://thumb.wikimedia.org/wikipedia/commons/thumb/c/cd/Kimchi_bokkeumbap.jpg/960px-Kimchi_bokkeumbap.jpg" },
    { name: "매콤 떡볶이와 튀김 김밥 세트", emoji: "🍢", category: "분식", reason: "매콤달콤한 떡볶이 국물에 고소한 김밥과 바삭한 튀김을 찍어먹는 행복!", tip: "김밥을 떡볶이 소스에 푹 담가 촉촉하게 즐겨보세요.", image: "images/tteokbokki.jpg", fallbackImage: "https://thumb.wikimedia.org/wikipedia/commons/thumb/5/56/Korean.snacks-Tteokbokki-08.jpg/960px-Korean.snacks-Tteokbokki-08.jpg" }
  ],
  "spicy-noodle": [
    // 한식
    { name: "매콤 명태 회냉면", emoji: "🥢", category: "한식", reason: "쫄깃한 함흥 면발 위에 숙성된 새콤달콤 매콤한 명태회가 듬뿍!", tip: "따뜻한 사골 온육수로 속을 먼저 달랜 뒤 겨자를 살짝 곁들이세요.", image: "images/bibim-naeng.jpg", fallbackImage: "https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a2/Bibim-guksu.jpg/960px-Bibim-guksu.jpg" },
    { name: "새콤매콤 비빔국수", emoji: "🍜", category: "한식", reason: "아삭한 오이와 김가루, 매콤새콤 특제 초고추장 양념이 쫄깃한 소면과 환상궁합!", tip: "삶은 달걀 반쪽을 곁들여 매운맛을 고소하게 감싸주세요.", image: "images/bibim-noodle.jpg", fallbackImage: "https://upload.wikimedia.org/wikipedia/commons/7/7d/Korean_noodle-Bibim_guksu-02.jpg" },
    { name: "얼큰 장칼국수", emoji: "🍲", category: "한식", reason: "고추장과 된장을 풀어 진하고 얼큰구수한 강원도식 손칼국수 한 그릇!", tip: "김가루와 깨소금을 듬뿍 넣어 구수함을 극대화해보세요.", image: "images/kalguksu.jpg", fallbackImage: "https://thumb.wikimedia.org/wikipedia/commons/thumb/9/96/Bajirak-kalguksu.jpg/960px-Bajirak-kalguksu.jpg" },
    // 중식
    { name: "해물 짬뽕", emoji: "🍜", category: "중식", reason: "오징어와 홍합, 신선한 야채에 센 불향을 입혀 칼칼하고 시원한 명품 국물!", tip: "바삭한 찹쌀 탕수육을 곁들이면 최고의 단짝 점심 완성!", image: "images/jjambbong.jpg", fallbackImage: "https://thumb.wikimedia.org/wikipedia/commons/thumb/c/cf/Jjamppong_4.jpg/960px-Jjamppong_4.jpg" },
    { name: "차돌박이 짬뽕", emoji: "🥩", category: "중식", reason: "고소한 차돌박이의 육즙이 진한 불맛 짬뽕 국물에 녹아들어 극강의 묵직함!", tip: "면을 다 드신 후 밥 한 숟가락 말아 드시면 완벽합니다.", image: "https://thumb.wikimedia.org/wikipedia/commons/thumb/8/82/Jjamppong_by_stu_spivack.jpg/960px-Jjamppong_by_stu_spivack.jpg", fallbackImage: "https://thumb.wikimedia.org/wikipedia/commons/thumb/8/82/Jjamppong_by_stu_spivack.jpg/960px-Jjamppong_by_stu_spivack.jpg" },
    { name: "얼큰 마라탕", emoji: "🍲", category: "중식", reason: "내가 좋아하는 푸주, 옥수수면, 청경채를 칼칼하고 알싸한 마라육수에 듬뿍!", tip: "땅콩 소스(마장)를 듬뿍 찍으면 매운맛과 고소함이 조화롭습니다.", image: "images/malatang.jpg", fallbackImage: "https://thumb.wikimedia.org/wikipedia/commons/thumb/9/91/Malatang.jpg/960px-Malatang.jpg" },
    { name: "사천 탄탄멘", emoji: "🥜", category: "중식", reason: "진한 참깨 페이스트의 고소함과 고추기름, 산초의 얼얼함이 어우러진 별미 면요리!", tip: "면을 건져먹은 뒤 온천계란을 풀어 진한 풍미를 만끽하세요.", image: "https://thumb.wikimedia.org/wikipedia/commons/thumb/d/df/Dandan_mian.jpg/960px-Dandan_mian.jpg", fallbackImage: "https://thumb.wikimedia.org/wikipedia/commons/thumb/d/df/Dandan_mian.jpg/960px-Dandan_mian.jpg" },
    // 일식
    { name: "카라이 돈코츠 라멘", emoji: "🍜", category: "일식", reason: "진한 사골 육수에 매콤한 특제 고추기름 소스를 더해 얼큰하고 깊은 맛의 라멘!", tip: "차슈와 반숙란을 국물에 적셔 면과 함께 호로록 드세요.", image: "images/tonkotsu-ramen.jpg", fallbackImage: "https://thumb.wikimedia.org/wikipedia/commons/thumb/f/fd/Tonkotsu_Ramen_Special%2C_Hakata_Choten%2C_Paris_001.jpg/960px-Tonkotsu_Ramen_Special%2C_Hakata_Choten%2C_Paris_001.jpg" },
    { name: "매콤 볶음우동(야끼우동)", emoji: "🥢", category: "일식", reason: "탱글한 사누끼 우동면과 해산물, 야채를 매콤한 소스에 볶아 가쓰오부시를 올린 별미!", tip: "춤추는 가쓰오부시와 함께 뜨거울 때 바로 비벼드세요.", image: "https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e0/Tempura_udon_by_jetalone_in_Tokyo.jpg/960px-Tempura_udon_by_jetalone_in_Tokyo.jpg", fallbackImage: "https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e0/Tempura_udon_by_jetalone_in_Tokyo.jpg/960px-Tempura_udon_by_jetalone_in_Tokyo.jpg" },
    // 양식
    { name: "매콤 투움바 파스타", emoji: "🍝", category: "양식", reason: "진하고 꾸덕한 크림소스에 매콤한 고춧가루와 통통한 새우가 환상의 조합!", tip: "마늘빵으로 그릇 바닥의 남은 소스까지 깔끔하게 닦아 드세요.", image: "images/toowoomba.jpg", fallbackImage: "https://images.unsplash.com/photo-1621996346565-e3d5d6281093?auto=format&fit=crop&w=900&q=80" },
    { name: "매운 아라비아따 파스타", emoji: "🍝", category: "양식", reason: "신선한 토마토 소스에 페페론치노와 마늘의 칼칼한 매운맛이 산뜻한 감칠맛!", tip: "파르미지아노 레지아노 치즈를 듬뿍 뿌려 풍미를 끌어올리세요.", image: "images/toowoomba.jpg", fallbackImage: "https://images.unsplash.com/photo-1551183053-bf91a1d81141?auto=format&fit=crop&w=900&q=80" },
    { name: "스파이시 치킨버거", emoji: "🍔", category: "양식", reason: "두툼하고 바삭한 매콤 닭다리살 패티와 아삭한 양상추의 꽉 찬 한 입!", tip: "케이준 감자튀김과 시원한 제로콜라 조합으로 완벽한 런치!", image: "images/spicy-burger.jpg", fallbackImage: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=900&q=80" },
    // 분식 & 기타
    { name: "새콤달콤 쫄면", emoji: "🥗", category: "분식", reason: "아삭한 콩나물, 양배추와 쫄깃탱탱 면발, 새콤달콤 매운 특제 초장의 만남!", tip: "바삭한 군만두를 쫄면에 싸 먹는 '비빔만두' 조합 추천!", image: "https://thumb.wikimedia.org/wikipedia/commons/thumb/4/4d/Jjolmyeon.jpg/960px-Jjolmyeon.jpg", fallbackImage: "https://thumb.wikimedia.org/wikipedia/commons/thumb/4/4d/Jjolmyeon.jpg/960px-Jjolmyeon.jpg" },
    { name: "매콤 떡볶이와 라면사리", emoji: "🍢", category: "분식", reason: "매콤달콤 걸쭉한 국물에 쫄깃한 밀떡과 꼬들꼬들 라면사리의 절대 궁합!", tip: "어묵 국물 한 모금 마시며 매콤함을 달래보세요.", image: "images/tteokbokki.jpg", fallbackImage: "https://thumb.wikimedia.org/wikipedia/commons/thumb/5/56/Korean.snacks-Tteokbokki-08.jpg/960px-Korean.snacks-Tteokbokki-08.jpg" }
  ],
  "mild-rice": [
    // 한식
    { name: "소고기 왕갈비탕", emoji: "🥩", category: "한식", reason: "맑고 투명하지만 깊은 소고기 육수에 푹 고아 부드러운 왕갈비가 푸짐!", tip: "잘 익은 깍두기 국물을 살짝 넣거나 고기는 겨자소스에 찍어드세요.", image: "images/seolleongtang.jpg", fallbackImage: "https://images.unsplash.com/photo-1547496502-affa22d38842?auto=format&fit=crop&w=900&q=80" },
    { name: "맑은 나주곰탕 정식", emoji: "🥣", category: "한식", reason: "기름기를 걷어내 담백하고 깔끔한 양지 국물에 부드러운 고기가 가득!", tip: "후춧가루 살짝 치고 송송 썬 대파를 듬뿍 넣어 개운하게 즐기세요.", image: "images/naju-gomtang.jpg", fallbackImage: "https://thumb.wikimedia.org/wikipedia/commons/thumb/a/ab/Gomguk_2.jpg/960px-Gomguk_2.jpg" },
    { name: "전주 돌솥 비빔밥", emoji: "🍳", category: "한식", reason: "지글지글 누룽지가 눌어붙는 소리와 오색 나물, 고소한 참기름의 건강한 조화!", tip: "돌솥 바닥의 바삭한 누룽지는 숟가락으로 긁어 아껴 드세요.", image: "images/bibimbap.jpg", fallbackImage: "https://thumb.wikimedia.org/wikipedia/commons/thumb/4/44/Dolsot-bibimbap.jpg/960px-Dolsot-bibimbap.jpg" },
    { name: "촉촉한 보쌈 정식", emoji: "🥬", category: "한식", reason: "야들야들하게 삶아낸 돼지 수육과 아삭하고 달큼한 무김치의 정갈한 한상!", tip: "신선한 배추속에 고기와 쌈장, 새우젓을 올려 한 입 가득 쌈 싸보세요.", image: "images/bossam.jpg", fallbackImage: "https://thumb.wikimedia.org/wikipedia/commons/thumb/4/4a/Bossam.jpg/960px-Bossam.jpg" },
    { name: "진한 뽀얀 설렁탕", emoji: "🍲", category: "한식", reason: "사골을 24시간 우려낸 깊고 구수한 국물에 소면과 얇은 소고기 수육!", tip: "소금 간을 심심하게 맞추고 달큰한 깍두기 국물을 부어 먹어도 별미!", image: "images/seolleongtang.jpg", fallbackImage: "https://thumb.wikimedia.org/wikipedia/commons/thumb/8/87/Seolleongtang.jpg/960px-Seolleongtang.jpg" },
    { name: "구수한 차돌 된장찌개", emoji: "🥘", category: "한식", reason: "고소한 차돌박이 기름과 재래식 된장, 호박과 두부가 어우러진 영혼의 찌개!", tip: "밥 위에 두부와 국물을 듬뿍 얹어 으깨 비벼 드시면 최고입니다.", image: "https://thumb.wikimedia.org/wikipedia/commons/thumb/3/3a/Doenjang-jjigae_3.jpg/960px-Doenjang-jjigae_3.jpg", fallbackImage: "https://thumb.wikimedia.org/wikipedia/commons/thumb/3/3a/Doenjang-jjigae_3.jpg/960px-Doenjang-jjigae_3.jpg" },
    // 중식
    { name: "고슬고슬 삼선 볶음밥", emoji: "🍚", category: "중식", reason: "새우, 해삼, 오징어와 고소한 계란이 센 불에 흩날리듯 볶아진 중화 볶음밥의 정석!", tip: "짜장 소스를 살짝 비벼 먹고 맑은 계란국을 곁들여보세요.", image: "https://thumb.wikimedia.org/wikipedia/commons/thumb/5/52/Fried_Rice_in_Hong_Kong.jpg/960px-Fried_Rice_in_Hong_Kong.jpg", fallbackImage: "https://thumb.wikimedia.org/wikipedia/commons/thumb/5/52/Fried_Rice_in_Hong_Kong.jpg/960px-Fried_Rice_in_Hong_Kong.jpg" },
    { name: "담백한 유산슬 덮밥", emoji: "🥢", category: "중식", reason: "채 썬 해삼, 돼지고기, 죽순, 버섯을 부드럽고 걸쭉하게 볶아낸 고급스러운 덮밥!", tip: "고추기름을 서너 방울 떨어뜨려 풍미를 살려보세요.", image: "https://thumb.wikimedia.org/wikipedia/commons/thumb/8/8c/Yusanseul.jpg/960px-Yusanseul.jpg", fallbackImage: "https://thumb.wikimedia.org/wikipedia/commons/thumb/8/8c/Yusanseul.jpg/960px-Yusanseul.jpg" },
    { name: "게살 볶음밥", emoji: "🦀", category: "중식", reason: "달콤하고 부드러운 진짜 게살이 고슬고슬한 밥알 사이사이 씹히는 고급스러운 풍미!", tip: "단무지와 짜사이 반찬을 얹어 아삭하게 즐기세요.", image: "https://thumb.wikimedia.org/wikipedia/commons/thumb/5/52/Fried_Rice_in_Hong_Kong.jpg/960px-Fried_Rice_in_Hong_Kong.jpg", fallbackImage: "https://thumb.wikimedia.org/wikipedia/commons/thumb/5/52/Fried_Rice_in_Hong_Kong.jpg/960px-Fried_Rice_in_Hong_Kong.jpg" },
    // 일식
    { name: "생연어 사케동 덮밥", emoji: "🍣", category: "일식", reason: "도톰하고 기름진 고소한 생연어와 감칠맛 나는 초밥용 밥, 생와사비의 깔끔함!", tip: "비비지 말고 연어 위에 무순과 와사비를 얹어 밥과 함께 떠드세요.", image: "images/salmon-bowl.jpg", fallbackImage: "https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a8/Salmon_don_of_Nakau.jpg/960px-Salmon_don_of_Nakau.jpg" },
    { name: "수제 등심 돈카츠 정식", emoji: "🍱", category: "일식", reason: "바삭바삭 살아있는 튀김옷 속에 두툼하고 육즙 가득한 한돈 등심!", tip: "첫 점은 말돈 소금과 생와사비만 찍어 본연의 육향을 음미해보세요.", image: "images/tonkatsu.jpg", fallbackImage: "https://thumb.wikimedia.org/wikipedia/commons/thumb/8/8b/Tonkatsu_by_cuckoomis.jpg/960px-Tonkatsu_by_cuckoomis.jpg" },
    { name: "달콤 짭조름 규동", emoji: "🍲", category: "일식", reason: "얇게 저민 부드러운 소고기와 양파가 달달한 쯔유 소스에 졸여져 밥도둑!", tip: "초생강(베니쇼가)과 시치미 가루를 톡톡 곁들이면 끝까지 산뜻합니다.", image: "images/gyudon.jpg", fallbackImage: "https://thumb.wikimedia.org/wikipedia/commons/thumb/f/f6/Gyudon_with_Shichimi.jpg/960px-Gyudon_with_Shichimi.jpg" },
    // 양식
    { name: "부드러운 버섯 크림 리조또", emoji: "🍄", category: "양식", reason: "표고버섯과 양송이버섯의 진한 향에 고소한 생크림과 파마산 치즈가 녹아든 힐링 식사!", tip: "트러플 오일을 살짝 둘러 풍미의 깊이를 더해보세요.", image: "https://thumb.wikimedia.org/wikipedia/commons/thumb/6/66/Mushroom_risotto_%28Unsplash%29.jpg/960px-Mushroom_risotto_%28Unsplash%29.jpg", fallbackImage: "https://thumb.wikimedia.org/wikipedia/commons/thumb/6/66/Mushroom_risotto_%28Unsplash%29.jpg/960px-Mushroom_risotto_%28Unsplash%29.jpg" },
    { name: "촉촉한 오므라이스", emoji: "🍳", category: "양식", reason: "몽글몽글 부드러운 반숙 계란 이불 아래 고소한 볶음밥과 달콤새콤 데미글라스 소스!", tip: "나이프로 계란 가운데를 갈라 부드럽게 펼쳐 드세요.", image: "https://thumb.wikimedia.org/wikipedia/commons/thumb/4/41/Omurice_by_katorisi.jpg/960px-Omurice_by_katorisi.jpg", fallbackImage: "https://thumb.wikimedia.org/wikipedia/commons/thumb/4/41/Omurice_by_katorisi.jpg/960px-Omurice_by_katorisi.jpg" },
    // 분식 & 기타
    { name: "고소한 참치마요 김밥", emoji: "🍙", category: "분식", reason: "꽉 찬 참치마요와 깻잎의 향긋함, 아삭한 단무지가 입안 가득 채우는 든든함!", tip: "따끈한 어묵 국물과 함께 드시면 목넘김이 최고입니다.", image: "https://thumb.wikimedia.org/wikipedia/commons/thumb/5/56/Gimbap_%28Korean_food%29.jpg/960px-Gimbap_%28Korean_food%29.jpg", fallbackImage: "https://thumb.wikimedia.org/wikipedia/commons/thumb/5/56/Gimbap_%28Korean_food%29.jpg/960px-Gimbap_%28Korean_food%29.jpg" },
    { name: "추억의 간장계란밥", emoji: "🍳", category: "분식", reason: "갓 지은 밥에 버터 한 조각, 반숙 계란프라이와 맛간장이 주는 포근하고 순수한 맛!", tip: "참기름과 통깨를 솔솔 뿌려 쓱쓱 비벼 김치 한 조각 얹어 드세요.", image: "images/egg-rice.jpg", fallbackImage: "https://thumb.wikimedia.org/wikipedia/commons/thumb/7/76/Tamago_kake_gohan_by_rhosoi_in_Kyoto_Station_building.jpg/960px-Tamago_kake_gohan_by_rhosoi_in_Kyoto_Station_building.jpg" }
  ],
  "mild-noodle": [
    // 한식
    { name: "바지락 칼국수", emoji: "🍲", category: "한식", reason: "싱싱한 바지락 조개가 듬뿍 들어가 맑고 개운한 천연 감칠맛의 쫄깃한 면발!", tip: "겉절이 김치를 면에 감싸서 한 입에 먹으면 감탄이 절로 나옵니다.", image: "images/kalguksu.jpg", fallbackImage: "https://thumb.wikimedia.org/wikipedia/commons/thumb/9/96/Bajirak-kalguksu.jpg/960px-Bajirak-kalguksu.jpg" },
    { name: "시원한 살얼음 평양냉면", emoji: "🧊", category: "한식", reason: "은은한 메밀 향의 순면과 슴슴하면서도 마실수록 깊은 육향의 차가운 육수!", tip: "식초와 겨자를 치지 말고 육수 본연의 슴슴한 감칠맛을 먼저 느껴보세요.", image: "https://thumb.wikimedia.org/wikipedia/commons/thumb/7/75/Zaru_soba_by_hirotomo_in_Tokyo.jpg/960px-Zaru_soba_by_hirotomo_in_Tokyo.jpg", fallbackImage: "https://thumb.wikimedia.org/wikipedia/commons/thumb/7/75/Zaru_soba_by_hirotomo_in_Tokyo.jpg/960px-Zaru_soba_by_hirotomo_in_Tokyo.jpg" },
    { name: "따뜻한 멸치 잔치국수", emoji: "🥢", category: "한식", reason: "진하게 우린 멸치 다시마 육수에 얇은 소면과 애호박, 계란 지단의 정겨운 맛!", tip: "양념간장을 취향껏 둘러 감칠맛을 살짝 더해보세요.", image: "images/janchi-guksu.jpg", fallbackImage: "https://upload.wikimedia.org/wikipedia/commons/4/42/Janchi-guksu.jpg" },
    { name: "구수한 들깨 수제비", emoji: "🥣", category: "한식", reason: "고소함의 끝판왕! 진한 들깨 가루 육수에 쫀득쫀득 얇게 뜬 찰진 수제비!", tip: "매콤한 겉절이 김치를 곁들여 고소함과 매콤함의 밸런스를 맞춰보세요.", image: "images/kalguksu.jpg", fallbackImage: "https://thumb.wikimedia.org/wikipedia/commons/thumb/9/96/Bajirak-kalguksu.jpg/960px-Bajirak-kalguksu.jpg" },
    // 중식
    { name: "담백한 백짬뽕", emoji: "🍜", category: "중식", reason: "빨간 양념 없이 조개와 해산물 본연의 깊고 뽀얀 육수로 시원하게 끓여낸 중화 백짬뽕!", tip: "아삭한 숙주와 해산물을 겨자장에 살짝 찍어드세요.", image: "https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c5/Nagasaki_champon_002.jpg/960px-Nagasaki_champon_002.jpg", fallbackImage: "https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c5/Nagasaki_champon_002.jpg/960px-Nagasaki_champon_002.jpg" },
    { name: "맑은 우육탕면", emoji: "🥢", category: "중식", reason: "부드럽게 삶은 소고기 아롱사태와 향긋한 청경채, 맑고 깊은 고기 육수가 어우러진 맛!", tip: "갓절임(쏸차이)을 곁들여 산뜻하게 즐겨보세요.", image: "https://thumb.wikimedia.org/wikipedia/commons/thumb/f/f8/Taiwanese_beef_noodle_soup_in_Taipei.jpg/960px-Taiwanese_beef_noodle_soup_in_Taipei.jpg", fallbackImage: "https://thumb.wikimedia.org/wikipedia/commons/thumb/f/f8/Taiwanese_beef_noodle_soup_in_Taipei.jpg/960px-Taiwanese_beef_noodle_soup_in_Taipei.jpg" },
    // 일식
    { name: "구수한 돈코츠 라멘", emoji: "🍜", category: "일식", reason: "돼지 사골을 푹 고아 뽀얗고 크리미한 육수에 불향 머금은 두툼한 차슈!", tip: "반숙 계란(아지타마고)을 국물에 푹 적셔 면과 함께 한입에 쏙!", image: "images/tonkotsu-ramen.jpg", fallbackImage: "https://thumb.wikimedia.org/wikipedia/commons/thumb/f/fd/Tonkotsu_Ramen_Special%2C_Hakata_Choten%2C_Paris_001.jpg/960px-Tonkotsu_Ramen_Special%2C_Hakata_Choten%2C_Paris_001.jpg" },
    { name: "시원한 판모밀 소바", emoji: "🧊", category: "일식", reason: "살얼음 띄운 쯔유 장국에 간 무와 파, 와사비를 풀고 시원하게 적셔먹는 힐링!", tip: "바삭한 새우 튀김이나 야채 튀김을 장국에 살짝 찍어 곁들이세요.", image: "https://thumb.wikimedia.org/wikipedia/commons/thumb/7/75/Zaru_soba_by_hirotomo_in_Tokyo.jpg/960px-Zaru_soba_by_hirotomo_in_Tokyo.jpg", fallbackImage: "https://thumb.wikimedia.org/wikipedia/commons/thumb/7/75/Zaru_soba_by_hirotomo_in_Tokyo.jpg/960px-Zaru_soba_by_hirotomo_in_Tokyo.jpg" },
    { name: "새우튀김 유부 우동", emoji: "🍥", category: "일식", reason: "통통하고 쫄깃탱글한 사누끼 면발에 따뜻하고 맑은 가쓰오부시 육수!", tip: "바삭한 튀김 부스러기(텐카스)와 시치미를 넣어 풍부한 식감 만들기!", image: "https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e0/Tempura_udon_by_jetalone_in_Tokyo.jpg/960px-Tempura_udon_by_jetalone_in_Tokyo.jpg", fallbackImage: "https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e0/Tempura_udon_by_jetalone_in_Tokyo.jpg/960px-Tempura_udon_by_jetalone_in_Tokyo.jpg" },
    // 양식
    { name: "클래식 까르보나라", emoji: "🍝", category: "양식", reason: "계란 노른자와 짭조름한 베이컨(판체타), 페코리노 치즈의 고소하고 진한 풍미!", tip: "통후추를 갓 갈아 올려 와인이나 상큼한 에이드와 곁들여보세요.", image: "images/carbonara.jpg", fallbackImage: "https://images.unsplash.com/photo-1612874742237-6526221588e3?auto=format&fit=crop&w=900&q=80" },
    { name: "바질 페스토 파스타", emoji: "🌿", category: "양식", reason: "향긋한 생바질과 잣, 엑스트라 버진 올리브유가 주는 산뜻하고 향긋한 이탈리아 감성!", tip: "방울토마토와 모짜렐라 치즈가 들어가 상큼한 맛을 돋워줍니다.", image: "images/carbonara.jpg", fallbackImage: "https://images.unsplash.com/photo-1551183053-bf91a1d81141?auto=format&fit=crop&w=900&q=80" },
    { name: "클럽 샌드위치 & 감자튀김", emoji: "🥪", category: "양식", reason: "구운 식빵 사이에 베이컨, 닭가슴살, 토마토, 치즈가 층층이 알차게 채워진 든든한 런치!", tip: "따뜻한 아메리카노 한 잔과 함께 가볍고 세련된 점심을 즐겨보세요.", image: "images/sandwich.jpg", fallbackImage: "https://images.unsplash.com/photo-1528735602780-2552fd46c7af?auto=format&fit=crop&w=900&q=80" },
    // 분식 & 기타
    { name: "베트남 양지 쌀국수", emoji: "🥢", category: "분식", reason: "팔각과 정향, 소뼈로 정성껏 우려낸 맑고 그윽한 국물에 부드러운 쌀면!", tip: "숙주와 레몬즙, 취향껏 고수와 해선장 소스를 곁들여 즐기세요.", image: "images/pho.jpg", fallbackImage: "https://thumb.wikimedia.org/wikipedia/commons/thumb/5/53/Pho-Beef-Noodles-2008.jpg/960px-Pho-Beef-Noodles-2008.jpg" },
    { name: "따끈한 어묵 우동", emoji: "🍢", category: "분식", reason: "탱글한 부산 어묵 꼬치와 맑고 진한 멸치 육수, 쫄깃한 면발의 포근한 한 그릇!", tip: "고춧가루 살짝 풀고 쑥갓을 얹어 향긋하게 드세요.", image: "https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e0/Tempura_udon_by_jetalone_in_Tokyo.jpg/960px-Tempura_udon_by_jetalone_in_Tokyo.jpg", fallbackImage: "https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e0/Tempura_udon_by_jetalone_in_Tokyo.jpg/960px-Tempura_udon_by_jetalone_in_Tokyo.jpg" }
  ]
};

// 요리 종류별 엄선 메뉴 가이드 (Gemini AI에 주입할 메뉴 후보군)
const CUISINE_MENUS: Record<string, Record<string, string[]>> = {
  korean: {
    "spicy-rice": ["제육볶음 덮밥", "돼지고기 김치찌개", "매콤 낙지덮밥", "얼큰 해물 순두부찌개", "묵은지 닭볶음탕", "소고기 육개장", "의정부식 부대찌개", "매운 소갈비찜"],
    "spicy-noodle": ["매콤 명태 회냉면", "새콤매콤 비빔국수", "얼큰 장칼국수", "열무 비빔국수"],
    "mild-rice": ["소고기 왕갈비탕", "맑은 나주곰탕 정식", "전주 돌솥 비빔밥", "촉촉한 보쌈 정식", "진한 뽀얀 설렁탕", "구수한 차돌 된장찌개", "황태 콩나물 국밥"],
    "mild-noodle": ["바지락 칼국수", "시원한 살얼음 평양냉면", "따뜻한 멸치 잔치국수", "구수한 들깨 수제비"]
  },
  chinese: {
    "spicy-rice": ["사천 마파두부 덮밥", "매콤 중화 잡채밥", "얼큰 중화 비빔밥"],
    "spicy-noodle": ["해물 짬뽕", "차돌박이 짬뽕", "얼큰 마라탕", "사천 탄탄멘"],
    "mild-rice": ["고슬고슬 삼선 볶음밥", "담백한 유산슬 덮밥", "게살 볶음밥"],
    "mild-noodle": ["담백한 백짬뽕", "맑은 우육탕면", "시원한 굴짬뽕"]
  },
  japanese: {
    "spicy-rice": ["매운 가츠동", "매콤 비프 카레라이스", "매운 부타동"],
    "spicy-noodle": ["카라이 돈코츠 라멘", "매콤 볶음우동(야끼우동)"],
    "mild-rice": ["생연어 사케동 덮밥", "수제 등심 돈카츠 정식", "달콤 짭조름 규동"],
    "mild-noodle": ["구수한 돈코츠 라멘", "시원한 판모밀 소바", "새우튀김 유부 우동"]
  },
  western: {
    "spicy-rice": ["매콤 토마토 해산물 리조또", "스파이시 치킨 도리아"],
    "spicy-noodle": ["매콤 투움바 파스타", "매운 아라비아따 파스타", "스파이시 치킨버거"],
    "mild-rice": ["부드러운 버섯 크림 리조또", "촉촉한 오므라이스"],
    "mild-noodle": ["클래식 까르보나라", "바질 페스토 파스타", "클럽 샌드위치 & 감자튀김"]
  },
  snack: {
    "spicy-rice": ["매콤 스팸 김치볶음밥", "매콤 떡볶이와 튀김 김밥 세트"],
    "spicy-noodle": ["새콤달콤 쫄면", "매콤 떡볶이와 라면사리", "얼큰 해장 라면"],
    "mild-rice": ["고소한 참치마요 김밥", "추억의 간장계란밥"],
    "mild-noodle": ["베트남 양지 쌀국수", "따끈한 어묵 우동"]
  }
};

// Gemini AI 클라이언트 인스턴스 헬퍼
let geminiClient: GoogleGenAI | null = null;
function getGemini(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
    return null;
  }
  if (!geminiClient) {
    geminiClient = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return geminiClient;
}

// 1. AI 실시간 무한 메뉴 추천 API (TOP 3 동시 추천 및 요리종류 필터링 & 제외 메뉴 지원)
app.post("/api/recommend", async (req, res) => {
  try {
    const { flavor = "spicy", staple = "rice", cuisine = "all", recentHistory = [], excludedMenus = [], situation = "" } = req.body;

    const flavorKr = flavor === "spicy" ? "매콤하고 칼칼한 맛" : "담백하고 맵지 않은 맛";
    const stapleKr = staple === "rice" ? "든든한 밥 요리" : "호로록 면 또는 빵 요리";
    const key = `${flavor}-${staple}`;

    const cuisineKrMap: Record<string, string> = {
      korean: "한식",
      chinese: "중식",
      japanese: "일식",
      western: "양식",
      snack: "분식 & 기타",
      all: "전체"
    };
    const cuisineKr = cuisineKrMap[cuisine] || "전체";

    // 중복 제거할 메뉴 목록 취합
    const allExcluded = Array.from(new Set([...recentHistory, ...excludedMenus])).filter(Boolean);

    // 선택된 요리 종류에 맞춘 엄선 메뉴 리스트 구성
    let allowedMenuNames: string[] = [];
    if (cuisine && cuisine !== "all" && CUISINE_MENUS[cuisine]) {
      allowedMenuNames = CUISINE_MENUS[cuisine][key] || [];
    }
    if (!allowedMenuNames || allowedMenuNames.length === 0) {
      allowedMenuNames = Object.values(CUISINE_MENUS).flatMap(c => c[key] || []);
    }

    // 이미 추천된 메뉴 제외 (단, 남은 후보가 3개 이상일 때)
    const filteredAllowed = allowedMenuNames.filter(m => !allExcluded.includes(m));
    const finalAllowed = filteredAllowed.length >= 3 ? filteredAllowed : allowedMenuNames;

    const ai = getGemini();

    if (ai) {
      const exclusionPrompt = allExcluded.length > 0 
        ? `[절대 제외할 이전 추천 메뉴]: ${allExcluded.join(", ")}\n위 메뉴들은 이미 사용자가 보았으므로 절대로 다시 추천하지 말고, 완전히 새로운 메뉴로 추천해야 합니다.`
        : "";

      const situationPrompt = situation 
        ? `사용자의 현재 상황/선호도 힌트: "${situation}". 이 분위기에 가장 적절한 메뉴를 우선해주세요.`
        : "";

      const cuisinePrompt = (cuisine && cuisine !== "all")
        ? `- 요리 종류: 반드시 '${cuisineKr}' 요리여야 함! (다른 국가나 종류의 음식은 절대 추천 금지, 오직 ${cuisineKr}에서만 3가지 엄선)`
        : `- 요리 종류: 전체 (한식, 중식, 일식, 양식, 분식 등 다양한 카테고리 중 골고루 엄선)`;

      const prompt = `사용자가 선택한 식사 조건:
- 맛: ${flavorKr}
- 주식: ${stapleKr}
${cuisinePrompt}
${situationPrompt}
${exclusionPrompt}

[추천 가능한 엄선 메뉴 풀 (메뉴명은 반드시 아래 리스트 중에서 선택하거나 정확히 일치시켜야 함)]:
${finalAllowed.join(", ")}

위의 엄선 메뉴 풀에서 대한민국 직장인/학생들의 일반적인 취향과 대중적 선호도 및 밸런스를 엄격히 반영하여, 아래 우선순위 순서대로 서로 다른 매력의 'TOP 3 추천 메뉴'를 선정해주세요:
- 1순위: 🥇 강력 추천 (가장 대중적이고 남녀노소 호불호 없이 1등으로 손꼽히는 대표 인기 메뉴)
- 2순위: 🥈 실속 만족 (가볍고 든든하며 직장인/학생들이 매일 찾아도 질리지 않는 실속 만점 메뉴)
- 3순위: 🥉 별미 선택 (색다른 맛과 특별한 풍미로 기분 전환을 시켜주는 인기 별미 메뉴)

각 메뉴별로 군침 도는 1~2줄의 추천 이유와 실용적인 꿀팁을 작성하여 JSON으로 응답해주세요.`;

      const candidateModels = [
        "gemini-3.8-flash",
        "gemini-flash-latest",
        "gemini-3.1-flash-lite"
      ];
      let responseText: string | null = null;

      for (const modelName of candidateModels) {
        try {
          const response = await ai.models.generateContent({
            model: modelName,
            contents: prompt,
            config: {
              systemInstruction: `당신은 대한민국 최고의 직장인/학생 맞춤 미식 큐레이터 '오늘 뭐 먹지?' AI입니다. 제공된 메뉴 풀 중에서 사용자가 선택한 맛, 주식, 요리 종류(${cuisineKr})를 100% 충족하며 이전에 본 메뉴와 완전히 다른 침샘 자극 TOP 3 메뉴를 엄선하여 정확한 JSON 객체 형식으로만 응답합니다.`,
              temperature: 0.75,
              responseMimeType: "application/json",
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  recommendations: {
                    type: Type.ARRAY,
                    description: "사용자가 비교하고 고를 수 있는 TOP 3 추천 메뉴",
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        rank: { type: Type.INTEGER, description: "추천 순위 1, 2, 3" },
                        badge: { type: Type.STRING, description: "순위 뱃지 ('🥇 강력 추천', '🥈 실속 만족', '🥉 별미 선택')" },
                        name: { type: Type.STRING, description: "정확한 한국어 메뉴명" },
                        emoji: { type: Type.STRING, description: "음식 어울리는 이모지" },
                        category: { type: Type.STRING, description: "요리 종류 ('한식', '중식', '일식', '양식', '분식' 중 하나)" },
                        reason: { type: Type.STRING, description: "군침 도는 1~2줄의 추천 이유" },
                        tip: { type: Type.STRING, description: "맛있게 먹는 꿀팁 및 어울리는 사이드" },
                        searchKeyword: { type: Type.STRING, description: "주변 지도 검색 키워드" }
                      },
                      required: ["rank", "badge", "name", "emoji", "category", "reason", "tip"]
                    }
                  }
                },
                required: ["recommendations"]
              }
            }
          });

          if (response.text) {
            responseText = response.text.trim();
            break;
          }
        } catch (modelErr: any) {
          const status = modelErr?.status || modelErr?.code || (String(modelErr?.message || "").includes("503") ? 503 : "err");
          console.info(`Model ${modelName} unavailable (${status}), trying fallback candidate.`);
        }
      }

      if (responseText) {
        const parsed = JSON.parse(responseText);
        const rawList = Array.isArray(parsed.recommendations) ? parsed.recommendations : [];

        if (rawList.length > 0) {
          const usedImages = new Set<string>();
          const formattedRecommendations = rawList.slice(0, 3).map((item: any, idx: number) => {
            const bestImage = getBestFoodImage(item.name, item.searchKeyword, item.category, staple, flavor, idx, usedImages);
            const badges = ["🥇 강력 추천", "🥈 실속 만족", "🥉 별미 선택"];
            return {
              rank: idx + 1,
              badge: item.badge || badges[idx] || `${idx + 1}위 추천`,
              name: item.name,
              emoji: item.emoji || "🍽️",
              category: item.category || (cuisine !== "all" ? cuisineKr : "오늘의 추천"),
              reason: item.reason,
              tip: item.tip,
              image: bestImage.image,
              fallbackImage: bestImage.fallbackImage,
              searchKeyword: item.searchKeyword || item.name
            };
          });

          return res.json({
            success: true,
            source: "gemini",
            recommendations: formattedRecommendations,
            menu: formattedRecommendations[0]
          });
        }
      }
    }

    // Fallback: 풍성한 사전 정의 메뉴 풀에서 cuisine 필터링 및 제외 메뉴 필터링
    const basePool = (FALLBACK_MENUS[key] || FALLBACK_MENUS["spicy-rice"]).slice();
    let pool = basePool;
    if (cuisine && cuisine !== "all") {
      const targetCategory = cuisineKrMap[cuisine];
      const matched = basePool.filter(item => item.category === targetCategory || (targetCategory && item.category.includes(targetCategory)));
      if (matched.length > 0) {
        pool = matched;
      }
    }

    // 이전에 추천된 메뉴 필터링 (남은 것이 3개 이상일 때)
    const unseenPool = pool.filter(item => !allExcluded.includes(item.name));
    if (unseenPool.length >= 3) {
      pool = unseenPool;
    }

    // 셔플
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }

    const badges = ["🥇 강력 추천", "🥈 실속 만족", "🥉 별미 선택"];
    const fallbackPicks = pool.slice(0, 3).map((item, idx) => ({
      ...item,
      rank: idx + 1,
      badge: badges[idx] || `${idx + 1}위 추천`,
      searchKeyword: item.name.replace(/덮밥|정식|세트|찌개|볶음탕/g, "").trim() || item.name
    }));

    return res.json({
      success: true,
      source: "curated-library",
      recommendations: fallbackPicks,
      menu: fallbackPicks[0]
    });
  } catch (error: any) {
    console.error("Gemini recommendation error:", error);
    const { flavor = "spicy", staple = "rice", cuisine = "all" } = req.body || {};
    const key = `${flavor}-${staple}`;
    const basePool = FALLBACK_MENUS[key] || FALLBACK_MENUS["spicy-rice"];
    let pool = basePool;
    const cuisineKrMap: Record<string, string> = {
      korean: "한식",
      chinese: "중식",
      japanese: "일식",
      western: "양식",
      snack: "분식",
      all: "전체"
    };
    if (cuisine && cuisine !== "all") {
      const targetCategory = cuisineKrMap[cuisine];
      const matched = basePool.filter(item => item.category === targetCategory || (targetCategory && item.category.includes(targetCategory)));
      if (matched.length > 0) {
        pool = matched;
      }
    }
    const badges = ["🥇 강력 추천", "🥈 실속 만족", "🥉 별미 선택"];
    const fallbackPicks = pool.slice(0, 3).map((item, idx) => ({
      ...item,
      rank: idx + 1,
      badge: badges[idx] || `${idx + 1}위 추천`,
      searchKeyword: item.name
    }));

    return res.json({
      success: true,
      source: "fallback",
      recommendations: fallbackPicks,
      menu: fallbackPicks[0]
    });
  }
});

// 2. 메뉴 키워드 검색 API
app.post("/api/search-menu", async (req, res) => {
  try {
    const { keyword = "", excludedMenus = [] } = req.body;
    const cleanKeyword = String(keyword).trim();
    const excludedList = Array.isArray(excludedMenus) ? excludedMenus.map(m => String(m).trim().toLowerCase()) : [];

    if (!cleanKeyword) {
      return res.status(400).json({ success: false, message: "검색할 메뉴 키워드를 입력해주세요." });
    }

    const badges = ["🥇 검색 일치 1위", "🥈 인기 연관 2위", "🥉 별미 추천 3위"];

    // 1) Gemini AI를 통해 검색 키워드에 최적화된 TOP 3 미식 큐레이션 생성 시도
    const ai = getGemini();
    if (ai) {
      const prompt = `사용자가 검색한 음식 키워드: "${cleanKeyword}"
${excludedList.length > 0 ? `제외해야 할 이전 추천 메뉴: ${excludedList.join(", ")}` : ""}
이 키워드와 직접 연관되거나 이 음식을 먹으려고 할 때 가장 만족스러운 대표 점심/저녁 식사 TOP 3 메뉴를 전문 미식 큐레이터의 시선으로 추천해주세요.
반드시 서로 다른 3개의 실존 인기 메뉴로 구성된 JSON 배열(recommendations)을 생성해야 합니다:
- 1위: 사용자가 입력한 키워드에 가장 직관적으로 부합하는 대표 메뉴
- 2위: 이 키워드와 찰떡궁합이거나 같은 계통의 인기 연관 메뉴
- 3위: 색다른 별미나 조합으로 기분 전환하기 좋은 추천 메뉴`;

      const candidateModels = ["gemini-3.8-flash", "gemini-flash-latest", "gemini-3.1-flash-lite"];
      for (const model of candidateModels) {
        try {
          const resp = await ai.models.generateContent({
            model: model,
            contents: prompt,
            config: {
              systemInstruction: "당신은 한국인이 가장 사랑하는 맛집 및 미식 가이드입니다. 검색된 키워드에 최적화된 군침 도는 TOP 3 메뉴 정보(메뉴명, 이모지, 요리종류, 추천이유, 맛있게먹는팁, 검색키워드)를 JSON으로만 응답합니다.",
              temperature: 0.6,
              responseMimeType: "application/json",
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  recommendations: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        name: { type: Type.STRING, description: "정확하고 매력적인 한글 메뉴명" },
                        emoji: { type: Type.STRING, description: "어울리는 이모지" },
                        category: { type: Type.STRING, description: "요리종류 ('한식', '중식', '일식', '양식', '분식' 중 하나)" },
                        reason: { type: Type.STRING, description: "군침 도는 1~2줄의 추천 이유" },
                        tip: { type: Type.STRING, description: "맛있게 먹는 꿀팁" },
                        searchKeyword: { type: Type.STRING, description: "지도 주변 식당 검색어" }
                      },
                      required: ["name", "emoji", "category", "reason", "tip", "searchKeyword"]
                    }
                  }
                },
                required: ["recommendations"]
              }
            }
          });

          if (resp.text) {
            const data = JSON.parse(resp.text.trim());
            if (Array.isArray(data.recommendations) && data.recommendations.length > 0) {
              const usedImages = new Set<string>();
              const recs = data.recommendations.slice(0, 3).map((item: any, idx: number) => {
                const bestImage = getBestFoodImage(item.name || cleanKeyword, item.searchKeyword, item.category, undefined, undefined, idx, usedImages);
                return {
                  name: item.name || cleanKeyword,
                  emoji: item.emoji || "🍽️",
                  category: item.category || "인기 메뉴",
                  reason: item.reason || `지금 가장 인기 있는 맛있는 ${item.name || cleanKeyword} 한 끼를 추천합니다!`,
                  tip: item.tip || "따뜻할 때 신선한 반찬과 함께 드세요.",
                  image: bestImage.image,
                  fallbackImage: bestImage.fallbackImage,
                  badge: badges[idx] || `${idx + 1}위 추천`,
                  rank: idx + 1,
                  searchKeyword: item.searchKeyword || item.name || cleanKeyword
                };
              });

              return res.json({
                success: true,
                source: "gemini-search",
                recommendations: recs,
                menu: recs[0]
              });
            }
          }
        } catch (err: any) {
          const status = err?.status || err?.code || (String(err?.message || "").includes("503") ? 503 : "err");
          console.info(`Search model ${model} unavailable (${status}), trying fallback candidate.`);
        }
      }
    }

    // 2) 로컬 엄선 메뉴 풀에서 3개 구성
    const allLocalMenus = Object.values(FALLBACK_MENUS).flat();
    const lowerKeyword = cleanKeyword.toLowerCase();

    // 키워드 직접 포함 메뉴들
    const matched = allLocalMenus.filter(m => 
      !excludedList.includes(m.name.toLowerCase()) && (
        m.name.toLowerCase().includes(lowerKeyword) || 
        lowerKeyword.includes(m.name.toLowerCase()) ||
        m.category.toLowerCase().includes(lowerKeyword)
      )
    );

    // 연관 메뉴 풀 보충 (같은 카테고리 또는 대중 인기 메뉴)
    const matchCategory = matched[0]?.category || "한식";
    const sameCatMenus = allLocalMenus.filter(m => 
      m.category === matchCategory && 
      !excludedList.includes(m.name.toLowerCase()) &&
      !matched.some(x => x.name === m.name)
    );
    const otherMenus = allLocalMenus.filter(m => 
      !excludedList.includes(m.name.toLowerCase()) &&
      !matched.some(x => x.name === m.name) &&
      !sameCatMenus.some(x => x.name === m.name)
    );

    const combinedPool = [...matched, ...sameCatMenus, ...otherMenus];
    const usedImagesLocal = new Set<string>();
    const top3 = combinedPool.slice(0, 3).map((item, idx) => {
      const bestImage = getBestFoodImage(item.name, item.name, item.category, undefined, undefined, idx, usedImagesLocal);
      return {
        ...item,
        image: bestImage.image,
        fallbackImage: bestImage.fallbackImage,
        badge: badges[idx] || `${idx + 1}위 추천`,
        rank: idx + 1,
        searchKeyword: item.name.replace(/덮밥|정식|세트|찌개|볶음탕/g, "").trim() || item.name
      };
    });

    if (top3.length === 0) {
      const bestImage = getBestFoodImage(cleanKeyword, cleanKeyword, "인기 메뉴", undefined, undefined, 0);
      top3.push({
        name: cleanKeyword,
        emoji: "🍽️",
        category: "인기 메뉴",
        reason: `사용자님께서 찾으신 매력적인 메뉴 '${cleanKeyword}'입니다! 든든하고 만족스러운 한 끼를 즐겨보세요.`,
        tip: "주변 인기 식당에서 최상의 퀄리티로 즐겨보세요.",
        image: bestImage.image,
        fallbackImage: bestImage.fallbackImage,
        badge: "🥇 검색 일치 1위",
        rank: 1,
        searchKeyword: cleanKeyword
      });
    }

    return res.json({
      success: true,
      source: "local-search",
      recommendations: top3,
      menu: top3[0]
    });
  } catch (error: any) {
    console.error("Search menu API error:", error);
    return res.status(500).json({ success: false, message: "메뉴 검색 중 오류가 발생했습니다." });
  }
});

// 2. 서버 상태 및 Gemini 연결 상태 체크
app.get("/api/health", (req, res) => {
  const hasGeminiKey = !!process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== "MY_GEMINI_API_KEY";
  res.json({
    status: "ok",
    aiEnabled: hasGeminiKey,
    engine: "Gemini 3.8 Flash & Google GenAI SDK",
    timestamp: new Date().toISOString()
  });
});

async function startServer() {
  // Always disable caching for HTML files and SPA routes so client always gets the latest deployed code
  app.use((req, res, next) => {
    if (req.path === "/" || req.path.endsWith(".html") || !path.extname(req.path)) {
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");
      res.setHeader("Surrogate-Control", "no-store");
    }
    next();
  });

  const isDev = process.env.NODE_ENV === "development" && !process.argv.some(a => a.includes("dist"));
  if (isDev) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath, {
      maxAge: "1h",
      setHeaders: (res, filePath) => {
        if (filePath.endsWith(".html")) {
          res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
          res.setHeader("Pragma", "no-cache");
          res.setHeader("Expires", "0");
        }
      }
    }));
    app.get("*", (req, res) => {
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
