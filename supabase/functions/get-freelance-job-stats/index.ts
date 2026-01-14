import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);

    // Support both query params (GET) and JSON body (POST) to avoid client-side mismatches
    let body: any = null;
    if (req.method !== 'GET') {
      try {
        body = await req.json();
      } catch {
        body = null;
      }
    }

    const freelanceDriverId = url.searchParams.get('freelance_driver_id') || body?.freelance_driver_id;
    const timePeriod = url.searchParams.get('time_period') || body?.time_period || 'month'; // day, month, year
    const vehicleType = url.searchParams.get('vehicle_type') || body?.vehicle_type || 'all';
    const dateStr = url.searchParams.get('date') || body?.date; // ISO date string

    if (!freelanceDriverId) {
      return new Response(
        JSON.stringify({ error: 'freelance_driver_id is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const apiKey = Deno.env.get('EXPRESS_RENT_API_KEY');
    if (!apiKey) {
      console.error('EXPRESS_RENT_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'API key not configured' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Call external API to get accepted jobs
    const externalUrl = `https://xyfkwewtexnyskbkgsrq.supabase.co/functions/v1/get-freelance-accepted-jobs?freelance_driver_id=${encodeURIComponent(
      freelanceDriverId
    )}`;

    console.log('Fetching job stats for driver:', freelanceDriverId);

    const response = await fetch(externalUrl, {
      method: 'GET',
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('External API error:', data);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch jobs', details: data }),
        {
          status: response.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Process jobs data to generate statistics
    const jobs = data.data || data || [];
    const selectedDate = dateStr ? new Date(dateStr) : new Date();

    const parseJobDate = (job: any): Date | null => {
      const datePart =
        job.sender_pickup_date ||
        job.pickup_date ||
        job.start_date ||
        job.created_at ||
        job.destination_delivery_date;

      const timePart = job.sender_pickup_time || job.pickup_time || job.start_time;

      if (!datePart) return null;

      // If we have separate date + time, combine to ISO-ish string
      if (
        typeof datePart === 'string' &&
        typeof timePart === 'string' &&
        !datePart.includes('T') &&
        timePart.includes(':')
      ) {
        return new Date(`${datePart}T${timePart}`);
      }

      return new Date(datePart);
    };

    // Filter jobs by date range based on time period
    const filterJobsByDate = (job: any) => {
      const jobDate = parseJobDate(job);
      if (!jobDate || Number.isNaN(jobDate.getTime())) return false;

      if (timePeriod === 'day') {
        return jobDate.toDateString() === selectedDate.toDateString();
      } else if (timePeriod === 'month') {
        return (
          jobDate.getMonth() === selectedDate.getMonth() &&
          jobDate.getFullYear() === selectedDate.getFullYear()
        );
      } else {
        return jobDate.getFullYear() === selectedDate.getFullYear();
      }
    };

    const normalizeVehicle = (value: any) =>
      String(value || '')
        // remove normal + non-breaking + zero-width spaces
        .replace(/[\s\u00A0\u200B\uFEFF]+/g, '')
        .replace(/^รถ/, '');

    const extractWheelCount = (value: string) => {
      const match = value.match(/\d+/);
      return match ? match[0] : null;
    };

    // Filter jobs by vehicle type (UI might send "10ล้อ" but API may return "รถ 10 ล้อ")
    const filterJobsByVehicle = (job: any) => {
      if (vehicleType === 'all') return true;

      const desired = normalizeVehicle(vehicleType);
      const desiredWheel = extractWheelCount(desired);

      const candidates = [job.vehicle_type, job.truck_type, job.transport_vehicle_type]
        .filter(Boolean)
        .map(normalizeVehicle);

      if (desiredWheel) {
        // Match by wheel count first (10/12/6/4)
        return candidates.some((v: string) => v.includes(desiredWheel));
      }

      // Non-numeric types (e.g., หัวลาก)
      return candidates.some((v: string) => v.includes(desired) || desired.includes(v));
    };

    const filteredJobs = jobs.filter((job: any) => filterJobsByDate(job) && filterJobsByVehicle(job));

    // Calculate statistics
    // Note: 'completed' = POD submitted (success), 'delivered' = arrived but POD not done (still in progress)
    const totalJobs = filteredJobs.length;
    const successJobs = filteredJobs.filter((job: any) => 
      job.status === 'completed' || 
      job.job_status === 'JOB_COMPLETED'
    ).length;
    const inProgressJobs = filteredJobs.filter((job: any) => 
      job.status === 'in_progress' || 
      job.status === 'accepted' ||
      job.status === 'delivered' || // delivered but POD not done = still in progress
      job.job_status === 'IN_PROGRESS' ||
      job.job_status === 'ACCEPTED' ||
      job.job_status === 'PICKED_UP' ||
      job.job_status === 'DELIVERED'
    ).length;
    const cancelledJobs = filteredJobs.filter((job: any) => 
      job.status === 'cancelled' || 
      job.job_status === 'CANCELLED'
    ).length;

    // Calculate region statistics based on destination province/region
    const regionMapping: { [key: string]: string } = {
      // ภาคเหนือ (North)
      'เชียงใหม่': 'north', 'เชียงราย': 'north', 'ลำปาง': 'north', 'ลำพูน': 'north',
      'แม่ฮ่องสอน': 'north', 'น่าน': 'north', 'พะเยา': 'north', 'แพร่': 'north', 'อุตรดิตถ์': 'north',
      // ภาคกลาง (Central)
      'กรุงเทพมหานคร': 'central', 'กรุงเทพ': 'central', 'นนทบุรี': 'central', 'ปทุมธานี': 'central',
      'พระนครศรีอยุธยา': 'central', 'อยุธยา': 'central', 'สระบุรี': 'central', 'ลพบุรี': 'central',
      'สิงห์บุรี': 'central', 'อ่างทอง': 'central', 'ชัยนาท': 'central', 'สมุทรปราการ': 'central',
      'สมุทรสาคร': 'central', 'สมุทรสงคราม': 'central', 'นครปฐม': 'central', 'นครนายก': 'central',
      // ภาคตะวันออกเฉียงเหนือ (Northeast/Isan)
      'นครราชสีมา': 'northeast', 'โคราช': 'northeast', 'ขอนแก่น': 'northeast', 'อุดรธานี': 'northeast',
      'อุบลราชธานี': 'northeast', 'บุรีรัมย์': 'northeast', 'สุรินทร์': 'northeast', 'ศรีสะเกษ': 'northeast',
      'ชัยภูมิ': 'northeast', 'ร้อยเอ็ด': 'northeast', 'มหาสารคาม': 'northeast', 'กาฬสินธุ์': 'northeast',
      'สกลนคร': 'northeast', 'นครพนม': 'northeast', 'มุกดาหาร': 'northeast', 'ยโสธร': 'northeast',
      'อำนาจเจริญ': 'northeast', 'หนองคาย': 'northeast', 'หนองบัวลำภู': 'northeast', 'เลย': 'northeast', 'บึงกาฬ': 'northeast',
      // ภาคตะวันออก (East)
      'ชลบุรี': 'east', 'ระยอง': 'east', 'จันทบุรี': 'east', 'ตราด': 'east',
      'ฉะเชิงเทรา': 'east', 'ปราจีนบุรี': 'east', 'สระแก้ว': 'east',
      // ภาคตะวันตก (West)
      'กาญจนบุรี': 'west', 'ราชบุรี': 'west', 'สุพรรณบุรี': 'west', 'เพชรบุรี': 'west',
      'ประจวบคีรีขันธ์': 'west', 'ตาก': 'west',
      // ภาคใต้ (South)
      'นครศรีธรรมราช': 'south', 'สุราษฎร์ธานี': 'south', 'ภูเก็ต': 'south', 'กระบี่': 'south',
      'พังงา': 'south', 'สงขลา': 'south', 'หาดใหญ่': 'south', 'ปัตตานี': 'south', 'ยะลา': 'south',
      'นราธิวาส': 'south', 'ตรัง': 'south', 'พัทลุง': 'south', 'สตูล': 'south', 'ชุมพร': 'south', 'ระนอง': 'south'
    };

    const getRegion = (job: any): string => {
      const province = job.destination_province || job.drop_off_province || job.destination_location || '';
      for (const [provinceName, region] of Object.entries(regionMapping)) {
        if (province.includes(provinceName)) {
          return region;
        }
      }
      return 'central'; // Default to central if not found
    };

    const regionCounts: { [key: string]: number } = {
      north: 0,
      central: 0,
      northeast: 0,
      east: 0,
      west: 0,
      south: 0
    };

    filteredJobs.forEach((job: any) => {
      const region = getRegion(job);
      regionCounts[region]++;
    });

    // Calculate percentage changes (comparing to previous period)
    // For now, return 0 as we don't have historical data comparison
    const stats = {
      jobStats: {
        total: totalJobs,
        success: successJobs,
        inProgress: inProgressJobs,
        cancelled: cancelledJobs
      },
      regionStats: regionCounts,
      rawJobsCount: jobs.length, // Total jobs before filtering
      filteredJobsCount: filteredJobs.length
    };

    console.log('Successfully calculated job stats:', stats);

    return new Response(
      JSON.stringify(stats),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in get-freelance-job-stats:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: errorMessage }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
