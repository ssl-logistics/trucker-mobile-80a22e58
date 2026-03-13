// Master data สำหรับอำเภอและจังหวัดในประเทศไทย
export interface Location {
  district: string;
  province: string;
  displayText: string;
}

export const locations: Location[] = [
  // กรุงเทพมหานคร
  { district: "บางกอกน้อย", province: "กรุงเทพมหานคร", displayText: "บางกอกน้อย, กรุงเทพมหานคร" },
  { district: "บางกอกใหญ่", province: "กรุงเทพมหานคร", displayText: "บางกอกใหญ่, กรุงเทพมหานคร" },
  { district: "บางกะปิ", province: "กรุงเทพมหานคร", displayText: "บางกะปิ, กรุงเทพมหานคร" },
  { district: "บางเขน", province: "กรุงเทพมหานคร", displayText: "บางเขน, กรุงเทพมหานคร" },
  { district: "บางคอแหลม", province: "กรุงเทพมหานคร", displayText: "บางคอแหลม, กรุงเทพมหานคร" },
  { district: "บางซื่อ", province: "กรุงเทพมหานคร", displayText: "บางซื่อ, กรุงเทพมหานคร" },
  { district: "ดินแดง", province: "กรุงเทพมหานคร", displayText: "ดินแดง, กรุงเทพมหานคร" },
  { district: "ดุสิต", province: "กรุงเทพมหานคร", displayText: "ดุสิต, กรุงเทพมหานคร" },
  { district: "ห้วยขวาง", province: "กรุงเทพมหานคร", displayText: "ห้วยขวาง, กรุงเทพมหานคร" },
  { district: "คลองเตย", province: "กรุงเทพมหานคร", displayText: "คลองเตย, กรุงเทพมหานคร" },
  { district: "คลองสาน", province: "กรุงเทพมหานคร", displayText: "คลองสาน, กรุงเทพมหานคร" },
  { district: "ลาดกระบัง", province: "กรุงเทพมหานคร", displayText: "ลาดกระบัง, กรุงเทพมหานคร" },
  { district: "ลาดพร้าว", province: "กรุงเทพมหานคร", displayText: "ลาดพร้าว, กรุงเทพมหานคร" },
  { district: "ปทุมวัน", province: "กรุงเทพมหานคร", displayText: "ปทุมวัน, กรุงเทพมหานคร" },
  { district: "ป้อมปราบศัตรูพ่าย", province: "กรุงเทพมหานคร", displayText: "ป้อมปราบศัตรูพ่าย, กรุงเทพมหานคร" },
  { district: "พระนคร", province: "กรุงเทพมหานคร", displayText: "พระนคร, กรุงเทพมหานคร" },
  { district: "พระโขนง", province: "กรุงเทพมหานคร", displayText: "พระโขนง, กรุงเทพมหานคร" },
  { district: "ราชเทวี", province: "กรุงเทพมหานคร", displayText: "ราชเทวี, กรุงเทพมหานคร" },
  { district: "ราษฎร์บูรณะ", province: "กรุงเทพมหานคร", displayText: "ราษฎร์บูรณะ, กรุงเทพมหานคร" },
  { district: "สาทร", province: "กรุงเทพมหานคร", displayText: "สาทร, กรุงเทพมหานคร" },
  { district: "หนองจอก", province: "กรุงเทพมหานคร", displayText: "หนองจอก, กรุงเทพมหานคร" },
  { district: "บางรัก", province: "กรุงเทพมหานคร", displayText: "บางรัก, กรุงเทพมหานคร" },
  { district: "มีนบุรี", province: "กรุงเทพมหานคร", displayText: "มีนบุรี, กรุงเทพมหานคร" },
  { district: "ยานนาวา", province: "กรุงเทพมหานคร", displayText: "ยานนาวา, กรุงเทพมหานคร" },
  { district: "สัมพันธวงศ์", province: "กรุงเทพมหานคร", displayText: "สัมพันธวงศ์, กรุงเทพมหานคร" },
  { district: "พญาไท", province: "กรุงเทพมหานคร", displayText: "พญาไท, กรุงเทพมหานคร" },
  { district: "ธนบุรี", province: "กรุงเทพมหานคร", displayText: "ธนบุรี, กรุงเทพมหานคร" },
  { district: "บางขุนเทียน", province: "กรุงเทพมหานคร", displayText: "บางขุนเทียน, กรุงเทพมหานคร" },
  { district: "ภาษีเจริญ", province: "กรุงเทพมหานคร", displayText: "ภาษีเจริญ, กรุงเทพมหานคร" },
  { district: "หนองแขม", province: "กรุงเทพมหานคร", displayText: "หนองแขม, กรุงเทพมหานคร" },
  { district: "บางพลัด", province: "กรุงเทพมหานคร", displayText: "บางพลัด, กรุงเทพมหานคร" },
  { district: "บึงกุ่ม", province: "กรุงเทพมหานคร", displayText: "บึงกุ่ม, กรุงเทพมหานคร" },
  { district: "จตุจักร", province: "กรุงเทพมหานคร", displayText: "จตุจักร, กรุงเทพมหานคร" },
  { district: "ประเวศ", province: "กรุงเทพมหานคร", displayText: "ประเวศ, กรุงเทพมหานคร" },
  { district: "สวนหลวง", province: "กรุงเทพมหานคร", displayText: "สวนหลวง, กรุงเทพมหานคร" },
  { district: "จอมทอง", province: "กรุงเทพมหานคร", displayText: "จอมทอง, กรุงเทพมหานคร" },
  { district: "ดอนเมือง", province: "กรุงเทพมหานคร", displayText: "ดอนเมือง, กรุงเทพมหานคร" },
  { district: "วัฒนา", province: "กรุงเทพมหานคร", displayText: "วัฒนา, กรุงเทพมหานคร" },
  { district: "บางแค", province: "กรุงเทพมหานคร", displayText: "บางแค, กรุงเทพมหานคร" },
  { district: "หลักสี่", province: "กรุงเทพมหานคร", displayText: "หลักสี่, กรุงเทพมหานคร" },
  { district: "สายไหม", province: "กรุงเทพมหานคร", displayText: "สายไหม, กรุงเทพมหานคร" },
  { district: "คันนายาว", province: "กรุงเทพมหานคร", displayText: "คันนายาว, กรุงเทพมหานคร" },
  { district: "สะพานสูง", province: "กรุงเทพมหานคร", displayText: "สะพานสูง, กรุงเทพมหานคร" },
  { district: "วังทองหลาง", province: "กรุงเทพมหานคร", displayText: "วังทองหลาง, กรุงเทพมหานคร" },
  { district: "คลองสามวา", province: "กรุงเทพมหานคร", displayText: "คลองสามวา, กรุงเทพมหานคร" },
  { district: "บางนา", province: "กรุงเทพมหานคร", displayText: "บางนา, กรุงเทพมหานคร" },
  { district: "ทวีวัฒนา", province: "กรุงเทพมหานคร", displayText: "ทวีวัฒนา, กรุงเทพมหานคร" },
  { district: "ทุ่งครุ", province: "กรุงเทพมหานคร", displayText: "ทุ่งครุ, กรุงเทพมหานคร" },
  { district: "บางบอน", province: "กรุงเทพมหานคร", displayText: "บางบอน, กรุงเทพมหานคร" },
  
  // นนทบุรี
  { district: "เมืองนนทบุรี", province: "นนทบุรี", displayText: "เมืองนนทบุรี, นนทบุรี" },
  { district: "บางกรวย", province: "นนทบุรี", displayText: "บางกรวย, นนทบุรี" },
  { district: "บางใหญ่", province: "นนทบุรี", displayText: "บางใหญ่, นนทบุรี" },
  { district: "บางบุวทอง", province: "นนทบุรี", displayText: "บางบุวทอง, นนทบุรี" },
  { district: "ไทรน้อย", province: "นนทบุรี", displayText: "ไทรน้อย, นนทบุรี" },
  { district: "ปากเกร็ด", province: "นนทบุรี", displayText: "ปากเกร็ด, นนทบุรี" },
  
  // ปทุมธานี
  { district: "เมืองปทุมธานี", province: "ปทุมธานี", displayText: "เมืองปทุมธานี, ปทุมธานี" },
  { district: "คลองหลวง", province: "ปทุมธานี", displayText: "คลองหลวง, ปทุมธานี" },
  { district: "ธัญบุรี", province: "ปทุมธานี", displayText: "ธัญบุรี, ปทุมธานี" },
  { district: "หนองเสือ", province: "ปทุมธานี", displayText: "หนองเสือ, ปทุมธานี" },
  { district: "ลาดหลุมแก้ว", province: "ปทุมธานี", displayText: "ลาดหลุมแก้ว, ปทุมธานี" },
  { district: "ลำลูกกา", province: "ปทุมธานี", displayText: "ลำลูกกา, ปทุมธานี" },
  { district: "สามโคก", province: "ปทุมธานี", displayText: "สามโคก, ปทุมธานี" },
  
  // สมุทรปราการ
  { district: "เมืองสมุทรปราการ", province: "สมุทรปราการ", displayText: "เมืองสมุทรปราการ, สมุทรปราการ" },
  { district: "บางบ่อ", province: "สมุทรปราการ", displayText: "บางบ่อ, สมุทรปราการ" },
  { district: "บางพลี", province: "สมุทรปราการ", displayText: "บางพลี, สมุทรปราการ" },
  { district: "บางเสาธง", province: "สมุทรปราการ", displayText: "บางเสาธง, สมุทรปราการ" },
  { district: "พระประแดง", province: "สมุทรปราการ", displayText: "พระประแดง, สมุทรปราการ" },
  { district: "พระสมุทรเจดีย์", province: "สมุทรปราการ", displayText: "พระสมุทรเจดีย์, สมุทรปราการ" },
  
  // ฉะเชิงเทรา
  { district: "เมืองฉะเชิงเทรา", province: "ฉะเชิงเทรา", displayText: "เมืองฉะเชิงเทรา, ฉะเชิงเทรา" },
  { district: "บางคล้า", province: "ฉะเชิงเทรา", displayText: "บางคล้า, ฉะเชิงเทรา" },
  { district: "บางน้ำเปรี้ยว", province: "ฉะเชิงเทรา", displayText: "บางน้ำเปรี้ยว, ฉะเชิงเทรา" },
  { district: "บางปะกง", province: "ฉะเชิงเทรา", displayText: "บางปะกง, ฉะเชิงเทรา" },
  { district: "บ้านโพธิ์", province: "ฉะเชิงเทรา", displayText: "บ้านโพธิ์, ฉะเชิงเทรา" },
  
  // ชลบุรี
  { district: "เมืองชลบุรี", province: "ชลบุรี", displayText: "เมืองชลบุรี, ชลบุรี" },
  { district: "บางละมุง", province: "ชลบุรี", displayText: "บางละมุง, ชลบุรี" },
  { district: "พนัสนิคม", province: "ชลบุรี", displayText: "พนัสนิคม, ชลบุรี" },
  { district: "ศรีราชา", province: "ชลบุรี", displayText: "ศรีราชา, ชลบุรี" },
  { district: "สัตหีบ", province: "ชลบุรี", displayText: "สัตหีบ, ชลบุรี" },
  
  // ระยอง
  { district: "เมืองระยอง", province: "ระยอง", displayText: "เมืองระยอง, ระยอง" },
  { district: "บ้านฉาง", province: "ระยอง", displayText: "บ้านฉาง, ระยอง" },
  { district: "ปลวกแดง", province: "ระยอง", displayText: "ปลวกแดง, ระยอง" },
  { district: "เขาชะเมา", province: "ระยอง", displayText: "เขาชะเมา, ระยอง" },
  
  // เชียงใหม่
  { district: "เมืองเชียงใหม่", province: "เชียงใหม่", displayText: "เมืองเชียงใหม่, เชียงใหม่" },
  { district: "หางดง", province: "เชียงใหม่", displayText: "หางดง, เชียงใหม่" },
  { district: "สันกำแพง", province: "เชียงใหม่", displayText: "สันกำแพง, เชียงใหม่" },
  { district: "สันทราย", province: "เชียงใหม่", displayText: "สันทราย, เชียงใหม่" },
  { district: "แม่ริม", province: "เชียงใหม่", displayText: "แม่ริม, เชียงใหม่" },
  
  // เชียงราย
  { district: "เมืองเชียงราย", province: "เชียงราย", displayText: "เมืองเชียงราย, เชียงราย" },
  { district: "แม่จัน", province: "เชียงราย", displayText: "แม่จัน, เชียงราย" },
  { district: "แม่สาย", province: "เชียงราย", displayText: "แม่สาย, เชียงราย" },
  
  // พิษณุโลก
  { district: "เมืองพิษณุโลก", province: "พิษณุโลก", displayText: "เมืองพิษณุโลก, พิษณุโลก" },
  { district: "บางระกำ", province: "พิษณุโลก", displayText: "บางระกำ, พิษณุโลก" },
  { district: "บางกระทุ่ม", province: "พิษณุโลก", displayText: "บางกระทุ่ม, พิษณุโลก" },
  
  // นครราชสีมา
  { district: "เมืองนครราชสีมา", province: "นครราชสีมา", displayText: "เมืองนครราชสีมา, นครราชสีมา" },
  { district: "ปากช่อง", province: "นครราชสีมา", displayText: "ปากช่อง, นครราชสีมา" },
  { district: "โชคชัย", province: "นครราชสีมา", displayText: "โชคชัย, นครราชสีมา" },
  
  // ขอนแก่น
  { district: "เมืองขอนแก่น", province: "ขอนแก่น", displayText: "เมืองขอนแก่น, ขอนแก่น" },
  { district: "บ้านไผ่", province: "ขอนแก่น", displayText: "บ้านไผ่, ขอนแก่น" },
  { district: "พล", province: "ขอนแก่น", displayText: "พล, ขอนแก่น" },
  
  // อุดรธานี
  { district: "เมืองอุดรธานี", province: "อุดรธานี", displayText: "เมืองอุดรธานี, อุดรธานี" },
  { district: "กุมภวาปี", province: "อุดรธานี", displayText: "กุมภวาปี, อุดรธานี" },
  { district: "บ้านผือ", province: "อุดรธานี", displayText: "บ้านผือ, อุดรธานี" },
  
  // สงขลา
  { district: "เมืองสงขลา", province: "สงขลา", displayText: "เมืองสงขลา, สงขลา" },
  { district: "หาดใหญ่", province: "สงขลา", displayText: "หาดใหญ่, สงขลา" },
  { district: "สะเดา", province: "สงขลา", displayText: "สะเดา, สงขลา" },
  
  // ภูเก็ต
  { district: "เมืองภูเก็ต", province: "ภูเก็ต", displayText: "เมืองภูเก็ต, ภูเก็ต" },
  { district: "กะทู้", province: "ภูเก็ต", displayText: "กะทู้, ภูเก็ต" },
  { district: "ถลาง", province: "ภูเก็ต", displayText: "ถลาง, ภูเก็ต" },
  
  // สุราษฎร์ธานี
  { district: "เมืองสุราษฎร์ธานี", province: "สุราษฎร์ธานี", displayText: "เมืองสุราษฎร์ธานี, สุราษฎร์ธานี" },
  { district: "กาญจนดิษฐ์", province: "สุราษฎร์ธานี", displayText: "กาญจนดิษฐ์, สุราษฎร์ธานี" },
  { district: "ดอนสัก", province: "สุราษฎร์ธานี", displayText: "ดอนสัก, สุราษฎร์ธานี" },
  
  // กระบี่
  { district: "เมืองกระบี่", province: "กระบี่", displayText: "เมืองกระบี่, กระบี่" },
  { district: "อ่าวลึก", province: "กระบี่", displayText: "อ่าวลึก, กระบี่" },
  
  // นครศรีธรรมราช
  { district: "เมืองนครศรีธรรมราช", province: "นครศรีธรรมราช", displayText: "เมืองนครศรีธรรมราช, นครศรีธรรมราช" },
  { district: "ปากพนัง", province: "นครศรีธรรมราช", displayText: "ปากพนัง, นครศรีธรรมราช" },
  { district: "ชะอวด", province: "นครศรีธรรมราช", displayText: "ชะอวด, นครศรีธรรมราช" },
  
  // ตรัง
  { district: "เมืองตรัง", province: "ตรัง", displayText: "เมืองตรัง, ตรัง" },
  { district: "กันตัง", province: "ตรัง", displayText: "กันตัง, ตรัง" },
  
  // พัทลุง
  { district: "เมืองพัทลุง", province: "พัทลุง", displayText: "เมืองพัทลุง, พัทลุง" },
  { district: "ควนขนุน", province: "พัทลุง", displayText: "ควนขนุน, พัทลุง" },
  
  // สตูล
  { district: "เมืองสตูล", province: "สตูล", displayText: "เมืองสตูล, สตูล" },
  { district: "ละงู", province: "สตูล", displayText: "ละงู, สตูล" },
  
  // ยะลา
  { district: "เมืองยะลา", province: "ยะลา", displayText: "เมืองยะลา, ยะลา" },
  { district: "เบตง", province: "ยะลา", displayText: "เบตง, ยะลา" },
  
  // ปัตตานี
  { district: "เมืองปัตตานี", province: "ปัตตานี", displayText: "เมืองปัตตานี, ปัตตานี" },
  { district: "หนองจิก", province: "ปัตตานี", displayText: "หนองจิก, ปัตตานี" },
  
  // นราธิวาส
  { district: "เมืองนราธิวาส", province: "นราธิวาส", displayText: "เมืองนราธิวาส, นราธิวาส" },
  { district: "สุไหงโก-ลก", province: "นราธิวาส", displayText: "สุไหงโก-ลก, นราธิวาส" },
];
