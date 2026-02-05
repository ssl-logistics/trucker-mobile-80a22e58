 import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
 import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
 
 const corsHeaders = {
   "Access-Control-Allow-Origin": "*",
   "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
 };
 
 serve(async (req) => {
   if (req.method === "OPTIONS") {
     return new Response(null, { headers: corsHeaders });
   }
 
   try {
     const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
     const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
     
     const supabase = createClient(supabaseUrl, supabaseServiceKey);
 
     const newFaqs = [
       // Jobs category
       {
         question: "Bid Ticket คืออะไร",
         answer: "Bid Ticket คือตั๋วที่ใช้สำหรับประมูลงาน Freelance ครับ 🎫\n\n• ใช้ 1 ตั๋วต่อ 1 งานที่ประมูล\n• ถ้าประมูลได้งาน ตั๋วจะถูกใช้ไป\n• ถ้าไม่ได้งาน ตั๋วจะคืนกลับมา\n• สามารถดูจำนวนตั๋วได้ที่หน้า Bidding",
         keywords: ["bid ticket", "ตั๋ว", "ticket", "bidticket", "ตั๋วประมูล"],
         category: "jobs",
         priority: 72,
         is_active: true
       },
       {
         question: "วิธีดูงานที่กำลังทำอยู่",
         answer: "ดูงานที่กำลังทำอยู่ได้ที่เมนู \"Current Jobs\" ครับ 📋\n\n1. กดเมนู Current Jobs ที่แถบด้านล่าง\n2. จะเห็นรายการงานที่กำลังทำทั้งหมด\n3. กดที่งานเพื่อดูรายละเอียดและดำเนินการต่อ\n\nงานจะแสดงสถานะปัจจุบัน เช่น รอ Check-in, กำลังขนส่ง ฯลฯ",
         keywords: ["งานปัจจุบัน", "current jobs", "งานอยู่", "งานทำอยู่", "งานที่รับ"],
         category: "jobs",
         priority: 71,
         is_active: true
       },
       {
         question: "วิธีดูประวัติงาน",
         answer: "ดูประวัติงานได้ที่เมนู \"Job History\" ครับ 📚\n\n1. ไปที่ Settings > Job History\n2. จะเห็นรายการงานทั้งหมดที่เคยทำ\n3. สามารถกดดูรายละเอียดแต่ละงานได้\n\nสามารถดูย้อนหลังได้ทุกงานที่เคยทำสำเร็จ",
         keywords: ["ประวัติงาน", "job history", "งานเก่า", "งานที่ผ่านมา", "ดูงานเก่า"],
         category: "jobs",
         priority: 70,
         is_active: true
       },
       // Workflow category
       {
         question: "SOP คืออะไร",
         answer: "SOP (Standard Operating Procedure) คือขั้นตอนถ่ายรูปมาตรฐานครับ 📸\n\nเมื่อถึงจุดรับ/ส่งสินค้า ต้องถ่ายรูปตาม SOP:\n• รูปตัวรถและทะเบียน\n• รูปสินค้า/ตู้คอนเทนเนอร์\n• รูปเอกสารการรับ-ส่ง\n• รูปอื่นๆ ตามที่กำหนด\n\nการถ่ายรูป SOP ช่วยยืนยันการทำงานและป้องกันปัญหา",
         keywords: ["sop", "ถ่ายรูป", "ขั้นตอน", "standard operating procedure", "รูปงาน"],
         category: "workflow",
         priority: 54,
         is_active: true
       },
       {
         question: "วิธีแจ้งปัญหาระหว่างทำงาน",
         answer: "แจ้งปัญหาได้ที่หน้ารายละเอียดงานครับ 🚨\n\n1. เปิดงานที่กำลังทำใน Current Jobs\n2. กดปุ่ม \"แจ้งปัญหา\" หรือ \"Report Problem\"\n3. เลือกประเภทปัญหา\n4. กรอกรายละเอียดและแนบรูป (ถ้ามี)\n5. กดส่ง\n\nทีมงานจะติดต่อกลับโดยเร็วที่สุด",
         keywords: ["แจ้งปัญหา", "report problem", "ปัญหา", "แจ้งเรื่อง", "ติดปัญหา"],
         category: "workflow",
         priority: 53,
         is_active: true
       },
       // Account category
       {
         question: "วิธีแก้ไขข้อมูลส่วนตัว",
         answer: "แก้ไขข้อมูลส่วนตัวได้ที่หน้า Profile ครับ 👤\n\n1. ไปที่ Settings > Profile\n2. กดที่ข้อมูลที่ต้องการแก้ไข\n3. แก้ไขข้อมูลใหม่\n4. กดบันทึก\n\nสามารถแก้ไขได้: ชื่อ, เบอร์โทร, รูปโปรไฟล์",
         keywords: ["แก้ไขโปรไฟล์", "edit profile", "ข้อมูลส่วนตัว", "แก้ข้อมูล", "เปลี่ยนชื่อ"],
         category: "account",
         priority: 50,
         is_active: true
       },
       {
         question: "วิธีเปลี่ยนรหัสผ่าน",
         answer: "เปลี่ยนรหัสผ่านได้ที่ Settings ครับ 🔐\n\n1. ไปที่ Settings\n2. เลือก \"เปลี่ยนรหัสผ่าน\"\n3. กรอกรหัสผ่านเดิม\n4. กรอกรหัสผ่านใหม่ 2 ครั้ง\n5. กดบันทึก\n\nแนะนำให้ใช้รหัสผ่านที่มีตัวอักษร ตัวเลข อย่างน้อย 8 ตัว",
         keywords: ["เปลี่ยนรหัสผ่าน", "change password", "รหัส", "password", "ลืมรหัส"],
         category: "account",
         priority: 49,
         is_active: true
       },
       // Vehicle category
       {
         question: "วิธีเพิ่มหรือแก้ไขข้อมูลรถ",
         answer: "จัดการข้อมูลรถได้ที่ Settings ครับ 🚛\n\n1. ไปที่ Settings > Vehicle Info\n2. ดูข้อมูลรถปัจจุบัน\n3. กดที่ข้อมูลที่ต้องการแก้ไข\n4. แก้ไขและกดบันทึก\n\nข้อมูลรถที่ต้องมี: ทะเบียนรถ, ยี่ห้อ, ประเภทรถ, น้ำหนักบรรทุก",
         keywords: ["รถ", "vehicle", "ทะเบียนรถ", "ข้อมูลรถ", "แก้ข้อมูลรถ", "เพิ่มรถ"],
         category: "vehicle",
         priority: 48,
         is_active: true
       },
       // Chat category
       {
         question: "วิธีใช้งานแชท",
         answer: "ใช้งานแชทได้ที่เมนู Chat ครับ 💬\n\n1. กดเมนู Chat ที่แถบด้านล่าง\n2. เลือกห้องแชทที่ต้องการ\n3. พิมพ์ข้อความและกดส่ง\n\nสามารถ:\n• แชทกับผู้ว่าจ้าง\n• ส่งรูปภาพ\n• ดูประวัติข้อความย้อนหลัง",
         keywords: ["แชท", "chat", "ข้อความ", "คุย", "ส่งข้อความ", "ติดต่อ"],
         category: "chat",
         priority: 45,
         is_active: true
       },
       // Expense category
       {
         question: "วิธีบันทึกค่าใช้จ่าย",
         answer: "บันทึกค่าใช้จ่ายได้ที่หน้ารายละเอียดงานครับ 💰\n\n1. เปิดงานที่กำลังทำ\n2. กดปุ่ม \"เพิ่มค่าใช้จ่าย\"\n3. เลือกประเภท (ค่าน้ำมัน, ค่าทางด่วน, อื่นๆ)\n4. กรอกจำนวนเงิน\n5. ถ่ายรูปใบเสร็จ\n6. กดบันทึก\n\nค่าใช้จ่ายจะถูกบันทึกและแสดงในหน้า Income",
         keywords: ["ค่าใช้จ่าย", "expense", "ค่าน้ำมัน", "ค่าทางด่วน", "บันทึกค่าใช้จ่าย", "เพิ่มค่าใช้จ่าย"],
         category: "expense",
         priority: 44,
         is_active: true
       }
     ];
 
     const { data, error } = await supabase
       .from("chatbot_faqs")
       .insert(newFaqs)
       .select();
 
     if (error) {
       console.error("Insert error:", error);
       throw error;
     }
 
     return new Response(
       JSON.stringify({ 
         success: true, 
         message: `Successfully inserted ${data.length} FAQs`,
         data 
       }),
       { headers: { ...corsHeaders, "Content-Type": "application/json" } }
     );
   } catch (error) {
     console.error("Error:", error);
     return new Response(
       JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
       { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
     );
   }
 });