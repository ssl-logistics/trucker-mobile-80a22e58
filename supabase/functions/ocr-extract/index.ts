import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface OCRRequest {
  image_base64: string;
  extraction_type: 'container_seal' | 'expense_amount' | 'general';
}

interface OCRResponse {
  success: boolean;
  data?: {
    container_number?: string;
    seal_number?: string;
    container_number_2?: string;
    seal_number_2?: string;
    amount?: number;
    raw_text?: string;
  };
  error?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const { image_base64, extraction_type }: OCRRequest = await req.json();

    if (!image_base64) {
      throw new Error('image_base64 is required');
    }

    // Build prompt based on extraction type
    let prompt = '';
    if (extraction_type === 'container_seal') {
      prompt = `Analyze this image and extract container and seal numbers.
      
Look for:
1. Container number (format: 4 letters + 7 digits, e.g., MSCU1234567)
2. Seal number (typically 6-10 characters/digits)
3. There may be a second container and seal number if it's a dual container shipment

Return ONLY a JSON object in this exact format (no markdown, no explanation):
{
  "container_number": "extracted container number or null",
  "seal_number": "extracted seal number or null",
  "container_number_2": "second container number or null",
  "seal_number_2": "second seal number or null"
}

If you cannot find a value, use null. Be precise with the extraction.`;
    } else if (extraction_type === 'expense_amount') {
      prompt = `Analyze this receipt/bill/payment slip image and extract the total amount.

Look for:
1. Total amount (ยอดรวม, รวมทั้งสิ้น, Total, Amount, จำนวนเงิน)
2. The number should be the final payment amount

Return ONLY a JSON object in this exact format (no markdown, no explanation):
{
  "amount": numeric_value_or_null,
  "raw_text": "the exact text where you found the amount"
}

If you cannot find the amount, use null for amount. Return only the number without currency symbols.`;
    } else {
      prompt = `Extract all visible text from this image and return it as:
{
  "raw_text": "all extracted text here"
}`;
    }

    // Call Lovable AI Gateway with vision
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: prompt,
              },
              {
                type: 'image_url',
                image_url: {
                  url: image_base64.startsWith('data:') 
                    ? image_base64 
                    : `data:image/jpeg;base64,${image_base64}`,
                },
              },
            ],
          },
        ],
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI Gateway error:', errorText);
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content || '';

    console.log('AI Response content:', content);

    // Parse the JSON response
    let extractedData: any = {};
    try {
      // Try to extract JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        extractedData = JSON.parse(jsonMatch[0]);
      }
    } catch (parseError) {
      console.error('Error parsing AI response:', parseError);
      extractedData = { raw_text: content };
    }

    const result: OCRResponse = {
      success: true,
      data: extractedData,
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('OCR extraction error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to extract text from image';
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
