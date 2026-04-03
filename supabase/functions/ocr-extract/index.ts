import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface OCRRequest {
  image_base64: string;
  extraction_type: 'container_seal' | 'expense_amount' | 'expense_detailed' | 'payment_slip' | 'weight_slip' | 'container_return_slip' | 'general';
  expected_amount?: number;
  expected_account_number?: string;
}

interface OCRResponse {
  success: boolean;
  data?: {
    container_number?: string;
    seal_number?: string;
    container_number_2?: string;
    seal_number_2?: string;
    amount?: number;
    account_number?: string;
    bank_name?: string;
    receiver_name?: string;
    amount_matches?: boolean;
    account_matches?: boolean;
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

    const { image_base64, extraction_type, expected_amount, expected_account_number }: OCRRequest = await req.json();

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
    } else if (extraction_type === 'expense_detailed') {
      prompt = `Analyze this Thai receipt/bill/tax invoice image and extract ALL financial information.

This is a receipt from a logistics/transport service (port fees, container handling, gate fees, etc.)

Extract the following:
1. Grand Total / ยอดรวมทั้งสิ้น / จำนวนเงินรวมทั้งสิ้น - The final total amount to pay
2. Subtotal / รวมเป็นเงิน / Charges - Amount before VAT
3. VAT / ภาษีมูลค่าเพิ่ม - Tax amount (usually 7%)
4. Line items - Each individual charge with description and amount

Common line items include:
- Gate out / Gate in / ค่าผ่านประตู
- Container handling / ค่ายกตู้ / Lift on/off
- Additional services / บริการเพิ่มเติม
- Drop Empty / คืนตู้เปล่า
- Admission fee / ค่าเข้า
- Storage / ค่าฝากตู้

Return ONLY a JSON object in this exact format (no markdown, no explanation):
{
  "grand_total": numeric_value_or_null,
  "subtotal": numeric_value_or_null,
  "vat": numeric_value_or_null,
  "line_items": [
    {"description": "item description", "amount": numeric_value},
    {"description": "another item", "amount": numeric_value}
  ],
  "container_number": "container number if found or null",
  "receipt_number": "receipt/invoice number if found or null",
  "receipt_date": "date if found or null"
}

IMPORTANT:
- All amounts should be numeric values only (no currency symbols, no commas)
- Extract all individual line items you can find
- grand_total should be the final payable amount (after VAT)
- If there's only one total, use it as grand_total`;
    } else if (extraction_type === 'weight_slip') {
      prompt = `Analyze this Thai weight slip / weighbridge ticket (ใบชั่งน้ำหนัก) image and extract the following:

1. น้ำหนักรถเข้า (Weight In / Gross Weight) - the weight when the truck enters
2. น้ำหนักรถออก (Weight Out / Tare Weight) - the weight when the truck exits  
3. น้ำหนักสุทธิ (Net Weight) - the difference between weight in and weight out

Return ONLY a JSON object in this exact format (no markdown, no explanation):
{
  "weight_in": numeric_value_or_null,
  "weight_out": numeric_value_or_null,
  "net_weight": numeric_value_or_null
}

IMPORTANT:
- All values should be numeric only (no units, no commas)
- Values are typically in kilograms (kg) or tons
- If you see only one weight value, try to determine which type it is
- net_weight = weight_in - weight_out (gross - tare)`;
    } else if (extraction_type === 'container_return_slip') {
      prompt = `Analyze this Thai container return slip / ใบคืนตู้ / EIR (Equipment Interchange Receipt) image.

Extract the following information:
1. ชื่อลาน / Yard name / Depot name - The name of the container yard or depot where the container is being returned
2. Container number (เลขตู้) - format: 4 letters + 7 digits (e.g., MSCU1234567)
3. Seal number (เลขซีล) if present
4. Return date (วันที่คืน) if present

Common yard/depot names include: ท่าเรือแหลมฉบัง, ท่าเรือคลองเตย, ICD ลาดกระบัง, สวนส่งเสริม, TIPS, BKI, SCCT, ESCO, Hutchison, Evergreen, etc.

Return ONLY a JSON object in this exact format (no markdown, no explanation):
{
  "yard_name": "extracted yard/depot name or null",
  "container_number": "extracted container number or null",
  "seal_number": "extracted seal number or null",
  "return_date": "date if found or null"
}

If you cannot find a value, use null. Be precise with the extraction.`;
    } else if (extraction_type === 'payment_slip') {
      prompt = `Analyze this Thai bank transfer payment slip image and extract the following information:

Look for:
1. Transfer amount (จำนวนเงิน, ยอดโอน, Amount) - the amount that was transferred
2. Destination account number (เลขบัญชีปลายทาง, บัญชีผู้รับ) - the account number money was sent TO
3. Bank name (ธนาคาร) - the receiving bank
4. Receiver name (ชื่อผู้รับ, ชื่อบัญชี) - name of the account holder receiving the money

This is a Thai bank transfer slip (สลิปโอนเงิน). Common Thai banks include: กสิกรไทย, กรุงเทพ, ไทยพาณิชย์, กรุงไทย, กรุงศรี, ทหารไทยธนชาต, ออมสิน

Return ONLY a JSON object in this exact format (no markdown, no explanation):
{
  "amount": numeric_value_or_null,
  "account_number": "destination account number as string or null",
  "bank_name": "receiving bank name or null",
  "receiver_name": "receiver account name or null"
}

IMPORTANT: 
- For amount, return ONLY the numeric value (e.g., 500, not "500 บาท")
- For account_number, remove all dashes and spaces (e.g., "7191014752" not "719-1-01475-2")
- Be precise and extract from the DESTINATION/RECEIVER section, not the sender`;
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

    // For payment_slip, add validation checks
    if (extraction_type === 'payment_slip') {
      // Check if amount matches expected amount
      if (expected_amount !== undefined && extractedData.amount !== undefined) {
        extractedData.amount_matches = Math.abs(extractedData.amount - expected_amount) < 0.01;
      }
      
      // Check if account number matches expected account
      if (expected_account_number && extractedData.account_number) {
        // Normalize both account numbers (remove dashes and spaces)
        const normalizedExpected = expected_account_number.replace(/[-\s]/g, '');
        const normalizedExtracted = extractedData.account_number.replace(/[-\s]/g, '');
        extractedData.account_matches = normalizedExpected === normalizedExtracted;
      }
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
