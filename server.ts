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
const FOOD_IMAGE_MAP: Record<string, string> = {
  // 매콤 + 밥
  "제육볶음": "images/jeyuk.jpg",
  "제육볶음 덮밥": "images/jeyuk.jpg",
  "김치찌개": "images/kimchi-soup.jpg",
  "돼지고기 김치찌개": "images/kimchi-soup.jpg",
  "닭볶음탕": "https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e5/Dak-bokkeum-tang_2.jpg/960px-Dak-bokkeum-tang_2.jpg",
  "낙지덮밥": "https://thumb.wikimedia.org/wikipedia/commons/thumb/6/60/Nakji-bokkeum.jpg/960px-Nakji-bokkeum.jpg",
  "오징어덮밥": "https://thumb.wikimedia.org/wikipedia/commons/thumb/6/60/Nakji-bokkeum.jpg/960px-Nakji-bokkeum.jpg",
  "순두부찌개": "https://thumb.wikimedia.org/wikipedia/commons/thumb/4/4c/Sundubu-jjigae_3.jpg/960px-Sundubu-jjigae_3.jpg",
  "매운 갈비찜": "https://thumb.wikimedia.org/wikipedia/commons/thumb/1/1d/Galbi-jjim.jpg/960px-Galbi-jjim.jpg",
  "마파두부 덮밥": "https://thumb.wikimedia.org/wikipedia/commons/thumb/5/58/Mapo_Doufu.jpg/960px-Mapo_Doufu.jpg",
  "육개장": "https://thumb.wikimedia.org/wikipedia/commons/thumb/4/4e/Yukgaejang_2.jpg/960px-Yukgaejang_2.jpg",
  "부대찌개": "https://thumb.wikimedia.org/wikipedia/commons/thumb/d/d4/Budae-jjigae.jpg/960px-Budae-jjigae.jpg",
  "마라탕": "https://thumb.wikimedia.org/wikipedia/commons/thumb/9/91/Malatang.jpg/960px-Malatang.jpg",
  "떡볶이": "https://thumb.wikimedia.org/wikipedia/commons/thumb/5/56/Korean.snacks-Tteokbokki-08.jpg/960px-Korean.snacks-Tteokbokki-08.jpg",

  // 매콤 + 면/빵
  "해물 짬뽕": "images/jjambbong.jpg",
  "짬뽕": "images/jjambbong.jpg",
  "차돌 짬뽕": "images/jjambbong.jpg",
  "비빔냉면": "images/bibim-naeng.jpg",
  "마라탕면": "https://thumb.wikimedia.org/wikipedia/commons/thumb/9/91/Malatang.jpg/960px-Malatang.jpg",
  "탄탄멘": "https://thumb.wikimedia.org/wikipedia/commons/thumb/d/df/Dandan_mian.jpg/960px-Dandan_mian.jpg",
  "비빔국수": "https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a2/Bibim-guksu.jpg/960px-Bibim-guksu.jpg",
  "쫄면": "https://thumb.wikimedia.org/wikipedia/commons/thumb/5/56/Korean.snacks-Tteokbokki-08.jpg/960px-Korean.snacks-Tteokbokki-08.jpg",
  "매콤 투움바 파스타": "https://images.unsplash.com/photo-1621996346565-e3d5d6281093?auto=format&fit=crop&w=900&q=80",
  "아라비아따 파스타": "https://images.unsplash.com/photo-1551183053-bf91a1d81141?auto=format&fit=crop&w=900&q=80",
  "스파이시 치킨버거": "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=900&q=80",

  // 담백 + 밥
  "생연어 덮밥": "images/sake-don.jpg",
  "사케동": "images/sake-don.jpg",
  "갈비탕": "images/galbi-soup.jpg",
  "소고기 갈비탕": "images/galbi-soup.jpg",
  "한우 곰탕": "https://thumb.wikimedia.org/wikipedia/commons/thumb/a/ab/Gomguk_2.jpg/960px-Gomguk_2.jpg",
  "설렁탕": "https://thumb.wikimedia.org/wikipedia/commons/thumb/8/87/Seolleongtang.jpg/960px-Seolleongtang.jpg",
  "전주 비빔밥": "https://thumb.wikimedia.org/wikipedia/commons/thumb/4/44/Dolsot-bibimbap.jpg/960px-Dolsot-bibimbap.jpg",
  "돌솥 비빔밥": "https://thumb.wikimedia.org/wikipedia/commons/thumb/4/44/Dolsot-bibimbap.jpg/960px-Dolsot-bibimbap.jpg",
  "돈카츠 정식": "https://thumb.wikimedia.org/wikipedia/commons/thumb/8/8b/Tonkatsu_by_cuckoomis.jpg/960px-Tonkatsu_by_cuckoomis.jpg",
  "가츠동": "https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c5/Katsudon_001.jpg/960px-Katsudon_001.jpg",
  "규동": "https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a8/Salmon_don_of_Nakau.jpg/960px-Salmon_don_of_Nakau.jpg",
  "소고기 덮밥": "https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a8/Salmon_don_of_Nakau.jpg/960px-Salmon_don_of_Nakau.jpg",
  "보쌈 정식": "https://thumb.wikimedia.org/wikipedia/commons/thumb/4/4a/Bossam.jpg/960px-Bossam.jpg",
  "황태포 콩나물국밥": "https://thumb.wikimedia.org/wikipedia/commons/thumb/f/f6/Kongnamul-gukbap.jpg/960px-Kongnamul-gukbap.jpg",
  "된장찌개 정식": "https://thumb.wikimedia.org/wikipedia/commons/thumb/3/3a/Doenjang-jjigae_3.jpg/960px-Doenjang-jjigae_3.jpg",
  "순대국": "https://thumb.wikimedia.org/wikipedia/commons/thumb/2/29/Sundae-guk.jpg/960px-Sundae-guk.jpg",

  // 담백 + 면/빵
  "바지락 칼국수": "images/kalguksu.jpg",
  "칼국수": "images/kalguksu.jpg",
  "들깨 칼국수": "images/kalguksu.jpg",
  "진한 돈코츠 라멘": "images/ramen.jpg",
  "돈코츠 라멘": "images/ramen.jpg",
  "미소 라멘": "images/ramen.jpg",
  "쇼유 라멘": "images/ramen.jpg",
  "베트남 소고기 쌀국수": "https://thumb.wikimedia.org/wikipedia/commons/thumb/5/53/Pho-Beef-Noodles-2008.jpg/960px-Pho-Beef-Noodles-2008.jpg",
  "소고기 쌀국수": "https://thumb.wikimedia.org/wikipedia/commons/thumb/5/53/Pho-Beef-Noodles-2008.jpg/960px-Pho-Beef-Noodles-2008.jpg",
  "분짜": "https://thumb.wikimedia.org/wikipedia/commons/thumb/5/53/Pho-Beef-Noodles-2008.jpg/960px-Pho-Beef-Noodles-2008.jpg",
  "클래식 까르보나라": "https://images.unsplash.com/photo-1612874742237-6526221588e3?auto=format&fit=crop&w=900&q=80",
  "알리오 올리오 파스타": "https://images.unsplash.com/photo-1551183053-bf91a1d81141?auto=format&fit=crop&w=900&q=80",
  "봉골레 파스타": "https://images.unsplash.com/photo-1551183053-bf91a1d81141?auto=format&fit=crop&w=900&q=80",
  "평양 물냉면": "https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b3/Naengmyeon.jpg/960px-Naengmyeon.jpg",
  "물냉면": "https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b3/Naengmyeon.jpg/960px-Naengmyeon.jpg",
  "시원한 모밀소바": "https://thumb.wikimedia.org/wikipedia/commons/thumb/7/75/Zaru_soba_by_hirotomo_in_Tokyo.jpg/960px-Zaru_soba_by_hirotomo_in_Tokyo.jpg",
  "새우 튀김우동": "https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e0/Tempura_udon_by_jetalone_in_Tokyo.jpg/960px-Tempura_udon_by_jetalone_in_Tokyo.jpg",
  "클럽 샌드위치": "https://images.unsplash.com/photo-1528735602780-2552fd46c7af?auto=format&fit=crop&w=900&q=80",
  "수제 베이컨 치즈버거": "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=900&q=80"
};

// 키워드 기반 이미지 매칭 헬퍼
function getBestFoodImage(menuName: string, category: string, staple: string, flavor: string): string {
  if (FOOD_IMAGE_MAP[menuName]) {
    return FOOD_IMAGE_MAP[menuName];
  }
  for (const [key, url] of Object.entries(FOOD_IMAGE_MAP)) {
    if (menuName.includes(key) || key.includes(menuName)) {
      return url;
    }
  }
  // 기본 카테고리별 매핑
  if (staple === "rice") {
    return flavor === "spicy" ? "images/jeyuk.jpg" : "images/sake-don.jpg";
  } else {
    return flavor === "spicy" ? "images/jjambbong.jpg" : "images/kalguksu.jpg";
  }
}

// 풍성한 오프라인/폴백 메뉴 풀 (각 조합별 20종 이상 구축)
const FALLBACK_MENUS: Record<string, Array<{ name: string; emoji: string; category: string; reason: string; tip: string; image: string }>> = {
  "spicy-rice": [
    { name: "제육볶음 덮밥", emoji: "🥘", category: "한식", reason: "매콤달콤한 특제 양념에 불향 가득한 돼지고기와 따끈한 쌀밥의 불패 조합!", tip: "계란프라이 반숙을 얹어 슥슥 비벼 드시면 더욱 맛있습니다.", image: "images/jeyuk.jpg" },
    { name: "돼지고기 김치찌개", emoji: "🍲", category: "한식", reason: "잘 익은 묵은지와 두툼한 생돼지고기가 푹 끓여져 칼칼하고 깊은 국물 맛!", tip: "라면사리나 계란말이를 곁들이면 든든함이 2배가 됩니다.", image: "images/kimchi-soup.jpg" },
    { name: "매콤 낙지덮밥", emoji: "🐙", category: "한식", reason: "탱글탱글 쫄깃한 통낙지와 매콤한 불맛 양념이 지친 활력을 번쩍 깨워줍니다.", tip: "데친 콩나물과 참기름을 듬뿍 넣고 슥슥 비벼 드세요.", image: "https://thumb.wikimedia.org/wikipedia/commons/thumb/6/60/Nakji-bokkeum.jpg/960px-Nakji-bokkeum.jpg" },
    { name: "얼큰 해물 순두부찌개", emoji: "🌶️", category: "한식", reason: "몽글몽글 부드러운 순두부와 시원한 해물이 칼칼한 고추기름 국물에 퐁당!", tip: "뚝배기가 끓을 때 생계란 하나 톡 깨 넣어 노른자를 풀어주세요.", image: "https://thumb.wikimedia.org/wikipedia/commons/thumb/4/4c/Sundubu-jjigae_3.jpg/960px-Sundubu-jjigae_3.jpg" },
    { name: "마파두부 덮밥", emoji: "🍛", category: "중식", reason: "알싸한 사천 마라향과 부드러운 연두부, 다진 고기의 감칠맛이 밥알에 쏙쏙!", tip: "산초가루를 살짝 뿌리면 정통 중화풍 풍미가 살아납니다.", image: "https://thumb.wikimedia.org/wikipedia/commons/thumb/5/58/Mapo_Doufu.jpg/960px-Mapo_Doufu.jpg" },
    { name: "묵은지 닭볶음탕", emoji: "🍗", category: "한식", reason: "포슬포슬 감자와 쫄깃한 닭다리살, 깊은 양념 국물이 밥도둑 그 자체!", tip: "남은 진국 양념에 밥과 김가루를 넣고 볶음밥으로 마무리하세요.", image: "https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e5/Dak-bokkeum-tang_2.jpg/960px-Dak-bokkeum-tang_2.jpg" },
    { name: "소고기 육개장", emoji: "🥩", category: "한식", reason: "잘게 찢은 양지머리와 대파, 토란대가 푹 우러난 칼칼하고 진한 보양 국물!", tip: "밥을 반 공기 먼저 말아 국물과 건더기를 먼저 즐겨보세요.", image: "https://thumb.wikimedia.org/wikipedia/commons/thumb/4/4e/Yukgaejang_2.jpg/960px-Yukgaejang_2.jpg" },
    { name: "의정부식 부대찌개", emoji: "🥘", category: "한식", reason: "풍성한 햄과 소시지, 베이크드 빈스와 칼칼한 치즈 김치 육수의 진한 조화!", tip: "치즈 한 장 살짝 올려 라면사리와 함께 호로록 즐기세요.", image: "https://thumb.wikimedia.org/wikipedia/commons/thumb/d/d4/Budae-jjigae.jpg/960px-Budae-jjigae.jpg" },
    { name: "매운 소갈비찜", emoji: "🍖", category: "한식", reason: "부드럽게 뼈에서 발라지는 두툼한 갈비와 입안이 얼얼하게 맛있는 매운맛!", tip: "삶은 당면 사리를 국물에 적셔 밥 위에 얹어 드세요.", image: "https://thumb.wikimedia.org/wikipedia/commons/thumb/1/1d/Galbi-jjim.jpg/960px-Galbi-jjim.jpg" },
    { name: "오징어 삼겹살 덮밥", emoji: "🦑", category: "한식", reason: "쫄깃한 오징어와 고소한 삼겹살이 고추장 불향으로 어우러져 침샘을 자극!", tip: "상추쌈을 곁들이거나 마요네즈를 살짝 찍으면 이색적입니다.", image: "https://thumb.wikimedia.org/wikipedia/commons/thumb/6/60/Nakji-bokkeum.jpg/960px-Nakji-bokkeum.jpg" }
  ],
  "spicy-noodle": [
    { name: "해물 짬뽕", emoji: "🍜", category: "중식", reason: "오징어와 홍합, 신선한 야채에 센 불향을 입혀 칼칼하고 시원한 명품 국물!", tip: "바삭한 찹쌀 탕수육을 곁들이면 최고의 단짝 점심 완성!", image: "images/jjambbong.jpg" },
    { name: "차돌박이 짬뽕", emoji: "🥩", category: "중식", reason: "고소한 차돌박이의 육즙이 진한 불맛 짬뽕 국물에 녹아들어 극강의 묵직함!", tip: "면을 다 드신 후 밥 한 숟가락 말아 드시면 완벽합니다.", image: "images/jjambbong.jpg" },
    { name: "매콤 명태 회냉면", emoji: "🥢", category: "한식", reason: "쫄깃한 함흥 면발 위에 숙성된 새콤달콤 매콤한 명태회가 듬뿍!", tip: "따뜻한 사골 온육수로 속을 먼저 달랜 뒤 겨자를 살짝 곁들이세요.", image: "images/bibim-naeng.jpg" },
    { name: "사천 탄탄멘", emoji: "🥜", category: "일식/중식", reason: "진한 참깨 페이스트의 고소함과 고추기름, 산초의 얼얼함이 어우러진 별미 면요리!", tip: "면을 건져먹은 뒤 온천계란을 풀어 진한 풍미를 만끽하세요.", image: "https://thumb.wikimedia.org/wikipedia/commons/thumb/d/df/Dandan_mian.jpg/960px-Dandan_mian.jpg" },
    { name: "얼큰 마라탕", emoji: "🍲", category: "아시안", reason: "내가 좋아하는 푸주, 옥수수면, 청경채를 칼칼하고 알싸한 마라육수에 듬뿍!", tip: "땅콩 소스(마장)를 듬뿍 찍으면 매운맛과 고소함이 조화롭습니다.", image: "https://thumb.wikimedia.org/wikipedia/commons/thumb/9/91/Malatang.jpg/960px-Malatang.jpg" },
    { name: "매콤 투움바 파스타", emoji: "🍝", category: "양식", reason: "진하고 꾸덕한 크림소스에 매콤한 고춧가루와 통통한 새우가 환상의 조합!", tip: "마늘빵으로 그릇 바닥의 남은 소스까지 깔끔하게 닦아 드세요.", image: "https://images.unsplash.com/photo-1621996346565-e3d5d6281093?auto=format&fit=crop&w=900&q=80" },
    { name: "새콤달콤 쫄면", emoji: "🥗", category: "분식", reason: "아삭한 콩나물, 양배추와 쫄깃탱탱 면발, 새콤달콤 매운 특제 초장의 만남!", tip: "바삭한 군만두를 쫄면에 싸 먹는 '비빔만두' 조합 추천!", image: "https://thumb.wikimedia.org/wikipedia/commons/thumb/5/56/Korean.snacks-Tteokbokki-08.jpg/960px-Korean.snacks-Tteokbokki-08.jpg" },
    { name: "스파이시 치킨버거", emoji: "🍔", category: "패스트푸드", reason: "두툼하고 바삭한 매콤 닭다리살 패티와 아삭한 양상추의 꽉 찬 한 입!", tip: "케이준 감자튀김과 시원한 제로콜라 조합으로 완벽한 런치!", image: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=900&q=80" },
    { name: "매운 아라비아따 파스타", emoji: "🍝", category: "양식", reason: "신선한 토마토 소스에 페페론치노와 마늘의 칼칼한 매운맛이 산뜻한 감칠맛!", tip: "파르미지아노 레지아노 치즈를 듬뿍 뿌려 풍미를 끌어올리세요.", image: "https://images.unsplash.com/photo-1551183053-bf91a1d81141?auto=format&fit=crop&w=900&q=80" }
  ],
  "mild-rice": [
    { name: "생연어 사케동", emoji: "🍣", category: "일식", reason: "도톰하고 기름진 고소한 생연어와 감칠맛 나는 초밥용 밥, 생와사비의 깔끔함!", tip: "비비지 말고 연어 위에 무순과 와사비를 얹어 밥과 함께 떠드세요.", image: "images/sake-don.jpg" },
    { name: "소고기 갈비탕", emoji: "🥩", category: "한식", reason: "맑고 투명하지만 깊은 소고기 육수에 푹 고아 부드러운 왕갈비가 푸짐!", tip: "잘 익은 깍두기 국물을 살짝 넣거나 고기는 겨자소스에 찍어드세요.", image: "images/galbi-soup.jpg" },
    { name: "나주식 맑은 곰탕", emoji: "🥣", category: "한식", reason: "기름기를 걷어내 담백하고 깔끔한 양지 국물에 부드러운 고기가 가득!", tip: "후춧가루 살짝 치고 송송 썬 대파를 듬뿍 넣어 개운하게 즐기세요.", image: "https://thumb.wikimedia.org/wikipedia/commons/thumb/a/ab/Gomguk_2.jpg/960px-Gomguk_2.jpg" },
    { name: "수제 등심 돈카츠 정식", emoji: "🍱", category: "일식", reason: "바삭바삭 살아있는 튀김옷 속에 두툼하고 육즙 가득한 한돈 등심!", tip: "첫 점은 말돈 소금과 생와사비만 찍어 본연의 육향을 음미해보세요.", image: "https://thumb.wikimedia.org/wikipedia/commons/thumb/8/8b/Tonkatsu_by_cuckoomis.jpg/960px-Tonkatsu_by_cuckoomis.jpg" },
    { name: "전주 돌솥 비빔밥", emoji: "🍳", category: "한식", reason: "지글지글 누룽지가 눌어붙는 소리와 오색 나물, 고소한 참기름의 건강한 조화!", tip: "돌솥 바닥의 바삭한 누룽지는 숟가락으로 긁어 아껴 드세요.", image: "https://thumb.wikimedia.org/wikipedia/commons/thumb/4/44/Dolsot-bibimbap.jpg/960px-Dolsot-bibimbap.jpg" },
    { name: "달콤 짭조름 규동", emoji: "🍲", category: "일식", reason: "얇게 저민 부드러운 소고기와 양파가 달달한 쯔유 소스에 졸여져 밥도둑!", tip: "초생강(베니쇼가)과 시치미 가루를 톡톡 곁들이면 끝까지 산뜻합니다.", image: "https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a8/Salmon_don_of_Nakau.jpg/960px-Salmon_don_of_Nakau.jpg" },
    { name: "촉촉한 보쌈 정식", emoji: "🥬", category: "한식", reason: "야들야들하게 삶아낸 돼지 수육과 아삭하고 달큼한 무김치의 정갈한 한상!", tip: "신선한 배추속에 고기와 쌈장, 새우젓을 올려 한 입 가득 쌈 싸보세요.", image: "https://thumb.wikimedia.org/wikipedia/commons/thumb/4/4a/Bossam.jpg/960px-Bossam.jpg" },
    { name: "구수한 차돌 된장찌개", emoji: "🥘", category: "한식", reason: "고소한 차돌박이 기름과 재래식 된장, 호박과 두부가 어우러진 영혼의 찌개!", tip: "밥 위에 두부와 국물을 듬뿍 얹어 으깨 비벼 드시면 최고입니다.", image: "https://thumb.wikimedia.org/wikipedia/commons/thumb/3/3a/Doenjang-jjigae_3.jpg/960px-Doenjang-jjigae_3.jpg" },
    { name: "황태 콩나물 국밥", emoji: "🍚", category: "한식", reason: "시원한 황태포 육수와 아삭한 콩나물이 전날의 피로와 속을 편안하게 정리!", tip: "수란에 국물 서너 숟가락과 김가루를 넣어 먼저 애피타이저로 호로록!", image: "https://thumb.wikimedia.org/wikipedia/commons/thumb/f/f6/Kongnamul-gukbap.jpg/960px-Kongnamul-gukbap.jpg" },
    { name: "진한 뽀얀 설렁탕", emoji: "🍲", category: "한식", reason: "사골을 24시간 우려낸 깊고 구수한 국물에 소면과 얇은 소고기 수육!", tip: "소금 간을 심심하게 맞추고 달큰한 깍두기 국물을 부어 먹어도 별미!", image: "https://thumb.wikimedia.org/wikipedia/commons/thumb/8/87/Seolleongtang.jpg/960px-Seolleongtang.jpg" }
  ],
  "mild-noodle": [
    { name: "바지락 칼국수", emoji: "🍲", category: "한식", reason: "싱싱한 바지락 조개가 듬뿍 들어가 맑고 개운한 천연 감칠맛의 쫄깃한 면발!", tip: "겉절이 김치를 면에 감싸서 한 입에 먹으면 감탄이 절로 나옵니다.", image: "images/kalguksu.jpg" },
    { name: "돈코츠 라멘", emoji: "🍜", category: "일식", reason: "돼지 사골을 푹 고아 뽀얗고 크리미한 육수에 불향 머금은 두툼한 차슈!", tip: "반숙 계란(아지타마고)을 국물에 푹 적셔 면과 함께 한입에 쏙!", image: "images/ramen.jpg" },
    { name: "베트남 양지 쌀국수", emoji: "🥢", category: "아시안", reason: "팔각과 정향, 소뼈로 정성껏 우려낸 맑고 그윽한 국물에 부드러운 쌀면!", tip: "숙주와 레몬즙, 취향껏 고수와 해선장 소스를 곁들여 즐기세요.", image: "https://thumb.wikimedia.org/wikipedia/commons/thumb/5/53/Pho-Beef-Noodles-2008.jpg/960px-Pho-Beef-Noodles-2008.jpg" },
    { name: "클래식 까르보나라", emoji: "🍝", category: "양식", reason: "계란 노른자와 짭조름한 베이컨(판체타), 페코리노 치즈의 고소하고 진한 풍미!", tip: "통후추를 갓 갈아 올려 와인이나 상큼한 에이드와 곁들여보세요.", image: "https://images.unsplash.com/photo-1612874742237-6526221588e3?auto=format&fit=crop&w=900&q=80" },
    { name: "시원한 살얼음 평양냉면", emoji: "🧊", category: "한식", reason: "은은한 메밀 향의 순면과 슴슴하면서도 마실수록 깊은 육향의 차가운 육수!", tip: "식초와 겨자를 치지 말고 육수 본연의 슴슴한 감칠맛을 먼저 느껴보세요.", image: "https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b3/Naengmyeon.jpg/960px-Naengmyeon.jpg" },
    { name: "시원한 판모밀 소바", emoji: "🧊", category: "일식", reason: "살얼음 띄운 쯔유 장국에 간 무와 파, 와사비를 풀고 시원하게 적셔먹는 힐링!", tip: "바삭한 새우 튀김이나 야채 튀김을 장국에 살짝 찍어 곁들이세요.", image: "https://thumb.wikimedia.org/wikipedia/commons/thumb/7/75/Zaru_soba_by_hirotomo_in_Tokyo.jpg/960px-Zaru_soba_by_hirotomo_in_Tokyo.jpg" },
    { name: "새우튀김 유부 우동", emoji: "🍥", category: "일식", reason: "통통하고 쫄깃탱글한 사누끼 면발에 따뜻하고 맑은 가쓰오부시 육수!", tip: "바삭한 튀김 부스러기(텐카스)와 시치미를 넣어 풍부한 식감 만들기!", image: "https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e0/Tempura_udon_by_jetalone_in_Tokyo.jpg/960px-Tempura_udon_by_jetalone_in_Tokyo.jpg" },
    { name: "바질 페스토 파스타", emoji: "🌿", category: "양식", reason: "향긋한 생바질과 잣, 엑스트라 버진 올리브유가 주는 산뜻하고 향긋한 이탈리아 감성!", tip: "방울토마토와 모짜렐라 치즈가 들어가 상큼한 맛을 돋워줍니다.", image: "https://images.unsplash.com/photo-1551183053-bf91a1d81141?auto=format&fit=crop&w=900&q=80" },
    { name: "클럽 샌드위치 & 감자튀김", emoji: "🥪", category: "브런치", reason: "구운 식빵 사이에 베이컨, 닭가슴살, 토마토, 치즈가 층층이 알차게 채워진 든든한 런치!", tip: "따뜻한 아메리카노 한 잔과 함께 가볍고 세련된 점심을 즐겨보세요.", image: "https://images.unsplash.com/photo-1528735602780-2552fd46c7af?auto=format&fit=crop&w=900&q=80" },
    { name: "구수한 들깨 수제비", emoji: "🥣", category: "한식", reason: "고소함의 끝판왕! 진한 들깨 가루 육수에 쫀득쫀득 얇게 뜬 찰진 수제비!", tip: "매콤한 겉절이 김치를 곁들여 고소함과 매콤함의 밸런스를 맞춰보세요.", image: "images/kalguksu.jpg" }
  ]
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

// 1. AI 실시간 무한 메뉴 추천 API
app.post("/api/recommend", async (req, res) => {
  try {
    const { flavor, staple, recentHistory = [], situation = "" } = req.body;

    const flavorKr = flavor === "spicy" ? "매콤하고 칼칼한" : "담백하고 맵지 않은";
    const stapleKr = staple === "rice" ? "든든한 밥" : "호로록 면 또는 빵";
    const key = `${flavor || "spicy"}-${staple || "rice"}`;

    const ai = getGemini();

    if (ai) {
      const historyPrompt = recentHistory.length > 0 
        ? `최근에 추천받았던 다음 메뉴들은 반드시 제외하고 완전히 새로운 메뉴를 추천해주세요: [${recentHistory.slice(-10).join(", ")}].`
        : "";

      const situationPrompt = situation 
        ? `사용자가 선택한 현재 상황/선호도 힌트: "${situation}". 이 분위기와 어울리는 메뉴를 우선 고려해주세요.`
        : "";

      const prompt = `사용자가 원하는 점심/저녁 식사 조건:
- 맛: ${flavorKr}
- 주식: ${stapleKr}
${situationPrompt}
${historyPrompt}

한국의 식당이나 배달앱에서 쉽게 접할 수 있는 매력적이고 구체적인 단품 또는 정식 메뉴 1개를 무한한 전 세계/한식/아시안/양식/일식/중식 요리 풀에서 선정하여 추천해주세요.
창의적이고 군침 도는 1~2줄의 추천 이유와 실용적인 식사 팁(사이드 조합 등)을 작성해주세요.`;

      const response = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: prompt,
        config: {
          systemInstruction: "당신은 한국 최고의 미식 큐레이터 '오늘 뭐 먹지?' AI입니다. 직장인, 학생, 일반 사용자에게 당장 침샘을 자극하는 현실적이고 맛있는 메뉴를 실시간으로 맞춤 추천합니다. 형식에 맞춰 JSON으로만 응답하세요.",
          temperature: 1.0,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING, description: "구체적인 한국어 메뉴명 (예: '차돌박이 짬뽕', '생연어 사케동', '매콤 낙지덮밥', '트러플 머쉬룸 파스타')" },
              emoji: { type: Type.STRING, description: "해당 음식에 잘 어울리는 단일 이모지 (예: 🍜, 🥘, 🍣, 🥩, 🍝, 🍕, 🍲)" },
              category: { type: Type.STRING, description: "음식 카테고리 (한식, 일식, 중식, 양식, 아시안, 분식, 패스트푸드 등)" },
              reason: { type: Type.STRING, description: "군침 도는 매력적인 1~2줄의 추천 이유 설명" },
              tip: { type: Type.STRING, description: "맛있게 먹는 꿀팁, 어울리는 반찬이나 사이드 메뉴 추천" },
              searchKeyword: { type: Type.STRING, description: "지도나 맛집 검색에 최적화된 검색 키워드 (예: '짬뽕', '연어덮밥')" }
            },
            required: ["name", "emoji", "category", "reason", "tip"]
          }
        }
      });

      if (response.text) {
        const parsed = JSON.parse(response.text.trim());
        const bestImage = getBestFoodImage(parsed.name, parsed.category, staple, flavor);
        return res.json({
          success: true,
          source: "gemini",
          menu: {
            name: parsed.name,
            emoji: parsed.emoji || "🍽️",
            category: parsed.category || "오늘의 추천",
            reason: parsed.reason,
            tip: parsed.tip,
            image: bestImage,
            searchKeyword: parsed.searchKeyword || parsed.name
          }
        });
      }
    }

    // Fallback: 풍성한 사전 정의 메뉴 풀에서 최근 추천을 피해서 랜덤 선발
    const candidates = (FALLBACK_MENUS[key] || FALLBACK_MENUS["spicy-rice"]).filter(
      item => !recentHistory.includes(item.name)
    );
    const pool = candidates.length > 0 ? candidates : (FALLBACK_MENUS[key] || FALLBACK_MENUS["spicy-rice"]);
    const randomPick = pool[Math.floor(Math.random() * pool.length)];

    return res.json({
      success: true,
      source: "curated-library",
      menu: randomPick
    });
  } catch (error: any) {
    console.error("Gemini recommendation error:", error);
    // 에러 발생 시에도 중단 없이 풍부한 로컬 풀에서 즉각 반환
    const { flavor, staple } = req.body;
    const key = `${flavor || "spicy"}-${staple || "rice"}`;
    const pool = FALLBACK_MENUS[key] || FALLBACK_MENUS["spicy-rice"];
    const randomPick = pool[Math.floor(Math.random() * pool.length)];

    return res.json({
      success: true,
      source: "fallback",
      menu: randomPick
    });
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
  // Vite 미들웨어 및 정적 파일 서빙
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
