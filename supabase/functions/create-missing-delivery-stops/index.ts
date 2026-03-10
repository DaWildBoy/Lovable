import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface DeliveryStop {
  job_id: string;
  stop_index: number;
  stop_type: 'PICKUP' | 'DROPOFF';
  location_text: string;
  location_lat: number;
  location_lng: number;
  status: 'NOT_STARTED';
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { jobId } = await req.json();

    if (!jobId) {
      return new Response(
        JSON.stringify({ error: 'jobId is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log(`Processing job ${jobId}...`);

    // Check if delivery_stops already exist
    const { data: existingStops, error: stopsError } = await supabase
      .from('delivery_stops')
      .select('*')
      .eq('job_id', jobId);

    if (stopsError) {
      throw stopsError;
    }

    if (existingStops && existingStops.length > 0) {
      console.log(`Job ${jobId} already has ${existingStops.length} delivery_stops`);
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Delivery stops already exist',
          stopsCount: existingStops.length
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Fetch the job to get pickup/dropoff data
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (jobError) {
      throw jobError;
    }

    if (!job) {
      return new Response(
        JSON.stringify({ error: 'Job not found' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const stopsToInsert: DeliveryStop[] = [];
    let stopIndex = 0;

    // Handle multi-stop jobs
    if (job.is_multi_stop && (job.multi_stop_pickups || job.multi_stop_dropoffs)) {
      console.log(`Creating multi-stop delivery_stops for job ${jobId}`);

      // Add pickups
      if (job.multi_stop_pickups && Array.isArray(job.multi_stop_pickups)) {
        for (const pickup of job.multi_stop_pickups) {
          stopsToInsert.push({
            job_id: jobId,
            stop_index: stopIndex++,
            stop_type: 'PICKUP',
            location_text: pickup.address || pickup.text || '',
            location_lat: pickup.lat || 0,
            location_lng: pickup.lng || 0,
            status: 'NOT_STARTED'
          });
        }
      }

      // Add dropoffs
      if (job.multi_stop_dropoffs && Array.isArray(job.multi_stop_dropoffs)) {
        for (const dropoff of job.multi_stop_dropoffs) {
          stopsToInsert.push({
            job_id: jobId,
            stop_index: stopIndex++,
            stop_type: 'DROPOFF',
            location_text: dropoff.address || dropoff.text || '',
            location_lat: dropoff.lat || 0,
            location_lng: dropoff.lng || 0,
            status: 'NOT_STARTED'
          });
        }
      }
    } else {
      // Handle single-stop jobs
      console.log(`Creating single-stop delivery_stops for job ${jobId}`);

      // Add pickup
      if (job.pickup_location_text) {
        stopsToInsert.push({
          job_id: jobId,
          stop_index: stopIndex++,
          stop_type: 'PICKUP',
          location_text: job.pickup_location_text,
          location_lat: job.pickup_lat || 0,
          location_lng: job.pickup_lng || 0,
          status: 'NOT_STARTED'
        });
      }

      // Add dropoff
      if (job.dropoff_location_text) {
        stopsToInsert.push({
          job_id: jobId,
          stop_index: stopIndex++,
          stop_type: 'DROPOFF',
          location_text: job.dropoff_location_text,
          location_lat: job.dropoff_lat || 0,
          location_lng: job.dropoff_lng || 0,
          status: 'NOT_STARTED'
        });
      }
    }

    if (stopsToInsert.length === 0) {
      console.log(`No stops to create for job ${jobId}`);
      return new Response(
        JSON.stringify({
          success: false,
          message: 'No pickup/dropoff data found on job'
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Insert the delivery_stops
    const { data: insertedStops, error: insertError } = await supabase
      .from('delivery_stops')
      .insert(stopsToInsert)
      .select();

    if (insertError) {
      throw insertError;
    }

    console.log(`✅ Created ${insertedStops?.length || 0} delivery_stops for job ${jobId}`);

    // Create POD stops if POD is required
    const podRequired = job.proof_of_delivery_required || 'NONE';
    if (podRequired !== 'NONE' && insertedStops) {
      const dropoffStops = insertedStops.filter((s: any) => s.stop_type === 'DROPOFF');
      if (dropoffStops.length > 0) {
        const podStopsToInsert = dropoffStops.map((stop: any) => ({
          stop_id: stop.id,
          job_id: jobId,
          required_type: podRequired,
          status: 'REQUIRED'
        }));

        const { data: insertedPODs, error: podStopsError } = await supabase
          .from('pod_stops')
          .insert(podStopsToInsert)
          .select();

        if (podStopsError) {
          console.error('Failed to create POD stops:', podStopsError);
        } else {
          console.log(`✅ Created ${insertedPODs?.length || 0} POD stop records`);
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Created ${insertedStops?.length || 0} delivery stops`,
        stopsCount: insertedStops?.length || 0
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error creating delivery stops:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
