import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Check if user message matches any FAQ keywords
function findMatchingFaq(userMessage: string, faqs: any[]): any | null {
  const lowerMessage = userMessage.toLowerCase().trim();
  
  for (const faq of faqs) {
    const keywords = faq.keywords || [];
    for (const keyword of keywords) {
      if (lowerMessage.includes(keyword.toLowerCase())) {
        return faq;
      }
    }
  }
  return null;
}

// Check if the question is about personal/private information
function isPersonalQuestion(message: string): boolean {
  const personalKeywords = [
    'รหัสผ่าน', 'password', 'เงินเดือน', 'salary',
    'บัญชีธนาคาร', 'bank account', 'บัตรประชาชน', 'id card',
    'ที่อยู่บ้าน', 'home address', 'เบอร์โทรของ', 'phone number of',
    'ข้อมูลคนอื่น', 'other user', 'ข้อมูลลูกค้า', 'customer data',
    'ประวัติงานของคนอื่น', 'job history of others', 'รายได้ของคนอื่น',
    'บอกรหัส', 'tell me password', 'ข้อมูลส่วนตัว', 'private data',
    'hack', 'แฮก', 'bypass', 'เจาะระบบ'
  ];
  
  const lowerMessage = message.toLowerCase();
  return personalKeywords.some(keyword => lowerMessage.includes(keyword.toLowerCase()));
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Get the latest user message
    const latestUserMessage = messages.filter((m: any) => m.role === "user").pop();
    const userQuestion = latestUserMessage?.content || "";

    // Check for personal/private information requests
    if (isPersonalQuestion(userQuestion)) {
      return new Response(
        JSON.stringify({ 
          content: "ขออภัยครับ ผมไม่สามารถให้ข้อมูลส่วนตัวหรือข้อมูลที่เป็นความลับได้ครับ 🔒\n\nผมช่วยได้เฉพาะเรื่อง:\n- การใช้งานแอป TheTroob\n- วิธีการรับงาน/ประมูลงาน\n- การ Check-in และทำงาน\n- การดูรายได้และประวัติงาน\n\nมีอะไรเกี่ยวกับการใช้งานแอปให้ช่วยไหมครับ?" 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Try to find matching FAQ from database
    if (SUPABASE_URL && SUPABASE_ANON_KEY) {
      const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      
      const { data: faqs, error } = await supabase
        .from("chatbot_faqs")
        .select("*")
        .eq("is_active", true)
        .order("priority", { ascending: false });

      if (!error && faqs && faqs.length > 0) {
        const matchedFaq = findMatchingFaq(userQuestion, faqs);
        if (matchedFaq) {
          console.log("FAQ matched:", matchedFaq.question);
          return new Response(
            JSON.stringify({ content: matchedFaq.answer }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
    }

    // If no FAQ match, use AI but with strict scope
    const systemPrompt = `คุณเป็นผู้ช่วย AI ของแอปพลิเคชัน TheTroob ซึ่งเป็นแอปสำหรับคนขับรถบรรทุก

⚠️ ข้อจำกัดสำคัญ:
- ตอบได้เฉพาะคำถามเกี่ยวกับการใช้งานแอป TheTroob เท่านั้น
- ห้ามตอบข้อมูลส่วนตัว ข้อมูลความลับ หรือข้อมูลของผู้ใช้อื่น
- ห้ามให้คำแนะนำเกี่ยวกับการ hack หรือ bypass ระบบ
- หากถูกถามเรื่องนอกขอบเขต ให้ปฏิเสธอย่างสุภาพ

หน้าที่ของคุณ:
- ตอบคำถามเกี่ยวกับการใช้งานแอป
- ช่วยเหลือเรื่องการรับงาน การประมูลงาน
- อธิบายฟีเจอร์ต่างๆ เช่น Current Jobs, Bidding, Income, Job History
- ให้คำแนะนำเกี่ยวกับการใช้งานแอปอย่างมีประสิทธิภาพ
- แนะนำวิธีการสมัครสมาชิกและขั้นตอนการใช้งาน

ฟีเจอร์หลักของแอป:
1. Home - หน้าแรกแสดงงานที่แนะนำ
2. Current Jobs - ดูงานที่กำลังทำอยู่
3. Bidding - ประมูลงานใหม่ (สำหรับ Freelance driver ใช้ Bid Ticket)
4. Income - ดูรายได้
5. Job History - ดูประวัติงาน
6. Chat - แชทกับผู้ว่าจ้าง
7. Settings - ตั้งค่าโปรไฟล์ ภาษา รถ

ขั้นตอนการทำงาน:
1. รับงาน → Check-in ที่จุดรับ → ถ่ายรูป SOP → ขนส่ง → Check-in ที่จุดส่ง → เสร็จสิ้น

ตอบสั้นกระชับ เป็นภาษาไทย ใช้คำสุภาพ ใส่ emoji เล็กน้อยเพื่อความเป็นมิตร`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limits exceeded, please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required, please add funds." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "ขออภัยครับ ไม่สามารถตอบคำถามได้";

    return new Response(
      JSON.stringify({ content }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Chatbot error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
