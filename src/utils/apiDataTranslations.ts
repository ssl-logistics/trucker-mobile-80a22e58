// API Data Translation Utility
// Translates common API values to user's selected language

type Language = 'th' | 'en' | 'ko' | 'zh';

// Goods Type translations
const goodsTypeTranslations: Record<string, Record<Language, string>> = {
  'สินค้าทั่วไป': { th: 'สินค้าทั่วไป', en: 'General Goods', ko: '일반 상품', zh: '普通货物' },
  'อาหาร': { th: 'อาหาร', en: 'Food', ko: '식품', zh: '食品' },
  'อาหารแช่แข็ง': { th: 'อาหารแช่แข็ง', en: 'Frozen Food', ko: '냉동 식품', zh: '冷冻食品' },
  'อาหารสด': { th: 'อาหารสด', en: 'Fresh Food', ko: '신선 식품', zh: '生鲜食品' },
  'เครื่องดื่ม': { th: 'เครื่องดื่ม', en: 'Beverages', ko: '음료', zh: '饮料' },
  'วัสดุก่อสร้าง': { th: 'วัสดุก่อสร้าง', en: 'Construction Materials', ko: '건축 자재', zh: '建筑材料' },
  'เครื่องใช้ไฟฟ้า': { th: 'เครื่องใช้ไฟฟ้า', en: 'Electrical Appliances', ko: '전자제품', zh: '电器' },
  'เฟอร์นิเจอร์': { th: 'เฟอร์นิเจอร์', en: 'Furniture', ko: '가구', zh: '家具' },
  'สินค้าอันตราย': { th: 'สินค้าอันตราย', en: 'Hazardous Goods', ko: '위험물', zh: '危险品' },
  'เคมีภัณฑ์': { th: 'เคมีภัณฑ์', en: 'Chemicals', ko: '화학제품', zh: '化学品' },
  'สินค้าเกษตร': { th: 'สินค้าเกษตร', en: 'Agricultural Products', ko: '농산물', zh: '农产品' },
  'ปศุสัตว์': { th: 'ปศุสัตว์', en: 'Livestock', ko: '가축', zh: '牲畜' },
  'เครื่องจักร': { th: 'เครื่องจักร', en: 'Machinery', ko: '기계류', zh: '机械' },
  'ชิ้นส่วนยานยนต์': { th: 'ชิ้นส่วนยานยนต์', en: 'Auto Parts', ko: '자동차 부품', zh: '汽车零件' },
  'ยา': { th: 'ยา', en: 'Pharmaceuticals', ko: '의약품', zh: '药品' },
  'เสื้อผ้า': { th: 'เสื้อผ้า', en: 'Clothing', ko: '의류', zh: '服装' },
  'อิเล็กทรอนิกส์': { th: 'อิเล็กทรอนิกส์', en: 'Electronics', ko: '전자제품', zh: '电子产品' },
  'คอนเทนเนอร์': { th: 'คอนเทนเนอร์', en: 'Container', ko: '컨테이너', zh: '集装箱' },
};

// Vehicle Type translations
const vehicleTypeTranslations: Record<string, Record<Language, string>> = {
  // Thai formats
  'หัวลาก': { th: 'หัวลาก', en: 'Tractor Head', ko: '트랙터 헤드', zh: '牵引车头' },
  '10ล้อ': { th: '10ล้อ', en: '10-Wheeler', ko: '10륜 트럭', zh: '10轮卡车' },
  '10 ล้อ': { th: '10 ล้อ', en: '10-Wheeler', ko: '10륜 트럭', zh: '10轮卡车' },
  '6ล้อ': { th: '6ล้อ', en: '6-Wheeler', ko: '6륜 트럭', zh: '6轮卡车' },
  '6 ล้อ': { th: '6 ล้อ', en: '6-Wheeler', ko: '6륜 트럭', zh: '6轮卡车' },
  '4ล้อ': { th: '4ล้อ', en: '4-Wheeler', ko: '4륜 트럭', zh: '4轮卡车' },
  '4 ล้อ': { th: '4 ล้อ', en: '4-Wheeler', ko: '4륜 트럭', zh: '4轮卡车' },
  '12ล้อ': { th: '12ล้อ', en: '12-Wheeler', ko: '12륜 트럭', zh: '12轮卡车' },
  '12 ล้อ': { th: '12 ล้อ', en: '12-Wheeler', ko: '12륜 트럭', zh: '12轮卡车' },
  '18ล้อ': { th: '18ล้อ', en: '18-Wheeler', ko: '18륜 트럭', zh: '18轮卡车' },
  '18 ล้อ': { th: '18 ล้อ', en: '18-Wheeler', ko: '18륜 트럭', zh: '18轮卡车' },
  '22ล้อ': { th: '22ล้อ', en: '22-Wheeler', ko: '22륜 트럭', zh: '22轮卡车' },
  '22 ล้อ': { th: '22 ล้อ', en: '22-Wheeler', ko: '22륜 트럭', zh: '22轮卡车' },
  '40ล้อ': { th: '40ล้อ', en: '40-Wheeler', ko: '40륜 트럭', zh: '40轮卡车' },
  '40 ล้อ': { th: '40 ล้อ', en: '40-Wheeler', ko: '40륜 트럭', zh: '40轮卡车' },
  'รถกระบะ': { th: 'รถกระบะ', en: 'Pickup Truck', ko: '픽업트럭', zh: '皮卡车' },
  'รถตู้': { th: 'รถตู้', en: 'Van', ko: '밴', zh: '面包车' },
  'รถบรรทุก': { th: 'รถบรรทุก', en: 'Truck', ko: '트럭', zh: '卡车' },
  'รถพ่วง': { th: 'รถพ่วง', en: 'Trailer', ko: '트레일러', zh: '拖车' },
  'รถห้องเย็น': { th: 'รถห้องเย็น', en: 'Refrigerated Truck', ko: '냉장트럭', zh: '冷藏车' },
  'รถตู้คอนเทนเนอร์': { th: 'รถตู้คอนเทนเนอร์', en: 'Container Truck', ko: '컨테이너 트럭', zh: '集装箱卡车' },
  // English formats (for reverse translation)
  '10-Wheel Truck': { th: '10ล้อ', en: '10-Wheeler', ko: '10륜 트럭', zh: '10轮卡车' },
  '10-Wheeler': { th: '10ล้อ', en: '10-Wheeler', ko: '10륜 트럭', zh: '10轮卡车' },
  '10-wheel': { th: '10ล้อ', en: '10-Wheeler', ko: '10륜 트럭', zh: '10轮卡车' },
  '6-Wheel Truck': { th: '6ล้อ', en: '6-Wheeler', ko: '6륜 트럭', zh: '6轮卡车' },
  '6-Wheeler': { th: '6ล้อ', en: '6-Wheeler', ko: '6륜 트럭', zh: '6轮卡车' },
  '6-wheel': { th: '6ล้อ', en: '6-Wheeler', ko: '6륜 트럭', zh: '6轮卡车' },
  '4-Wheel Truck': { th: '4ล้อ', en: '4-Wheeler', ko: '4륜 트럭', zh: '4轮卡车' },
  '4-Wheeler': { th: '4ล้อ', en: '4-Wheeler', ko: '4륜 트럭', zh: '4轮卡车' },
  '4-wheel': { th: '4ล้อ', en: '4-Wheeler', ko: '4륜 트럭', zh: '4轮卡车' },
  '12-Wheel Truck': { th: '12ล้อ', en: '12-Wheeler', ko: '12륜 트럭', zh: '12轮卡车' },
  '12-Wheeler': { th: '12ล้อ', en: '12-Wheeler', ko: '12륜 트럭', zh: '12轮卡车' },
  '12-wheel': { th: '12ล้อ', en: '12-Wheeler', ko: '12륜 트럭', zh: '12轮卡车' },
  '18-Wheel Truck': { th: '18ล้อ', en: '18-Wheeler', ko: '18륜 트럭', zh: '18轮卡车' },
  '18-Wheeler': { th: '18ล้อ', en: '18-Wheeler', ko: '18륜 트럭', zh: '18轮卡车' },
  '18-wheel': { th: '18ล้อ', en: '18-Wheeler', ko: '18륜 트럭', zh: '18轮卡车' },
  '22-Wheel Truck': { th: '22ล้อ', en: '22-Wheeler', ko: '22륜 트럭', zh: '22轮卡车' },
  '22-Wheeler': { th: '22ล้อ', en: '22-Wheeler', ko: '22륜 트럭', zh: '22轮卡车' },
  '22-wheel': { th: '22ล้อ', en: '22-Wheeler', ko: '22륜 트럭', zh: '22轮卡车' },
  '40-Wheel Truck': { th: '40ล้อ', en: '40-Wheeler', ko: '40륜 트럭', zh: '40轮卡车' },
  '40-Wheeler': { th: '40ล้อ', en: '40-Wheeler', ko: '40륜 트럭', zh: '40轮卡车' },
  '40-wheel': { th: '40ล้อ', en: '40-Wheeler', ko: '40륜 트럭', zh: '40轮卡车' },
  'Tractor Head': { th: 'หัวลาก', en: 'Tractor Head', ko: '트랙터 헤드', zh: '牵引车头' },
  'Pickup Truck': { th: 'รถกระบะ', en: 'Pickup Truck', ko: '픽업트럭', zh: '皮卡车' },
  'Van': { th: 'รถตู้', en: 'Van', ko: '밴', zh: '面包车' },
  'Truck': { th: 'รถบรรทุก', en: 'Truck', ko: '트럭', zh: '卡车' },
  'Trailer': { th: 'รถพ่วง', en: 'Trailer', ko: '트레일러', zh: '拖车' },
  'Refrigerated Truck': { th: 'รถห้องเย็น', en: 'Refrigerated Truck', ko: '냉장트럭', zh: '冷藏车' },
  'Container Truck': { th: 'รถตู้คอนเทนเนอร์', en: 'Container Truck', ko: '컨테이너 트럭', zh: '集装箱卡车' },
};

// Transport Type translations
const transportTypeTranslations: Record<string, Record<Language, string>> = {
  'เที่ยวเดียว': { th: 'ขนส่ง เที่ยวเดียว', en: 'Single Trip', ko: '단일 운행', zh: '单程' },
  'single': { th: 'ขนส่ง เที่ยวเดียว', en: 'Single Trip', ko: '단일 운행', zh: '单程' },
  'Single': { th: 'ขนส่ง เที่ยวเดียว', en: 'Single Trip', ko: '단일 운행', zh: '单程' },
  'หลายที่': { th: 'หลายที่', en: 'Multiple Locations', ko: '다중 목적지', zh: '多目的地' },
  'multiple': { th: 'หลายที่', en: 'Multiple Locations', ko: '다중 목적지', zh: '多目的地' },
  'Multiple': { th: 'หลายที่', en: 'Multiple Locations', ko: '다중 목적지', zh: '多目的地' },
  'ไป-กลับ': { th: 'ไป-กลับ', en: 'Round Trip', ko: '왕복', zh: '往返' },
  'ขาเข้า': { th: 'ขาเข้า', en: 'Inbound', ko: '인바운드', zh: '入境' },
  'ขาออก': { th: 'ขาออก', en: 'Outbound', ko: '아웃바운드', zh: '出境' },
};

// Job Type translations (domestic/international)
const jobTypeTranslations: Record<string, Record<Language, string>> = {
  'ในประเทศ': { th: 'ภายในประเทศ', en: 'Domestic', ko: '국내', zh: '国内' },
  'domestic': { th: 'ภายในประเทศ', en: 'Domestic', ko: '국내', zh: '国内' },
  'ภายในประเทศ': { th: 'ภายในประเทศ', en: 'Domestic', ko: '국내', zh: '国内' },
  'ระหว่างประเทศ': { th: 'ภายนอกประเทศ', en: 'International', ko: '국제', zh: '国际' },
  'international': { th: 'ภายนอกประเทศ', en: 'International', ko: '국제', zh: '国际' },
  'ภายนอกประเทศ': { th: 'ภายนอกประเทศ', en: 'International', ko: '국제', zh: '国际' },
  'express_rent': { th: 'เช่ารถด่วน', en: 'Express Rent', ko: '급행 렌트', zh: '快速租车' },
  'Express Rent': { th: 'เช่ารถด่วน', en: 'Express Rent', ko: '급행 렌트', zh: '快速租车' },
  'เช่ารถด่วน': { th: 'เช่ารถด่วน', en: 'Express Rent', ko: '급행 렌트', zh: '快速租车' },
};

// Container Type translations
const containerTypeTranslations: Record<string, Record<Language, string>> = {
  '20ft': { th: 'ตู้ 20 ฟุต', en: '20ft Container', ko: '20피트 컨테이너', zh: '20英尺集装箱' },
  '40ft': { th: 'ตู้ 40 ฟุต', en: '40ft Container', ko: '40피트 컨테이너', zh: '40英尺集装箱' },
  '20 ฟุต': { th: 'ตู้ 20 ฟุต', en: '20ft Container', ko: '20피트 컨테이너', zh: '20英尺集装箱' },
  '40 ฟุต': { th: 'ตู้ 40 ฟุต', en: '40ft Container', ko: '40피트 컨테이너', zh: '40英尺集装箱' },
  'ตู้ทึบ': { th: 'ตู้ทึบ', en: 'Dry Container', ko: '드라이 컨테이너', zh: '干货集装箱' },
  'ตู้เปิดหลังคา': { th: 'ตู้เปิดหลังคา', en: 'Open Top', ko: '오픈탑', zh: '开顶集装箱' },
  'ตู้เย็น': { th: 'ตู้เย็น', en: 'Reefer', ko: '냉동 컨테이너', zh: '冷藏集装箱' },
  'ตู้พิเศษ': { th: 'ตู้พิเศษ', en: 'Special Container', ko: '특수 컨테이너', zh: '特种集装箱' },
};

// Unit translations
const unitTranslations: Record<string, Record<Language, string>> = {
  'กิโลกรัม': { th: 'กิโลกรัม', en: 'kg', ko: 'kg', zh: '公斤' },
  'kg': { th: 'กิโลกรัม', en: 'kg', ko: 'kg', zh: '公斤' },
  'ตัน': { th: 'ตัน', en: 'ton', ko: '톤', zh: '吨' },
  'ton': { th: 'ตัน', en: 'ton', ko: '톤', zh: '吨' },
  'ชิ้น': { th: 'ชิ้น', en: 'pcs', ko: '개', zh: '件' },
  'pcs': { th: 'ชิ้น', en: 'pcs', ko: '개', zh: '件' },
  'piece': { th: 'ชิ้น', en: 'pcs', ko: '개', zh: '件' },
  'pieces': { th: 'ชิ้น', en: 'pcs', ko: '개', zh: '件' },
  'กล่อง': { th: 'กล่อง', en: 'boxes', ko: '박스', zh: '箱' },
  'box': { th: 'กล่อง', en: 'boxes', ko: '박스', zh: '箱' },
  'boxes': { th: 'กล่อง', en: 'boxes', ko: '박스', zh: '箱' },
  'พาเลท': { th: 'พาเลท', en: 'pallets', ko: '팔레트', zh: '托盘' },
  'pallet': { th: 'พาเลท', en: 'pallets', ko: '팔레트', zh: '托盘' },
  'pallets': { th: 'พาเลท', en: 'pallets', ko: '팔레트', zh: '托盘' },
  'กระสอบ': { th: 'กระสอบ', en: 'bags', ko: '포대', zh: '袋' },
  'bag': { th: 'กระสอบ', en: 'bags', ko: '포대', zh: '袋' },
  'bags': { th: 'กระสอบ', en: 'bags', ko: '포대', zh: '袋' },
};

// Generic translation function
function translateValue(
  value: string | undefined | null,
  translations: Record<string, Record<Language, string>>,
  language: Language
): string {
  if (!value) return '-';
  
  // Try exact match first
  if (translations[value]) {
    return translations[value][language] || value;
  }
  
  // Try normalized match (trim and lowercase for comparison)
  const normalizedValue = value.trim();
  for (const key of Object.keys(translations)) {
    if (key.toLowerCase() === normalizedValue.toLowerCase()) {
      return translations[key][language] || value;
    }
  }
  
  // Return original value if no translation found
  return value;
}

// Exported translation functions
export function translateGoodsType(value: string | undefined | null, language: Language): string {
  return translateValue(value, goodsTypeTranslations, language);
}

export function translateVehicleType(value: string | undefined | null, language: Language): string {
  return translateValue(value, vehicleTypeTranslations, language);
}

export function translateTransportType(value: string | undefined | null, language: Language): string {
  return translateValue(value, transportTypeTranslations, language);
}

export function translateJobType(value: string | undefined | null, language: Language): string {
  return translateValue(value, jobTypeTranslations, language);
}

export function translateContainerType(value: string | undefined | null, language: Language): string {
  return translateValue(value, containerTypeTranslations, language);
}

export function translateUnit(value: string | undefined | null, language: Language): string {
  return translateValue(value, unitTranslations, language);
}

// Combined translation for equipment list (may contain multiple types)
export function translateEquipmentList(value: string | undefined | null, language: Language): string {
  if (!value) return '-';
  
  // Split by common delimiters and translate each part
  const parts = value.split(/[,，、\/]/);
  const translated = parts.map(part => {
    const trimmed = part.trim();
    // Try vehicle type first, then container type
    const vehicleTranslated = translateVehicleType(trimmed, language);
    if (vehicleTranslated !== trimmed) return vehicleTranslated;
    
    const containerTranslated = translateContainerType(trimmed, language);
    if (containerTranslated !== trimmed) return containerTranslated;
    
    return trimmed;
  });
  
  return translated.join(', ');
}
