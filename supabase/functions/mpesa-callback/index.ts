import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    console.log('M-PESA Callback received:', JSON.stringify(payload));

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Extract callback data
    const { Body } = payload;
    const { stkCallback } = Body;

    if (stkCallback.ResultCode === 0) {
      // Payment successful
      const callbackMetadata = stkCallback.CallbackMetadata.Item;
      const amount = callbackMetadata.find((item: any) => item.Name === 'Amount')?.Value;
      const transactionId = callbackMetadata.find((item: any) => item.Name === 'MpesaReceiptNumber')?.Value;
      const phone = callbackMetadata.find((item: any) => item.Name === 'PhoneNumber')?.Value;

      // Get school_id from AccountReference (we passed it in STK Push)
      const schoolId = stkCallback.CallbackMetadata.Item.find((item: any) => item.Name === 'AccountReference')?.Value;

      // Calculate expiry date (add 1 month)
      const expiryDate = new Date();
      expiryDate.setMonth(expiryDate.getMonth() + 1);

      // Save billing record
      await supabase.from('billing').insert({
        school_id: schoolId,
        amount: amount,
        plan_type: 'monthly',
        payment_method: 'mpesa',
        transaction_id: transactionId,
        expiry_date: expiryDate.toISOString()
      });

      // Update school subscription status
      await supabase
        .from('schools')
        .update({
          subscription_status: 'active',
          next_payment_date: expiryDate.toISOString(),
          last_payment_date: new Date().toISOString()
        })
        .eq('id', schoolId);

      console.log('Payment processed successfully:', transactionId);
    } else {
      console.log('Payment failed:', stkCallback.ResultDesc);
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Callback Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
