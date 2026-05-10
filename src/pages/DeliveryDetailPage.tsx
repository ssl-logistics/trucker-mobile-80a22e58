import { ACCEPT_IMAGE_DOC } from '@/utils/uploadAccept';
import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { ChevronLeft, Phone, MapPin, Camera, Check, CheckCircle } from "lucide-react";
import { EditablePhoto } from "@/components/photo/EditablePhoto";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useUserRole } from "@/hooks/useUserRole";
import { useCheckinStatus } from "@/hooks/useCheckinStatus";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import JobActionButtons from "@/components/job/JobActionButtons";
import GoogleMap from "@/components/GoogleMap";
import { formatDate, formatDateTime } from "@/lib/dateUtils";
import { sendJobStatus } from '@/lib/jobStatusService';
import { getDriverCheckins, driverCheckin, getDriverAssignedJobs, getFreelanceAcceptedJobs, updateDestinationCoordinates, updateOrderStatus } from '@/lib/externalApi';
import AccidentEvidenceModal from '@/components/job/AccidentEvidenceModal';
import { usePresignedImageUrl } from "@/hooks/usePresignedImageUrl";
import { useGpsTracking } from "@/hooks/useGpsTracking";
import { useNativeCamera } from "@/hooks/useNativeCamera";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import routeIcon from '@/assets/route-icon-2.png';
import checkInIcon from '@/assets/check-in-icon.png';

interface DestinationProduct {
  product_name: string;
  product_quantity?: number;
  weight?: number;
  weight_unit?: string;
  unit?: string;
}

interface JobDetail {
  id: string;
  order_code: string;
  employer_name: string;
  destination_location: string;
  start_date: string;
  start_time: string;
  destination_latitude?: number;
  destination_longitude?: number;
  destination_contact_person?: string | null;
  destination_address?: string | null;
  destination_goods_type?: string | null;
  destination_goods_quantity?: string | null;
  destination_remarks?: string | null;
  destination_time?: string | null;
  destination_company_name?: string | null;
  price?: number;
  invoice_number?: string | null;
  destination_products?: DestinationProduct[];
}

interface JobDestination {
  id: string;
  job_id: string;
  sequence_number: number;
  company_name: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  address: string | null;
  province: string | null;
  district: string | null;
  latitude: number | null;
  longitude: number | null;
  delivery_date: string | null;
  delivery_time: string | null;
  notes: string | null;
  checked_in_at: string | null;
  sop_completed_at: string | null;
}

interface JobApplication {
  delivery_checked_in_at: string | null;
  payment_completed_at: string | null;
  payment_method: string | null;
  pod_photo_url: string | null;
  delivery_sop_completed_at: string | null;
  pod_driver_id: string | null;
}

export default function DeliveryDetailPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { jobId, destinationId } = useParams();
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const { isInternalDriver, isExternalDriver, canViewPrice } = useUserRole();
  const [job, setJob] = useState<JobDetail | null>(null);
  const [destination, setDestination] = useState<JobDestination | null>(null);
  const [isMultiDestination, setIsMultiDestination] = useState(false);
  const [jobApplication, setJobApplication] = useState<JobApplication | null>(null);
  const [loading, setLoading] = useState(true);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showPaymentDrawer, setShowPaymentDrawer] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string | null>(null);
  const [showPodConfirmDialog, setShowPodConfirmDialog] = useState(false);
  const [podPhoto, setPodPhoto] = useState<File | null>(null);
  const [podPhotoPreview, setPodPhotoPreview] = useState<string | null>(null);
  const [isSubmittingPod, setIsSubmittingPod] = useState(false);
  const [containerReturn, setContainerReturn] = useState<{
    location: string | null;
    address: string | null;
    latitude: number | null;
    longitude: number | null;
    phone: string | null;
    date: string | null;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [photoSourceDrawerOpen, setPhotoSourceDrawerOpen] = useState(false);
  const [accidentEvidenceRequired, setAccidentEvidenceRequired] = useState(false);
  const [accidentOrderInfo, setAccidentOrderInfo] = useState<{ id?: string; order_number?: string } | null>(null);
  
  // Check if viewing from history
  const isFromHistory = new URLSearchParams(location.search).get('from') === 'history';
  const isOwnPodData = !jobApplication?.pod_driver_id || jobApplication.pod_driver_id === user?.id;
  
  // GPS tracking hook
  const { stopTracking } = useGpsTracking();
  
  // Check-in status hook
  const { deliveryCheckedIn, saveCheckin } = useCheckinStatus(
    job?.order_code || jobId,
    user?.id
  );
  
  // Get presigned URL for POD photo
  const { url: presignedPodPhotoUrl } = usePresignedImageUrl(jobApplication?.pod_photo_url);

  useEffect(() => {
    loadJobDetail();
  }, [jobId, destinationId, user, isInternalDriver, isExternalDriver]);

  const loadJobDetail = async () => {
    if (!user || !jobId) return;

    setLoading(true);
    
    try {
      // Use different API based on driver type - call external API directly
      let foundJob: any = null;
      const stateJob = (location.state as any)?.jobData || (location.state as any)?.job;
      const stateDestId = (location.state as any)?.destId;
      
    // Use navigation state first (fast path)
      if (stateJob && (stateJob.order_number === jobId || stateJob.id === jobId)) {
        console.log('[DeliveryDetailPage] Using navigation state data (fast path)');
        foundJob = stateJob;
      } else if (isInternalDriver || isExternalDriver) {
        const driverType = isInternalDriver ? 'internal' : 'external';
        // Single API call with comma-separated statuses, then filter client-side
        const statuses = [
          'in_transit',
          'delivered',
          'returning_container',
          'at_container_return',
        ].join(',');
        const res = await getDriverAssignedJobs(user.id, driverType, 100, statuses);
        const combinedData = ((res.data as any)?.data || []) as any[];
        foundJob = combinedData.find((j: any) => j.order_number === jobId);
        
        // Fallback to navigation state if not found
        if (!foundJob && stateJob) {
          console.log('[DeliveryDetailPage] Job not found in API, using navigation state fallback');
          foundJob = stateJob;
        }
      } else {
        const { data, error } = await getFreelanceAcceptedJobs(user.id);
        if (error) throw new Error(error);
        const jobsData = (data as any)?.data || data || [];
        const apiData = Array.isArray(jobsData) ? jobsData : [];
        foundJob = apiData.find((j: any) => j.order_number === jobId);
      }

      // Fallback to navigation state if not found in API
      if (!foundJob && stateJob) {
        console.log('[DeliveryDetailPage] Job not found in API, using navigation state fallback');
        foundJob = stateJob;
      }

      if (foundJob) {
          // Determine the sequence number from URL param (destinationId) or default to 1
          const targetSequenceNumber = destinationId ? parseInt(destinationId, 10) : 1;
          
          // Check if job has multiple destinations
          let destinationsArray = foundJob.destinations || [];
          // For BL (inbound) jobs with empty destinations, synthesize cargo point
          // from sender_* fields (place of receipt) so the delivery screen shows
          // the correct cargo location instead of the parent order's destination.
          if ((!destinationsArray || destinationsArray.length === 0) && foundJob.bl_no) {
            const cargoName = foundJob.sender_name || foundJob.destination_name || null;
            const cargoAddress = foundJob.sender_address || foundJob.destination_address || null;
            const cargoProvince = foundJob.sender_province || foundJob.destination_province || null;
            const cargoDistrict = foundJob.sender_district || foundJob.destination_district || null;
            if (cargoName || cargoAddress || cargoProvince || cargoDistrict) {
              destinationsArray = [{
                id: `bl-cargo-${foundJob.id || jobId}`,
                sequence_number: 1,
                company_name: cargoName,
                contact_name: foundJob.sender_contact_name || foundJob.destination_contact_name || null,
                contact_phone: foundJob.sender_contact_phone || foundJob.destination_contact_phone || null,
                address: cargoAddress,
                province: cargoProvince,
                district: cargoDistrict,
                latitude: foundJob.sender_latitude ?? foundJob.destination_latitude ?? null,
                longitude: foundJob.sender_longitude ?? foundJob.destination_longitude ?? null,
                delivery_date: foundJob.destination_delivery_date || foundJob.sender_pickup_date || null,
                delivery_time: foundJob.destination_delivery_time || foundJob.sender_pickup_time || null,
              }];
            }
          }
          let targetDestination: any = null;
          const hasMultipleDestinations = destinationsArray.length > 0;
          
          // Set multi-destination flag for flow control
          setIsMultiDestination(hasMultipleDestinations);
          
          if (hasMultipleDestinations) {
            // Multi-destination job - find the matching destination
            // Prefer lookup by destination ID (stable across reorders) over sequence_number
            targetDestination = (stateDestId 
              ? destinationsArray.find((d: any) => d.id === stateDestId)
              : null) 
              || destinationsArray.find((d: any) => d.sequence_number === targetSequenceNumber) 
              || destinationsArray[0];
            console.log('Multi-destination job, target sequence:', targetSequenceNumber, 'destId:', stateDestId, 'found:', targetDestination?.sequence_number, targetDestination?.id);
          }
          
          // Use target destination data if available, otherwise use job-level data
          const destData = targetDestination || foundJob;
          
          // Map API response to JobDetail interface
          console.log('[DeliveryDetailPage] foundJob coordinate fields:', {
            destination_latitude: foundJob.destination_latitude,
            destination_longitude: foundJob.destination_longitude,
            cargo_loading: foundJob.cargo_loading,
            container_return: foundJob.container_return,
            destData_lat: destData.latitude,
            destData_lng: destData.longitude,
            // Log all keys that contain 'lat' or 'lon' or 'cargo' or 'return'
            relevantKeys: Object.keys(foundJob).filter((k: string) => /lat|lon|cargo|return|dest/i.test(k)),
          });
          const mappedJob: JobDetail = {
            id: foundJob.id || jobId,
            order_code: foundJob.order_number || foundJob.order_code || jobId,
            employer_name: foundJob.factory_name || destData.company_name || destData.destination_name || foundJob.destination_company_name,
            destination_location: `${destData.district || foundJob.destination_district || ''}, ${destData.province || foundJob.destination_province || ''}`.replace(/^, |, $/g, ''),
            start_date: destData.delivery_date || foundJob.destination_delivery_date || foundJob.sender_pickup_date,
            start_time: destData.delivery_time || foundJob.destination_delivery_time || foundJob.sender_pickup_time,
            destination_latitude: destData.latitude || foundJob.destination_latitude || foundJob.cargo_loading?.latitude || foundJob.container_return?.latitude || null,
            destination_longitude: destData.longitude || foundJob.destination_longitude || foundJob.cargo_loading?.longitude || foundJob.container_return?.longitude || null,
            destination_contact_person: destData.contact_name || foundJob.destination_contact_name,
            destination_address: destData.address || foundJob.destination_address,
            destination_goods_type: (() => {
              // v9: products nested inside destination
              const destNestedProducts = Array.isArray(targetDestination?.products) ? targetDestination.products : [];
              const topLevelProducts = foundJob.products || [];
              const destId = targetDestination?.id;
              
              const matchedProducts = destNestedProducts.length > 0
                ? destNestedProducts
                : (topLevelProducts.length > 0 && destId
                    ? topLevelProducts.filter((p: any) => String(p.destination_id) === String(destId))
                    : []);
              
              if (matchedProducts.length > 0) {
                return matchedProducts.map((p: any) => p.product_name || p.name).filter(Boolean).join(', ');
              }
              return foundJob.product_name;
            })(),
            destination_goods_quantity: (() => {
              const destNestedProducts = Array.isArray(targetDestination?.products) ? targetDestination.products : [];
              const topLevelProducts = foundJob.products || [];
              const destId = targetDestination?.id;
              
              const matchedProducts = destNestedProducts.length > 0
                ? destNestedProducts
                : (topLevelProducts.length > 0 && destId
                    ? topLevelProducts.filter((p: any) => String(p.destination_id) === String(destId))
                    : []);
              
              if (matchedProducts.length > 0) {
                const totalQty = matchedProducts.reduce((sum: number, p: any) => sum + (Number(p.product_quantity) || 0), 0);
                return totalQty > 0 ? String(totalQty) : null;
              }
              return foundJob.product_quantity ? String(foundJob.product_quantity) : null;
            })(),
            destination_remarks: destData.notes || foundJob.remarks,
            destination_time: destData.delivery_time || foundJob.destination_delivery_time,
            destination_company_name: destData.company_name || foundJob.destination_company_name || foundJob.destination_name,
            price: foundJob.transport_price || 0,
            invoice_number: targetDestination?.invoice_number || destData.invoice_number || null,
            destination_products: (() => {
              const topLevelProducts = foundJob.products || [];
              const destId = targetDestination?.id;
              
              // v9: products nested inside destination object
              const destNestedProducts = Array.isArray(targetDestination?.products) ? targetDestination.products : [];
              
              // Prefer nested products, then filter top-level by destination_id
              let matchedProducts = destNestedProducts.length > 0
                ? destNestedProducts
                : (topLevelProducts.length > 0 && destId
                    ? topLevelProducts.filter((p: any) => String(p.destination_id) === String(destId))
                    : []);
              
              if (matchedProducts.length > 0) {
                return matchedProducts.map((p: any) => ({
                  product_name: p.product_name || p.name,
                  product_quantity: p.product_quantity || p.quantity || p.qty || null,
                  weight: p.weight || p.product_weight || null,
                  weight_unit: p.weight_unit || p.product_weight_unit || null,
                  unit: p.unit || p.product_unit || null,
                }));
              }
              
              // Fallback only for single destination jobs
              if (!targetDestination && foundJob.product_name) {
                return foundJob.product_name.split(/[,，]/).map((name: string) => ({ product_name: name.trim() })).filter((p: DestinationProduct) => p.product_name);
              }
              return [];
            })(),
          };
          setJob(mappedJob);

          if (foundJob.requires_accident_evidence === true && !foundJob.accident_evidence_uploaded_at) {
            setAccidentOrderInfo({
              id: foundJob.id,
              order_number: foundJob.order_number || foundJob.order_code,
            });
            setAccidentEvidenceRequired(true);
          } else {
            setAccidentEvidenceRequired(false);
            setAccidentOrderInfo(null);
          }
          
          // Set container return data for international jobs
          if (foundJob.container_return_location || foundJob.container_return_latitude) {
            setContainerReturn({
              location: foundJob.container_return_location || null,
              address: foundJob.container_return_address || null,
              latitude: foundJob.container_return_latitude || null,
              longitude: foundJob.container_return_longitude || null,
              phone: foundJob.container_return_phone || null,
              date: foundJob.container_return_date || null,
            });
          }
          
          // Set destination state for sequence tracking
          if (targetDestination) {
            setDestination({
              id: targetDestination.id || `dest-${targetSequenceNumber}`,
              job_id: foundJob.id,
              sequence_number: targetDestination.sequence_number || targetSequenceNumber,
              company_name: targetDestination.company_name,
              contact_name: targetDestination.contact_name,
              contact_phone: targetDestination.contact_phone,
              address: targetDestination.address,
              province: targetDestination.province,
              district: targetDestination.district,
              latitude: targetDestination.latitude,
              longitude: targetDestination.longitude,
              delivery_date: targetDestination.delivery_date,
              delivery_time: targetDestination.delivery_time,
              notes: targetDestination.notes,
              checked_in_at: null,
              sop_completed_at: null,
            });
          } else {
            // Single destination - create a default destination with sequence 1
            setDestination({
              id: `dest-1`,
              job_id: foundJob.id,
              sequence_number: 1,
              company_name: foundJob.destination_company_name,
              contact_name: foundJob.destination_contact_name,
              contact_phone: foundJob.destination_contact_phone,
              address: foundJob.destination_address,
              province: foundJob.destination_province,
              district: foundJob.destination_district,
              latitude: foundJob.destination_latitude,
              longitude: foundJob.destination_longitude,
              delivery_date: foundJob.destination_delivery_date,
              delivery_time: foundJob.destination_delivery_time,
              notes: foundJob.remarks,
              checked_in_at: null,
              sop_completed_at: null,
            });
          }
          
          // Get the actual sequence number for filtering checkins
          const currentSequenceNumber = targetDestination?.sequence_number || 1;

            // Check for delivery check-in status from API
            try {
              const driverType = isInternalDriver ? 'internal' : isExternalDriver ? 'external' : 'freelance';
              const { data: checkinsResult, error: checkinsError } = await getDriverCheckins(
                user.id,
                driverType,
                jobId
              );

              let deliveryCheckinTime: string | null = null;
              let deliveryConfirmedTime: string | null = null;
              let deliveryConfirmedPhotoUrl: string | null = null;
              let deliveryConfirmedPaymentMethod: string | null = null;
              let deliveryConfirmedDriverId: string | null = null;

              if (checkinsError) {
                console.error('Error fetching checkin status:', checkinsError);
              } else {
                const allCheckinsRaw = (checkinsResult as any)?.data || checkinsResult || [];
                const allCheckins = Array.isArray(allCheckinsRaw) ? allCheckinsRaw : [];

                // Filter checkins by transport_order_id matching job.id (foundJob.id) and appropriate driver ID
                // Filter by order only - supports driver swap scenarios
                const filteredCheckins = allCheckins.filter((c: any) => {
                  return c.transport_order_id === foundJob.id || c.order_number === jobId || c.transport_orders?.order_number === jobId;
                });
                console.log('Filtered delivery checkins for order', foundJob.id, ':', filteredCheckins.length);

                // For multi-destination jobs, filter by destination_sequence_number
                // For single destination or legacy data without sequence, fallback to any delivery checkin
                const deliveryCheckin = filteredCheckins.find((c: any) => {
                  if (c.checkin_type !== 'delivery') return false;
                  // Match by sequence number if available, otherwise accept any delivery checkin for sequence 1
                  const checkinSeq = c.destination_sequence_number;
                  if (checkinSeq !== null && checkinSeq !== undefined) {
                    return checkinSeq === currentSequenceNumber;
                  }
                  // Fallback: accept delivery checkin without sequence as sequence 1
                  return currentSequenceNumber === 1;
                });
                deliveryCheckinTime = deliveryCheckin?.checkin_time || deliveryCheckin?.checked_in_at || deliveryCheckin?.created_at || null;
                console.log('Delivery checkin for sequence', currentSequenceNumber, ':', deliveryCheckin ? 'found' : 'not found');

                const deliveryConfirmed = filteredCheckins.find((c: any) => {
                  if (c.checkin_type !== 'delivery_confirmed') return false;
                  // Match by sequence number if available
                  const checkinSeq = c.destination_sequence_number;
                  if (checkinSeq !== null && checkinSeq !== undefined) {
                    return checkinSeq === currentSequenceNumber;
                  }
                  // Fallback: accept delivery_confirmed without sequence as sequence 1
                  return currentSequenceNumber === 1;
                });
                deliveryConfirmedTime = deliveryConfirmed?.checkin_time || deliveryConfirmed?.checked_in_at || deliveryConfirmed?.created_at || null;
                deliveryConfirmedPhotoUrl = deliveryConfirmed?.photo_url || null;
                deliveryConfirmedPaymentMethod = deliveryConfirmed?.payment_method || null;
                deliveryConfirmedDriverId = deliveryConfirmed?.internal_driver_id || deliveryConfirmed?.external_driver_id || deliveryConfirmed?.freelance_driver_id || deliveryConfirmed?.driver_id || null;
                console.log('Delivery confirmed for sequence', currentSequenceNumber, ':', deliveryConfirmed ? 'found' : 'not found');
              }
            
            // Fetch local job application data for payment status (may not exist for external jobs)
            const { data: localJobApp } = await supabase
              .from("job_applications")
              .select("payment_completed_at, payment_method, pod_photo_url, delivery_sop_completed_at")
              .eq("job_id", foundJob.id)
              .eq("driver_id", user.id)
              .maybeSingle();
            
            // Combine external check-in status with local payment/POD data
            // IMPORTANT: If delivery_confirmed exists but delivery check-in is missing,
            // infer that check-in happened (POD completion implies check-in was done)
            const inferredCheckinTime = deliveryCheckinTime || deliveryConfirmedTime;
            
            setJobApplication({
              delivery_checked_in_at: inferredCheckinTime,
              payment_completed_at: localJobApp?.payment_completed_at || null,
              payment_method: deliveryConfirmedPaymentMethod || localJobApp?.payment_method || null,
              pod_photo_url: deliveryConfirmedPhotoUrl || localJobApp?.pod_photo_url || null,
              delivery_sop_completed_at: deliveryConfirmedTime || localJobApp?.delivery_sop_completed_at || null,
              pod_driver_id: deliveryConfirmedDriverId || null,
            });
            
            // Also update the destination state with checkin times for accurate UI state
            // Use inferred checkin time (from delivery_confirmed if delivery is missing)
            setDestination(prev => prev ? {
              ...prev,
              checked_in_at: inferredCheckinTime,
              sop_completed_at: deliveryConfirmedTime || localJobApp?.delivery_sop_completed_at || null,
            } : null);
          } catch (checkinError) {
            console.error('Error fetching checkin status:', checkinError);
          }
        } else {
          throw new Error('Job not found');
        }
    } catch (error) {
      console.error('Error loading job detail:', error);
      toast({
        title: t('delivery.error'),
        description: t('pickup.loadError'),
        variant: 'destructive'
      });
      navigate('/current-jobs');
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentConfirm = async () => {
    if (!job || !user) return;

    const { error } = await supabase
      .from("job_applications")
      .update({
        payment_completed_at: new Date().toISOString(),
        payment_method: selectedPaymentMethod,
      })
      .eq("job_id", job.id)
      .eq("driver_id", user.id);

    if (error) {
      toast({
        title: t('delivery.error'),
        description: t('delivery.paymentError'),
        variant: "destructive",
      });
      return;
    }

    toast({
      title: t('delivery.paymentSuccess'),
      description: t('delivery.paymentSuccessToast'),
    });
    setShowPaymentDrawer(false);
    
    // Update jobApplication state directly to show POD section immediately
    setJobApplication(prev => ({
      ...prev!,
      payment_completed_at: new Date().toISOString(),
      payment_method: selectedPaymentMethod,
    }));
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPodPhoto(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPodPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePodConfirm = async () => {
    if (!job || !user || isSubmittingPod) return;
    
    setIsSubmittingPod(true);

    let photoUrl = jobApplication?.pod_photo_url;

    // Upload photo to S3 if new one is selected
    if (podPhoto) {
      const formData = new FormData();
      formData.append('file', podPhoto);
      formData.append('folder', 'mobile/pod-photos');
      formData.append('filename', `${user.id}-${job.order_code}-${Date.now()}`);

      const { data: uploadData, error: uploadError } = await supabase.functions.invoke('upload-to-s3', {
        body: formData
      });

      if (uploadError || !uploadData?.url) {
        toast({
          title: t('delivery.error'),
          description: t('delivery.uploadError'),
          variant: "destructive",
        });
        setIsSubmittingPod(false);
        return;
      }

      photoUrl = uploadData.url;
    }

    // Get current location for POD (non-blocking, fast timeout)
    let podLatitude = 0;
    let podLongitude = 0;
    if (navigator.geolocation) {
      try {
        const gpsResult = await Promise.race([
          new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: true,
              timeout: 5000,
              maximumAge: 30000
            });
          }),
          new Promise<null>(r => setTimeout(() => r(null), 3000))
        ]);
        if (gpsResult) {
          podLatitude = gpsResult.coords.latitude;
          podLongitude = gpsResult.coords.longitude;
        }
      } catch (geoError) {
        console.log('Could not get location for POD:', geoError);
      }
    }

    // Send POD to external API directly (same API as check-in)
    let podSubmitSuccess = false;
    let podApiResponse: any = null;
    
    // Determine driver type for POD submission
    const driverType: 'internal' | 'external' | 'freelance' = isInternalDriver ? 'internal' : isExternalDriver ? 'external' : 'freelance';
    
    try {
      // Build POD payload matching the driverCheckin function signature
      // For single-destination jobs, don't send destination_sequence_number
      // For multi-destination jobs, send the sequence number
      const podPayload: Parameters<typeof driverCheckin>[0] = {
        order_number: job.order_code,
        checkin_type: 'delivery_confirmed',
        driver_id: user.id,
        driver_type: driverType,
        latitude: podLatitude,
        longitude: podLongitude,
        notes: 'จัดส่งสำเร็จ',
        photo_url: photoUrl,
        payment_method: selectedPaymentMethod,
      };
      
      // Only include destination_sequence_number for multi-destination jobs
      if (isMultiDestination && destination?.sequence_number) {
        podPayload.destination_sequence_number = destination.sequence_number;
        console.log('POD for multi-destination, sequence:', destination.sequence_number);
      } else {
        console.log('POD for single-destination job (no sequence number)');
      }
      
      console.log('=== Sending POD to external API (direct) ===');
      console.log('Payload:', JSON.stringify(podPayload, null, 2));
      
      const { data: podResult, error: podError } = await driverCheckin(podPayload);
      
      console.log('POD API response:', podResult);
      podApiResponse = podResult;
      
      if (podError) {
        console.error('POD API error:', podError);
        toast({
          title: "❌ ส่ง POD ไม่สำเร็จ",
          description: `API Error: ${podError}`,
          variant: "destructive",
        });
        setIsSubmittingPod(false);
        return;
      } else {
        podSubmitSuccess = true;
        console.log('✅ POD submitted to external API successfully:', podApiResponse);
      }
    } catch (podApiError) {
      console.error('Error calling POD API:', podApiError);
      toast({
        title: "❌ ส่ง POD ไม่สำเร็จ",
        description: `Network Error: ${podApiError instanceof Error ? podApiError.message : 'Unknown error'}`,
        variant: "destructive",
      });
      setIsSubmittingPod(false);
      return;
    }

    // Save payment info to local DB as well
    try {
      await supabase
        .from("job_applications")
        .update({
          payment_completed_at: new Date().toISOString(),
          payment_method: selectedPaymentMethod,
          pod_photo_url: photoUrl,
          delivery_sop_completed_at: new Date().toISOString(),
        })
        .eq("job_id", job.id)
        .eq("driver_id", user.id);
    } catch (dbError) {
      console.error('Error updating local job_applications:', dbError);
      // Continue even if local update fails
    }

    // Send 'returning_container' status for international (BL/Booking) jobs after POD confirmed
    const jobAnyPod = job as any;
    if (jobAnyPod.bl_no || jobAnyPod.booking_no || jobAnyPod.transport_category === 'international') {
      try {
        const driverTypePod = isInternalDriver ? 'internal' : isExternalDriver ? 'external' : 'freelance';
        await updateOrderStatus({
          order_number: job.order_code,
          status: 'returning_container',
          driver_id: user.id,
          driver_type: driverTypePod,
          notes: 'ยืนยัน POD สำเร็จ - เตรียมคืนตู้',
        });
        console.log('✅ updateOrderStatus returning_container sent');
      } catch (statusErr) {
        console.warn('updateOrderStatus returning_container error (non-blocking):', statusErr);
      }
    }

    // Show success toast
    toast({
      title: t('delivery.podSuccess'),
      description: t('delivery.podSuccessToast'),
    });
    
    setShowPodConfirmDialog(false);
    setIsSubmittingPod(false);

    // For international (BL/Booking) jobs, go back to job detail (still need container return)
    const jobAnyNav = job as any;
    const isInternationalNav = !!(jobAnyNav.bl_no || jobAnyNav.booking_no || jobAnyNav.transport_category === 'international');
    
    // Always navigate back to job detail page after POD
    // so the driver can see updated status and handle remaining destinations
    const backRoute = (location.state as any)?.isBidJob ? `/bid-job/${job.order_code}` : `/job/${job.order_code}`;
    navigate(backRoute, { state: { jobData: job } });
  };

  const [isCheckingIn, setIsCheckingIn] = useState(false);

  const handleCheckIn = async () => {
    if (!job || !user || isCheckingIn) return;

    setIsCheckingIn(true);

    try {
      // Get current location
      let latitude = displayLatitude || 0;
      let longitude = displayLongitude || 0;
      
      if (navigator.geolocation) {
        try {
          const position = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: true,
              timeout: 10000,
              maximumAge: 0
            });
          });
          latitude = position.coords.latitude;
          longitude = position.coords.longitude;
        } catch (geoError) {
          console.log('Could not get current location, using job location');
        }
      }

      // Determine driver type
      const driverType = isInternalDriver ? 'internal' : isExternalDriver ? 'external' : 'freelance';

      // Build check-in payload
      // For single-destination jobs, don't send destination_sequence_number
      // For multi-destination jobs, send the sequence number
      const checkinPayload: Parameters<typeof driverCheckin>[0] = {
        order_number: job.order_code,
        checkin_type: 'delivery',
        driver_id: user.id,
        driver_type: driverType,
        latitude: latitude,
        longitude: longitude,
        notes: 'ถึงจุดส่งแล้ว',
      };
      
      // Only include destination_sequence_number for multi-destination jobs
      if (isMultiDestination && destination?.sequence_number) {
        checkinPayload.destination_sequence_number = destination.sequence_number;
        console.log('Check-in for multi-destination, sequence:', destination.sequence_number);
      } else {
        console.log('Check-in for single-destination job (no sequence number)');
      }
      
      // Call check-in API directly (no proxy)
      const { data: checkinResult, error: checkinError } = await driverCheckin(checkinPayload);

      if (checkinError) {
        console.error('Check-in error:', checkinError, checkinResult);

        const accidentError = (checkinResult as any)?.error_code === 'ACCIDENT_EVIDENCE_REQUIRED';
        const accidentData = (checkinResult as any)?.data;

        if (accidentError) {
          setAccidentOrderInfo({
            id: accidentData?.order_id || job.id,
            order_number: accidentData?.order_number || job.order_code,
          });
          setAccidentEvidenceRequired(true);
          setShowConfirmDialog(false);
          return;
        }

        throw new Error(checkinError || 'Check-in failed');
      }

      // Also send job status update
      await sendJobStatus({
        jobId: job.id,
        orderCode: job.order_code,
        userId: user.id,
        status: 'delivery_checked_in',
        sequenceNumber: destination?.sequence_number || 3,
        destinationId: destinationId
      });

      // Send truck arrival notification for destination
      try {
        const roomCode = localStorage.getItem(`room_code_${job.order_code}`);
        if (roomCode) {
          console.log('[DeliveryDetailPage] Sending truck-arrival for destination:', { room_code: roomCode, arrival_type: 'destination' });
          const arrivalResponse = await supabase.functions.invoke('truck-arrival', {
            body: {
              room_code: roomCode,
              arrival_type: 'destination'
            }
          });
          console.log('[DeliveryDetailPage] truck-arrival response:', arrivalResponse.data);
        } else {
          console.warn('[DeliveryDetailPage] No room_code found for order:', job.order_code);
        }
      } catch (arrivalError) {
        console.error('[DeliveryDetailPage] Error sending truck-arrival:', arrivalError);
        // Don't block check-in if arrival notification fails
      }

      // Stop GPS tracking after delivery check-in
      stopTracking();
      console.log('[DeliveryDetailPage] GPS tracking stopped');

      // For international jobs (BL/Booking), send 'delivered' status to update-order-status
      const jobAnyStatus = job as any;
      if (jobAnyStatus.bl_no || jobAnyStatus.booking_no || jobAnyStatus.transport_category === 'international') {
        try {
          const statusDriverType = isInternalDriver ? 'internal' : isExternalDriver ? 'external' : 'freelance';
          await updateOrderStatus({
            order_number: job.order_code,
            status: 'delivered',
            driver_id: user.id,
            driver_type: statusDriverType,
            notes: 'เช็คอินจุดส่งสินค้าสำเร็จ',
          });
          console.log('[DeliveryDetailPage] updateOrderStatus delivered sent');
        } catch (statusErr) {
          console.warn('[DeliveryDetailPage] updateOrderStatus exception:', statusErr);
        }
      }

      saveCheckin({
        order_number: job.order_code,
        checkin_type: 'delivery',
        driver_id: user.id,
        checked_in_at: new Date().toISOString(),
        latitude: latitude,
        longitude: longitude
      });

      // Update destination coordinates if missing (fire-and-forget, non-blocking)
      const destHasNoCoords = destination && (!destination.latitude || !destination.longitude || destination.latitude === 0 || destination.longitude === 0);
      const jobHasNoCoords = !destination && (!job.destination_latitude || !job.destination_longitude);
      if ((destHasNoCoords || jobHasNoCoords) && latitude && longitude) {
        // Run in background - don't await, don't block check-in flow
        (async () => {
          try {
            const destId = destination?.id || job.id;
            console.log('[DeliveryDetailPage] Updating missing destination coordinates:', { destId, latitude, longitude });
            const { error: coordError } = await updateDestinationCoordinates({
              destination_id: destId,
              latitude,
              longitude,
            });
            if (coordError) {
              console.warn('[DeliveryDetailPage] Failed to update destination coordinates (non-critical):', coordError);
            }
          } catch {
            // Silently ignore - this is a best-effort feature
          }
        })();
      }

      toast({
        title: t('delivery.checkInSuccess'),
        description: t('delivery.checkInSuccessMessage'),
      });
      setShowConfirmDialog(false);
      
      // Reload current page to show POD section
      loadJobDetail();
    } catch (error) {
      console.error('Check-in error:', error);
      toast({
        title: t('delivery.error'),
        description: 'ไม่สามารถเช็คอินได้ กรุณาลองใหม่อีกครั้ง',
        variant: "destructive",
      });
    } finally {
      setIsCheckingIn(false);
    }
  };

  // Determine which check-in status to use
  // For multi-destination jobs, ONLY use jobApplication?.delivery_checked_in_at which is filtered by sequence number
  // The deliveryCheckedIn from useCheckinStatus is NOT sequence-aware, so it would be true for ALL destinations
  // once ANY destination is checked in, which is incorrect
  const isCheckedIn = destination ? !!destination.checked_in_at : !!jobApplication?.delivery_checked_in_at;
  const checkedInAt = destination ? destination.checked_in_at : jobApplication?.delivery_checked_in_at;
  const isSopCompleted = destination ? !!destination.sop_completed_at : !!jobApplication?.delivery_sop_completed_at;
  
  // Display values - use destination if available, otherwise fallback to job
  const displayCompanyName = destination?.company_name || job?.destination_company_name || '';
  const displayContactName = (() => {
    const generic = ['ผู้ส่ง','ลูกค้า','ผู้รับ','sender','customer','receiver'];
    const company = displayCompanyName && !generic.includes(displayCompanyName.trim()) ? displayCompanyName : null;
    const contact = (destination?.contact_name || job?.destination_contact_person);
    const contactClean = contact && !generic.includes(contact.trim()) ? contact : null;
    return company || contactClean || '-';
  })();
  const displayAddress = destination?.address || job?.destination_address || job?.destination_location || '-';
  const displayLocation = destination ? `${destination.district || ''}, ${destination.province || ''}` : job?.destination_location || '-';
  const displayLatitude = destination?.latitude || job?.destination_latitude || null;
  const displayLongitude = destination?.longitude || job?.destination_longitude || null;
  const displayDeliveryDate = destination?.delivery_date || job?.start_date;
  const displayDeliveryTime = destination?.delivery_time || job?.destination_time || job?.start_time || '-';
  const displayNotes = destination?.notes || job?.destination_remarks || '-';


  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-3">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
      </div>
    );
  }

  if (!job) return null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white pb-20">
      {/* Header */}
      <header className="bg-header text-header-foreground px-4 py-4 sticky top-0 z-50">
        <div className="flex items-center justify-between">
          <button onClick={() => {
            const fromParam = new URLSearchParams(location.search).get('from');
            const backRoute = (location.state as any)?.isBidJob ? `/bid-job/${job.order_code}` : `/job/${job.order_code}`;
            navigate(`${backRoute}${fromParam ? `?from=${fromParam}` : ''}`, { state: { jobData: (location.state as any)?.jobData || job } });
          }} className="p-1">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="text-lg font-semibold">{t('delivery.deliveryTo')} {displayCompanyName}</h1>
          <div className="w-6" />
        </div>
      </header>

      <div className="px-4 py-6 space-y-6">
        <JobActionButtons jobId={jobId} orderNumber={jobId} isPodCompleted={isSopCompleted} completedAt={destination?.sop_completed_at || jobApplication?.delivery_sop_completed_at} jobData={(location.state as any)?.jobData || (location.state as any)?.job} />

        {isCheckedIn && checkedInAt && (
          <div className="bg-white rounded-xl shadow-md p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center shadow-sm">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span className="font-semibold text-lg">{t('delivery.checkInSuccess')}</span>
              </div>
              <span className="text-sm text-gray-600 font-medium">
                {formatDateTime(checkedInAt, language)}
              </span>
            </div>
          </div>
        )}

        {/* POD Upload Section - Show after check-in, hide after POD completed */}
        {isCheckedIn && !isSopCompleted && (
          <div className="bg-white rounded-xl shadow-md p-4 space-y-4">
            <h3 className="font-semibold text-lg text-gray-800">{t('delivery.uploadDocument')}</h3>
            <div
              onClick={() => setPhotoSourceDrawerOpen(true)}
              className="w-full h-48 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-blue-400 bg-gray-50"
            >
              {podPhotoPreview ? (
                <img src={podPhotoPreview} alt="POD Document" className="w-full h-full object-contain rounded-lg" />
              ) : (
                <>
                  <Camera className="w-12 h-12 text-gray-400 mb-2" />
                  <p className="text-sm text-gray-500 text-center" dangerouslySetInnerHTML={{ __html: `${t('delivery.clickToTake')}<br />${t('delivery.waybill')}` }} />
                </>
              )}
            </div>
            <input ref={fileInputRef} type="file" accept={ACCEPT_IMAGE_DOC} onChange={handlePhotoChange} className="hidden" />
            <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" onChange={handlePhotoChange} className="hidden" />

            <Drawer open={photoSourceDrawerOpen} onOpenChange={setPhotoSourceDrawerOpen}>
              <DrawerContent>
                <DrawerHeader>
                  <DrawerTitle className="text-center">{t('deliverySop.selectSource')}</DrawerTitle>
                </DrawerHeader>
                <div className="px-4 pb-4 space-y-3">
                  <Button
                    variant="outline"
                    className="w-full h-14 text-base justify-start gap-3"
                    onClick={() => { setPhotoSourceDrawerOpen(false); setTimeout(() => cameraInputRef.current?.click(), 100); }}
                  >
                    <Camera className="w-6 h-6" />
                    {t('deliverySop.takePhoto')}
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full h-14 text-base justify-start gap-3"
                    onClick={() => { setPhotoSourceDrawerOpen(false); setTimeout(() => fileInputRef.current?.click(), 100); }}
                  >
                    <Camera className="w-6 h-6" />
                    {t('deliverySop.selectFromGallery')}
                  </Button>
                </div>
                <DrawerFooter>
                  <DrawerClose asChild>
                    <Button variant="outline" className="w-full h-12">{t('deliverySop.cancel')}</Button>
                  </DrawerClose>
                </DrawerFooter>
              </DrawerContent>
            </Drawer>


          </div>
        )}

        {/* POD Success - Show after POD completed */}
        {jobApplication?.delivery_sop_completed_at && (
          <div className="bg-white rounded-xl shadow-md p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center shadow-sm">
                  <Check className="w-6 h-6 text-white" />
                </div>
                <span className="font-semibold text-lg">{t('delivery.podCompleted')}</span>
              </div>
              <span className="text-sm text-gray-600 font-medium">
                {formatDateTime(jobApplication.delivery_sop_completed_at, language)}
              </span>
            </div>

            {/* Payment Info - only show for freelance drivers */}
            {canViewPrice && (
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="space-y-1">
                    <div className="text-gray-500 text-xs">{t('delivery.paymentMethod')}</div>
                    <div className="font-medium text-gray-900">
                      {jobApplication.payment_method === "cash" && t('delivery.cash')}
                      {jobApplication.payment_method === "mobile_banking" && t('delivery.mobileBanking')}
                      {jobApplication.payment_method === "qr_code" && t('delivery.qrCode')}
                      {!jobApplication.payment_method && '-'}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-gray-500 text-xs">{t('delivery.amount')}</div>
                    <div className="font-medium text-green-600 text-lg">฿{job?.price?.toLocaleString() || '-'}</div>
                  </div>
                </div>
              </div>
            )}

            {/* POD Photo */}
            {presignedPodPhotoUrl && (
              <div className="mt-4">
                <div className="text-sm text-gray-500 mb-2">{t('delivery.podPhoto')}</div>
                <div className="w-full h-48 rounded-lg border bg-gray-50 overflow-hidden">
                  <EditablePhoto
                    src={presignedPodPhotoUrl}
                    alt="POD Document"
                    className="w-full h-full object-contain"
                    originalUrl={jobApplication?.pod_photo_url}
                    folder="sop-photos"
                    filenamePrefix={`${user?.id}-${job?.order_code}-pod-edit`}
                    completedAt={jobApplication?.delivery_sop_completed_at}
                    fromHistory={isFromHistory} isOwnData={isOwnPodData} 
                  />
                </div>
              </div>
            )}
          </div>
        )}

        <div className="border-b border-gray-200 pb-4">
          <div className="text-sm text-muted-foreground mb-1">{t('delivery.contactName')}</div>
          <div className="text-base">{displayContactName}</div>
        </div>

        {job.invoice_number && (
          <div className="border-b border-gray-200 pb-4">
            <div className="text-sm text-muted-foreground mb-1">{t('job.invoice')}</div>
            <div className="text-base">{job.invoice_number}</div>
          </div>
        )}

        <div className="border-b border-gray-200 pb-4">
          <div className="text-sm text-muted-foreground mb-1">{t('delivery.routeNumber')}</div>
          <div className="text-base">{displayLocation}</div>
        </div>

        <div className="border-b border-gray-200 pb-4">
          <div className="text-sm text-muted-foreground mb-1">{t('delivery.address')}</div>
          <div className="text-base">{displayAddress}</div>
        </div>

        {/* Map */}
        {displayLatitude && displayLongitude ? (
          <GoogleMap 
            latitude={displayLatitude} 
            longitude={displayLongitude}
            markerLabel={displayCompanyName || displayLocation}
            showRoute={true}
          />
        ) : (
          <div className="w-full h-32 bg-muted rounded-lg flex items-center justify-center">
            <div className="text-center">
              <MapPin className="w-8 h-8 text-muted-foreground mx-auto mb-1" />
              <p className="text-sm text-muted-foreground">ไม่มีข้อมูลพิกัด</p>
            </div>
          </div>
        )}


        <div className="border-b border-gray-200 pb-4">
          <div className="text-sm text-muted-foreground mb-1">{t('delivery.productType')}</div>
          {job.destination_products && job.destination_products.length > 0 ? (
            <div className="flex flex-wrap gap-2 mt-1">
              {job.destination_products.map((product, idx) => (
                <span key={idx} className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  {product.product_name}
                  {product.product_quantity ? ` x${product.product_quantity}${product.unit ? ` ${product.unit}` : ''}` : ''}
                  {product.weight ? ` (${product.weight} ${product.weight_unit || 'กก.'})` : ''}
                </span>
              ))}
            </div>
          ) : (
            <div className="text-base">
              {job.destination_goods_type || '-'}
              {job.destination_goods_quantity && ` (${job.destination_goods_quantity})`}
            </div>
          )}
        </div>

        <div className="border-b border-gray-200 pb-4">
          <div className="text-sm text-muted-foreground mb-1">{t('delivery.pickupTime')}</div>
          <div className="text-base">{displayDeliveryDate ? formatDate(displayDeliveryDate, language) : '-'} | {displayDeliveryTime}</div>
        </div>

        <div className="border-b border-gray-200 pb-4">
          <div className="text-sm text-muted-foreground mb-1">{t('delivery.remarks')}</div>
          <div className="text-base">{displayNotes}</div>
        </div>

      </div>

      {/* Check-in Button - Hide after check-in */}
      {!isCheckedIn && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t">
          <Button
            className="w-full h-12 text-base bg-teal-600 hover:bg-teal-700"
            onClick={() => setShowConfirmDialog(true)}
          >
            <MapPin className="w-5 h-5 mr-2" />
            {t('delivery.checkIn')}
          </Button>
        </div>
      )}

      {/* Confirm POD + Payment Button - Show after check-in when POD photo is uploaded */}
      {isCheckedIn && !isSopCompleted && !isFromHistory && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t">
          <Button
            className="w-full h-12 text-base bg-teal-600 hover:bg-teal-700"
            onClick={() => setShowPodConfirmDialog(true)}
            disabled={!podPhoto}
          >
            {t('delivery.confirmPod')}
          </Button>
        </div>
      )}

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="max-w-[340px] rounded-2xl">
          <DialogHeader className="items-center space-y-4">
            <img src={checkInIcon} alt="Check in" className="w-16 h-16" />
            <DialogTitle className="text-xl text-center">{t('delivery.confirmStatusTitle')}</DialogTitle>
            <DialogDescription className="text-center text-base">
              {t('delivery.confirmCheckInMessage')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-row gap-3 sm:gap-3">
            <Button variant="outline" onClick={() => setShowConfirmDialog(false)} className="flex-1 h-11">
              {t('delivery.cancel')}
            </Button>
            <Button onClick={handleCheckIn} disabled={isCheckingIn} className="flex-1 h-11 bg-blue-600 hover:bg-blue-700">
              {isCheckingIn ? 'กำลังเช็คอิน...' : t('delivery.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment Method Drawer removed - sending null to API */}

      {/* POD Confirmation Dialog */}
      <Dialog open={showPodConfirmDialog} onOpenChange={setShowPodConfirmDialog}>
        <DialogContent className="max-w-[340px] rounded-2xl">
          <DialogHeader className="items-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center">
              <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <DialogTitle className="text-xl text-center">{t('delivery.confirmStatusTitle')}</DialogTitle>
            <DialogDescription className="text-center text-base">
              {t('delivery.confirmPodMessage')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-row gap-3 sm:gap-3">
            <Button variant="outline" onClick={() => setShowPodConfirmDialog(false)} className="flex-1 h-11">
              {t('delivery.cancel')}
            </Button>
            <Button onClick={handlePodConfirm} disabled={isSubmittingPod} className="flex-1 h-11 bg-teal-600 hover:bg-teal-700">
              {isSubmittingPod ? t('delivery.submitting') : t('delivery.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AccidentEvidenceModal
        open={accidentEvidenceRequired}
        onOpenChange={(open) => {
          if (!open) {
            setAccidentEvidenceRequired(false);
          }
        }}
        orderId={accidentOrderInfo?.id}
        orderNumber={accidentOrderInfo?.order_number}
        onSuccess={() => {
          setAccidentEvidenceRequired(false);
          loadJobDetail();
        }}
      />
    </div>
  );
}
