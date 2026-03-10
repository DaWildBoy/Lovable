import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const MOVEME_TT_KNOWLEDGE = `You are MoveMeTT Support. You help users of the MoveMe TT delivery platform in Trinidad and Tobago.

## Platform Overview
MoveMe TT connects customers needing deliveries with verified courier drivers. Handles small packages to large cargo. All prices in TTD.

## Key Info
- Pricing: Base price (distance-based) + 15% platform fee + 12.5% VAT. Couriers earn base minus platform fee.
- Job types: Fixed Price (instant booking) or Open to Bids (couriers compete).
- Job flow: Open -> Assigned -> On Way to Pickup -> Cargo Collected -> In Transit -> Delivered -> Completed.
- Cargo categories: Documents, Packages, Food, Electronics, Furniture, Building Materials, Vehicles, Other.
- Special requirements: Fragile, needs cover, heavy lift, security gate.

## Common Questions
### Customers:
- Create job: Home > "Create New Job" > enter locations, describe cargo, set price.
- Payment: Add card in profile before first job.
- Tracking: Real-time location available when courier enables it.
- Rating: 1-5 stars after delivery.

### Couriers:
- Verification: Complete profile, upload license/registration/insurance.
- Find jobs: Browse available jobs, filter by status.
- Accept: Fixed-price = instant accept. Bid jobs = submit your price.
- Payment: Add bank account in profile, admin verifies, paid after delivery.

## ESCALATION RULES
If the user asks to talk to a human, requests human help, or says "talk to a person", respond with EXACTLY "[ESCALATE_TO_HUMAN]" at the START, then a friendly confirmation.

Also escalate if:
- Payment disputes or refunds
- Verification/document rejections
- Safety concerns
- Repeated frustration (3+ messages same topic)
- Account-level changes needed

Do NOT escalate for general questions.

## Style
- Friendly, professional, concise (2-4 sentences typical)
- Step-by-step for how-to questions
- Use TTD currency, T&T context
- If unsure, offer to connect with human support
`;

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !user) throw new Error('Unauthorized');

    const { data: userProfile } = await supabaseClient
      .from('profiles')
      .select('role, business_type')
      .eq('id', user.id)
      .maybeSingle();

    const body = await req.json();
    const { action, sessionId, message } = body;

    if (action === 'get_or_create_session') {
      const { data: existing } = await supabaseClient
        .from('support_sessions')
        .select('id, status')
        .eq('user_id', user.id)
        .in('status', ['ai_active', 'human_requested', 'human_active'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existing) {
        const { data: msgs } = await supabaseClient
          .from('support_messages')
          .select('id, sender_type, sender_id, content, created_at')
          .eq('session_id', existing.id)
          .order('created_at', { ascending: true });

        return new Response(
          JSON.stringify({ sessionId: existing.id, messages: msgs || [], status: existing.status }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      let userRole = userProfile?.role || 'customer';
      if (userRole === 'business') {
        userRole = userProfile?.business_type === 'retail' ? 'retailer' : 'haulage';
      }

      const { data: activeJob } = await supabaseClient
        .from('jobs')
        .select('id')
        .eq('customer_user_id', user.id)
        .in('status', ['assigned', 'on_way_to_pickup', 'cargo_collected', 'in_transit'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const { data: session, error: sessErr } = await supabaseClient
        .from('support_sessions')
        .insert({
          user_id: user.id,
          user_role: userRole,
          active_job_id: activeJob?.id || null,
          status: 'ai_active',
        })
        .select()
        .single();

      if (sessErr) throw new Error('Failed to create support session');

      const welcomeMsg = "Hi there! I'm the MoveMe TT support assistant. I can help with deliveries, pricing, account questions, and more. What can I help you with?";

      await supabaseClient.from('support_messages').insert({
        session_id: session.id,
        sender_type: 'ai',
        sender_id: null,
        content: welcomeMsg,
      });

      const { data: msgs } = await supabaseClient
        .from('support_messages')
        .select('id, sender_type, sender_id, content, created_at')
        .eq('session_id', session.id)
        .order('created_at', { ascending: true });

      return new Response(
        JSON.stringify({ sessionId: session.id, messages: msgs || [], status: 'ai_active' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'request_human') {
      if (!sessionId) throw new Error('Missing sessionId');

      await supabaseClient
        .from('support_sessions')
        .update({ status: 'human_requested', updated_at: new Date().toISOString() })
        .eq('id', sessionId);

      const systemMsg = 'You have requested a human agent. A MoveMeTT dispatcher will be with you shortly.';

      await supabaseClient.from('support_messages').insert({
        session_id: sessionId,
        sender_type: 'ai',
        sender_id: null,
        content: systemMsg,
      });

      return new Response(
        JSON.stringify({ status: 'human_requested', message: systemMsg }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'resolve') {
      if (!sessionId) throw new Error('Missing sessionId');

      await supabaseClient
        .from('support_sessions')
        .update({ status: 'resolved', updated_at: new Date().toISOString() })
        .eq('id', sessionId);

      return new Response(
        JSON.stringify({ status: 'resolved' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'send_message') {
      if (!sessionId || !message) throw new Error('Missing sessionId or message');

      await supabaseClient.from('support_messages').insert({
        session_id: sessionId,
        sender_type: 'user',
        sender_id: user.id,
        content: message,
      });

      const { data: sessionData } = await supabaseClient
        .from('support_sessions')
        .select('status, user_role, active_job_id')
        .eq('id', sessionId)
        .single();

      if (sessionData?.status === 'human_requested' || sessionData?.status === 'human_active') {
        return new Response(
          JSON.stringify({ response: null, status: sessionData.status }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: recentMessages } = await supabaseClient
        .from('support_messages')
        .select('sender_type, content')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: false })
        .limit(10);

      const userRole = sessionData?.user_role || 'customer';
      const activeJobId = sessionData?.active_job_id || 'none';

      const systemPrompt = `${MOVEME_TT_KNOWLEDGE}\n\nContext: The user is a ${userRole}. Their current active job ID is ${activeJobId}. Keep answers short. Prices are in TTD.`;

      const conversationHistory: ChatMessage[] = [
        { role: 'system', content: systemPrompt },
      ];

      if (recentMessages) {
        recentMessages.reverse().forEach((msg: any) => {
          if (msg.sender_type === 'user') {
            conversationHistory.push({ role: 'user', content: msg.content });
          } else if (msg.sender_type === 'ai') {
            conversationHistory.push({ role: 'assistant', content: msg.content });
          }
        });
      }

      const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
      if (!openaiApiKey) {
        const fallback = "Our AI support is being configured. Let me connect you with our support team instead.";
        await supabaseClient.from('support_messages').insert({
          session_id: sessionId,
          sender_type: 'ai',
          sender_id: null,
          content: fallback,
        });

        await supabaseClient
          .from('support_sessions')
          .update({ status: 'human_requested', updated_at: new Date().toISOString() })
          .eq('id', sessionId);

        return new Response(
          JSON.stringify({ response: fallback, status: 'human_requested' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: conversationHistory,
          temperature: 0.7,
          max_tokens: 500,
        }),
      });

      if (!openaiRes.ok) {
        console.error('OpenAI error:', await openaiRes.text());
        throw new Error('AI service temporarily unavailable');
      }

      const aiData = await openaiRes.json();
      let botResponse = aiData.choices[0].message.content;
      let newStatus = 'ai_active';

      if (botResponse.includes('[ESCALATE_TO_HUMAN]')) {
        botResponse = botResponse.replace('[ESCALATE_TO_HUMAN]', '').trim();
        newStatus = 'human_requested';

        await supabaseClient
          .from('support_sessions')
          .update({ status: 'human_requested', updated_at: new Date().toISOString() })
          .eq('id', sessionId);
      }

      await supabaseClient.from('support_messages').insert({
        session_id: sessionId,
        sender_type: 'ai',
        sender_id: null,
        content: botResponse,
      });

      return new Response(
        JSON.stringify({ response: botResponse, status: newStatus }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    throw new Error('Invalid action. Use: get_or_create_session, send_message, request_human, resolve');
  } catch (error) {
    console.error('Support bot error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
