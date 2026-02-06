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

    // Update FAQ about signup - remove approval waiting requirement
    const { data, error } = await supabase
      .from("chatbot_faqs")
      .update({
        answer: `การสมัครใช้งาน The Trucker:
1. กดปุ่ม "สมัครสมาชิก" ที่หน้าแรก
2. กรอกข้อมูลส่วนตัว เบอร์โทร และรหัสผ่าน
3. กรอกข้อมูลรถและเอกสาร
4. สามารถเริ่มรับงานได้เลยครับ! ไม่ต้องรอการอนุมัติจากทีมงาน`,
        updated_at: new Date().toISOString()
      })
      .eq("id", "800a06a0-933a-41d1-8cb4-32acdfa54d60")
      .select();

    if (error) {
      throw error;
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Updated signup FAQ - removed approval requirement",
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
