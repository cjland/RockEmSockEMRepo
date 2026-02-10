
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const { email, code, type } = await req.json();

        // 1. Get Resend API Key from Database
        const supabaseClient = createClient(
            // @ts-ignore
            Deno.env.get('SUPABASE_URL') ?? '',
            // @ts-ignore
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        const { data: secrets, error: secretError } = await supabaseClient
            .from('settings')
            .select('key')
            .ilike('service', 'resend')
            .single();

        if (secretError || !secrets?.key) {
            console.error("Missing Resend API Key", secretError);
            throw new Error("Missing Resend API Key configuration");
        }

        const RESEND_API_KEY = secrets.key;

        // 2. Prepare Email Content
        const subject = type === 'reset' ? 'Reset Your Password' : 'Verify Your Band Account';
        const html = type === 'reset'
            ? `<h1>Reset Password</h1><p>Your verification code is: <strong>${code}</strong></p>`
            : `<h1>Welcome to Band Dashboard</h1><p>Your verification code is: <strong>${code}</strong></p>`;

        // 3. Send Email via Resend
        const res = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${RESEND_API_KEY}`
            },
            body: JSON.stringify({
                from: 'Band Dashboard <noreply@cjland.me>', // Verified domain
                to: email,
                subject: subject,
                html: html
            })
        });

        const data = await res.json();

        if (!res.ok) {
            console.error("Resend API Error:", data);
            return new Response(JSON.stringify({
                success: false,
                error: data.message || "Resend API Error",
                details: data
            }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200, // Return 200 so client can read the body
            });
        }

        return new Response(JSON.stringify({ ...data, success: true }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        });
    } catch (error) {
        return new Response(JSON.stringify({
            success: false,
            error: error.message
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200, // Return 200 so client can read the body
        });
    }
});
