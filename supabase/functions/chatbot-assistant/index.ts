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

// Ensure any mention of bidding jobs clarifies it's freelance-only
function annotateBiddingFreelance(answer: string, lang: string): string {
  if (!answer) return answer;
  const lower = answer.toLowerCase();
  const mentionsBidding =
    lower.includes('bidding job') ||
    lower.includes('งานประมูล') ||
    lower.includes('ประมูลงาน') ||
    lower.includes('竞标') ||
    lower.includes('입찰');
  if (!mentionsBidding) return answer;

  const freelanceMarkers = ['freelance', 'ฟรีแลน', '프리랜', '自由职业'];
  if (freelanceMarkers.some((m) => lower.includes(m.toLowerCase()))) return answer;

  const inline =
    lang === 'en'
      ? ' (Freelance drivers only)'
      : lang === 'ko'
      ? ' (프리랜서 운전사 전용)'
      : lang === 'zh'
      ? '（仅限自由职业司机）'
      : ' (สำหรับคนขับฟรีแลนซ์เท่านั้น)';

  const lines = answer.split('\n');
  const idx = lines.findIndex((l) => /bidding job|งานประมูล|竞标|입찰/i.test(l));
  if (idx >= 0) {
    lines[idx] = lines[idx].replace(/\s*$/, '') + inline;
    return lines.join('\n');
  }
  return answer + '\n' + inline.trim();
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

// Role-specific guidance appended to the system prompt
function getRoleContext(lang: string, userType: string): string {
  const isFreelance = userType === 'freelance_driver';
  const isInternal = userType === 'internal_driver' || userType === 'external_driver';

  if (lang === 'en') {
    if (isFreelance) {
      return `\n\n👤 User role: FREELANCE DRIVER
- Can browse and BID on jobs using Bid Tickets (100 THB fee per bid)
- Sees prices, income, expenses, and bank account settings
- Must complete bank details before starting a job
- Has access to Express Rent jobs
- Manages own expenses with receipts
Focus answers on: bidding, accepting jobs, income, expenses, bank setup.`;
    }
    if (isInternal) {
      return `\n\n👤 User role: COMPANY DRIVER (Internal)
- Receives jobs ASSIGNED by the company (no bidding)
- Does NOT see prices, income, or financial information
- No bank account setup required
- Focus on executing assigned jobs only
Focus answers on: assigned jobs, check-in/SOP, delivery, job history. Do NOT discuss bidding, pricing, or income.`;
    }
    return '';
  }

  if (lang === 'ko') {
    if (isFreelance) {
      return `\n\n👤 사용자 역할: 프리랜서 운전사
- 입찰 티켓으로 일자리 입찰 가능 (입찰당 100 THB)
- 가격, 수입, 비용, 은행 계좌 설정 표시
- 일자리 시작 전 은행 정보 필수
- Express Rent 일자리 접근 가능
답변 초점: 입찰, 일자리 수락, 수입, 비용, 은행 설정.`;
    }
    if (isInternal) {
      return `\n\n👤 사용자 역할: 회사 운전사 (내부)
- 회사에서 배정된 일자리 수행 (입찰 없음)
- 가격, 수입, 재무 정보 표시 안 됨
- 은행 계좌 설정 불필요
답변 초점: 배정된 일자리, 체크인/SOP, 배달, 이력. 입찰/가격/수입 언급 금지.`;
    }
    return '';
  }

  if (lang === 'zh') {
    if (isFreelance) {
      return `\n\n👤 用户角色：自由职业司机
- 可使用竞标券竞标工作（每次 100 泰铢）
- 显示价格、收入、费用和银行账户设置
- 开始工作前必须完成银行信息
- 可访问 Express Rent 工作
回答重点：竞标、接受工作、收入、费用、银行设置。`;
    }
    if (isInternal) {
      return `\n\n👤 用户角色：公司司机（内部）
- 由公司分配工作（无竞标）
- 不显示价格、收入或财务信息
- 无需设置银行账户
回答重点：分配的工作、签到/SOP、送货、历史。不要讨论竞标、价格或收入。`;
    }
    return '';
  }

  // Thai default
  if (isFreelance) {
    return `\n\n👤 บทบาทผู้ใช้: คนขับฟรีแลนซ์ (Freelance Driver)
- ประมูลงานได้ด้วย Bid Ticket (ค่าธรรมเนียม 100 บาท/ครั้ง)
- เห็นราคา รายได้ ค่าใช้จ่าย และตั้งค่าบัญชีธนาคาร
- ต้องกรอกข้อมูลธนาคารก่อนเริ่มงาน
- เข้าถึงงาน Express Rent ได้
- จัดการค่าใช้จ่ายพร้อมใบเสร็จเอง
เน้นตอบเรื่อง: การประมูล รับงาน รายได้ ค่าใช้จ่าย และการตั้งค่าบัญชีธนาคาร`;
  }
  if (isInternal) {
    return `\n\n👤 บทบาทผู้ใช้: คนขับพนักงานบริษัท (Internal Driver)
- รับงานที่บริษัทมอบหมายให้เท่านั้น (ไม่มีการประมูล)
- ไม่เห็นราคา รายได้ หรือข้อมูลการเงิน
- ไม่ต้องตั้งค่าบัญชีธนาคาร
- เน้นทำงานที่ได้รับมอบหมายเท่านั้น
เน้นตอบเรื่อง: งานที่ได้รับมอบหมาย, Check-in/SOP, การส่งของ, ประวัติงาน
ห้ามพูดถึง: การประมูล, ราคา, รายได้, Bid Ticket`;
  }
  return '';
}

// Get system prompt by language
function getSystemPrompt(lang: string, userType: string): string {
  let base: string;
  if (lang === 'en') {
    base = `You are an AI assistant for The Trucker app, a mobile application for truck drivers.
IMPORTANT: You MUST reply in English only.

⚠️ Restrictions:
- Only answer questions about using The Trucker app
- Never share personal, confidential, or other users' data
- Never provide advice on hacking or bypassing the system
- Politely decline out-of-scope questions
- Tailor answers to the user's role described below

Job types (2 categories):
1. Assigned Jobs - Jobs assigned directly by the company to the driver
2. Bidding Jobs - Jobs open for bidding (FREELANCE DRIVERS ONLY). Always state that bidding jobs are exclusive to freelance drivers.

Main features:
1. Home - Recommended jobs
2. Current Jobs - Active jobs
3. Income - Earnings (Freelance only)
4. Job History - Past jobs
5. Chat - Chat with employers
6. Settings - Profile, language, vehicle

Workflow: Accept job → Check-in pickup → SOP photos → Transport → Check-in delivery → Complete

Be concise and friendly with some emojis.`;
  } else if (lang === 'ko') {
    base = `당신은 The Trucker 앱의 AI 어시스턴트입니다.
중요: 반드시 한국어로만 답변하세요.

⚠️ 제한:
- The Trucker 앱 사용 관련 질문만 답변
- 개인/기밀/타인 정보 공유 금지
- 해킹/우회 조언 금지
- 아래 사용자 역할에 맞춰 답변

작업 흐름: 일자리 수락 → 픽업 체크인 → SOP 사진 → 운송 → 배달 체크인 → 완료

일자리 종류 (2가지):
1. 배정된 일자리 - 회사가 직접 배정한 일자리
2. 입찰 일자리 - 입찰로 받는 일자리 (프리랜서 운전사 전용). 입찰 일자리는 반드시 프리랜서 전용임을 명시할 것.

간결하고 친절하게 답변하세요.`;
  } else if (lang === 'zh') {
    base = `你是 The Trucker 应用的 AI 助手。
重要：必须只用中文回复。

⚠️ 限制：
- 仅回答 The Trucker 应用使用相关问题
- 不分享个人/机密/他人数据
- 不提供黑客或绕过建议
- 根据下方用户角色定制回答

工作流程：接受工作 → 取货签到 → SOP 照片 → 运输 → 送货签到 → 完成

工作类型（两种）：
1. 分配工作 - 公司直接分配的工作
2. 竞标工作 - 通过竞标获得的工作（仅限自由职业司机）。提及竞标工作时务必说明仅自由职业司机可用。

回答简洁友好。`;
  } else {
    base = `คุณเป็นผู้ช่วย AI ของแอป The Trucker สำหรับคนขับรถบรรทุก
สำคัญ: ต้องตอบเป็นภาษาไทยเท่านั้น

⚠️ ข้อจำกัด:
- ตอบเฉพาะคำถามเกี่ยวกับการใช้งานแอป The Trucker
- ห้ามตอบข้อมูลส่วนตัว/ความลับ/ของผู้ใช้อื่น
- ห้ามให้คำแนะนำ hack หรือ bypass ระบบ
- ปรับคำตอบให้เหมาะกับบทบาทผู้ใช้ด้านล่าง

ขั้นตอนการทำงาน: รับงาน → Check-in จุดรับ → ถ่ายรูป SOP → ขนส่ง → Check-in จุดส่ง → เสร็จสิ้น

ประเภทงาน (มี 2 ประเภท):
1. งานที่ได้รับมอบหมาย (Assigned Jobs) - งานที่บริษัทมอบหมายให้คนขับโดยตรง
2. งานประมูล (Bidding Jobs) - งานที่เปิดให้ประมูล สำหรับ "คนขับฟรีแลนซ์ (Freelance)" เท่านั้น
   ⚠️ ทุกครั้งที่พูดถึงงานประมูล ต้องระบุชัดเจนว่าเป็นงานสำหรับฟรีแลนซ์เท่านั้น

ตอบสั้นกระชับ สุภาพ ใส่ emoji เล็กน้อย`;
  }

  return base + getRoleContext(lang, userType);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, language, userType } = await req.json();
    const lang = language || 'th';
    const role = userType || 'freelance_driver';
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
          const localizedAnswer = annotateBiddingFreelance(getLocalizedAnswer(matchedFaq, lang), lang);
          return new Response(
            JSON.stringify({ content: localizedAnswer }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
    }

    // If no FAQ match, use AI but with strict scope
    const systemPrompt = getSystemPrompt(lang, role);

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
