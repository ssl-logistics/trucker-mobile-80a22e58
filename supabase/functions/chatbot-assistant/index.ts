import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Map language code to answer column
function getAnswerColumn(lang: string): string {
  switch (lang) {
    case 'en': return 'answer_en';
    case 'ko': return 'answer_ko';
    case 'zh': return 'answer_zh';
    default: return 'answer'; // Thai is default
  }
}

// Get localized answer from FAQ
function getLocalizedAnswer(faq: any, lang: string): string {
  const col = getAnswerColumn(lang);
  // Fall back to Thai (answer) if translation is missing
  return faq[col] || faq.answer;
}

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

// Get privacy rejection message by language
function getPrivacyRejection(lang: string): string {
  switch (lang) {
    case 'en':
      return "Sorry, I cannot provide personal or confidential information. 🔒\n\nI can only help with:\n- Using The Trucker app\n- How to accept/bid on jobs\n- Check-in and work processes\n- Viewing income and job history\n\nIs there anything about using the app I can help with?";
    case 'ko':
      return "죄송합니다. 개인정보나 기밀 정보는 제공할 수 없습니다. 🔒\n\n다음 사항만 도와드릴 수 있습니다:\n- The Trucker 앱 사용법\n- 일자리 수락/입찰 방법\n- 체크인 및 업무 절차\n- 수입 및 업무 이력 확인\n\n앱 사용에 관해 도움이 필요하신가요?";
    case 'zh':
      return "抱歉，我无法提供个人或机密信息。🔒\n\n我只能帮助以下方面：\n- 使用 The Trucker 应用\n- 如何接受/竞标工作\n- 签到和工作流程\n- 查看收入和工作历史\n\n有什么关于应用使用的问题我可以帮忙吗？";
    default:
      return "ขออภัยครับ ผมไม่สามารถให้ข้อมูลส่วนตัวหรือข้อมูลที่เป็นความลับได้ครับ 🔒\n\nผมช่วยได้เฉพาะเรื่อง:\n- การใช้งานแอป The Trucker\n- วิธีการรับงาน/ประมูลงาน\n- การ Check-in และทำงาน\n- การดูรายได้และประวัติงาน\n\nมีอะไรเกี่ยวกับการใช้งานแอปให้ช่วยไหมครับ?";
  }
}

// Get system prompt by language
function getSystemPrompt(lang: string): string {
  if (lang === 'en') {
    return `You are an AI assistant for The Trucker app, a mobile application for truck drivers.
IMPORTANT: You MUST reply in English only.

⚠️ Restrictions:
- Only answer questions about using The Trucker app
- Never share personal, confidential, or other users' data
- Never provide advice on hacking or bypassing the system
- Politely decline out-of-scope questions

Your duties:
- Answer questions about app usage
- Help with accepting jobs and bidding
- Explain features: Current Jobs, Bidding, Income, Job History
- Guide efficient app usage
- Explain registration and onboarding steps

Main features:
1. Home - Shows recommended jobs
2. Current Jobs - View active jobs
3. Bidding - Bid on new jobs (Freelance drivers use Bid Tickets)
4. Income - View earnings
5. Job History - View past jobs
6. Chat - Chat with employers
7. Settings - Profile, language, vehicle settings

Workflow:
1. Accept job → Check-in at pickup → Take SOP photos → Transport → Check-in at delivery → Complete

Be concise and friendly with some emojis.`;
  }

  if (lang === 'ko') {
    return `당신은 The Trucker 앱의 AI 어시스턴트입니다. 트럭 운전사를 위한 모바일 애플리케이션입니다.
중요: 반드시 한국어로만 답변하세요.

⚠️ 제한 사항:
- The Trucker 앱 사용에 관한 질문만 답변 가능
- 개인정보, 기밀 정보 또는 다른 사용자의 데이터 공유 금지
- 해킹이나 시스템 우회에 대한 조언 금지
- 범위 외 질문은 정중히 거절

주요 기능:
1. 홈 - 추천 일자리 표시
2. 현재 일자리 - 진행 중인 일자리 확인
3. 입찰 - 새 일자리 입찰 (프리랜서 운전사는 입찰 티켓 사용)
4. 수입 - 수입 확인
5. 일자리 이력 - 과거 일자리 확인
6. 채팅 - 고용주와 채팅
7. 설정 - 프로필, 언어, 차량 설정

작업 흐름:
1. 일자리 수락 → 픽업 체크인 → SOP 사진 촬영 → 운송 → 배달 체크인 → 완료

간결하고 친절하게 이모지를 사용하여 답변하세요.`;
  }

  if (lang === 'zh') {
    return `你是 The Trucker 应用的 AI 助手，这是一款面向卡车司机的移动应用。
重要：你必须只用中文回复。

⚠️ 限制：
- 只回答关于 The Trucker 应用使用的问题
- 不得分享个人、机密或其他用户的数据
- 不得提供关于黑客攻击或绕过系统的建议
- 礼貌地拒绝超出范围的问题

主要功能：
1. 首页 - 显示推荐工作
2. 当前工作 - 查看进行中的工作
3. 竞标 - 竞标新工作（自由职业司机使用竞标券）
4. 收入 - 查看收入
5. 工作历史 - 查看过去的工作
6. 聊天 - 与雇主聊天
7. 设置 - 个人资料、语言、车辆设置

工作流程：
1. 接受工作 → 取货签到 → 拍摄 SOP 照片 → 运输 → 送货签到 → 完成

回复要简洁友好，适当使用表情符号。`;
  }

  // Default: Thai
  return `คุณเป็นผู้ช่วย AI ของแอปพลิเคชัน The Trucker ซึ่งเป็นแอปสำหรับคนขับรถบรรทุก
สำคัญ: ต้องตอบเป็นภาษาไทยเท่านั้น

⚠️ ข้อจำกัดสำคัญ:
- ตอบได้เฉพาะคำถามเกี่ยวกับการใช้งานแอป The Trucker เท่านั้น
- ห้ามตอบข้อมูลส่วนตัว ข้อมูลความลับ หรือข้อมูลของผู้ใช้อื่น
- ห้ามให้คำแนะนำเกี่ยวกับการ hack หรือ bypass ระบบ
- หากถูกถามเรื่องนอกขอบเขต ให้ปฏิเสธอย่างสุภาพ

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
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, language } = await req.json();
    const lang = language || 'th';
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
        JSON.stringify({ content: getPrivacyRejection(lang) }),
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
          const localizedAnswer = getLocalizedAnswer(matchedFaq, lang);
          return new Response(
            JSON.stringify({ content: localizedAnswer }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
    }

    // If no FAQ match, use AI but with strict scope
    const systemPrompt = getSystemPrompt(lang);

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
    const fallback = lang === 'en' ? "Sorry, I cannot answer your question at this time."
      : lang === 'ko' ? "죄송합니다. 현재 질문에 답변할 수 없습니다."
      : lang === 'zh' ? "抱歉，目前无法回答您的问题。"
      : "ขออภัยครับ ไม่สามารถตอบคำถามได้";
    const content = data.choices?.[0]?.message?.content || fallback;

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
