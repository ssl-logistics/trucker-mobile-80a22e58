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

    // Fetch all FAQs that contain TheTroob
    const { data: faqs, error: fetchError } = await supabase
      .from("chatbot_faqs")
      .select("*")
      .or("answer.ilike.%TheTroob%,question.ilike.%TheTroob%");

    if (fetchError) {
      throw fetchError;
    }

    console.log(`Found ${faqs?.length || 0} FAQs to update`);

    const updatedRecords = [];

    // Update each FAQ
    for (const faq of faqs || []) {
      const newAnswer = faq.answer.replace(/TheTroob/gi, "The Trucker");
      const newQuestion = faq.question.replace(/TheTroob/gi, "The Trucker");

      const { data, error } = await supabase
        .from("chatbot_faqs")
        .update({
          answer: newAnswer,
          question: newQuestion,
          updated_at: new Date().toISOString()
        })
        .eq("id", faq.id)
        .select();

      if (error) {
        console.error(`Error updating FAQ ${faq.id}:`, error);
      } else {
        updatedRecords.push(data?.[0]);
      }
    }

    // Also update email in contact FAQ
    const { data: contactFaq } = await supabase
      .from("chatbot_faqs")
      .select("*")
      .ilike("answer", "%thetroob.com%");

    for (const faq of contactFaq || []) {
      const newAnswer = faq.answer.replace(/thetroob\.com/gi, "thetrucker.com");

      await supabase
        .from("chatbot_faqs")
        .update({
          answer: newAnswer,
          updated_at: new Date().toISOString()
        })
        .eq("id", faq.id);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Updated ${updatedRecords.length} FAQs from TheTroob to The Trucker`,
        updated: updatedRecords
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
