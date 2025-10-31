import { Clock, MapPin, CircleDot } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface Job {
  id: string;
  order_code: string;
  job_type: string;
  employer_name: string;
  transport_type: string;
  origin_location: string;
  destination_location: string;
  price: number;
  start_date: string;
  start_time: string;
  equipment_list: string | null;
  safety_equipment: string | null;
}

interface JobCardProps {
  job: Job;
  onAccept: (job: Job) => void;
}

export const JobCard = ({ job, onAccept }: JobCardProps) => {
  const formatDate = (date: string) => {
    const d = new Date(date);
    return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' });
  };

  return (
    <Card className="p-4 space-y-3 bg-card">
      <div className="flex items-start justify-between mb-3">
        <div className="inline-block px-3 py-1 rounded bg-green-50 text-green-700 text-xs font-medium">
          รหัสออเดอร์ {job.order_code}
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="w-3.5 h-3.5" />
          {formatDate(job.start_date)} | {job.start_time.substring(0, 5)}
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-sm">
          <span className="text-muted-foreground">ผู้จ้าง : </span>
          <span className="font-medium">{job.employer_name}</span>
        </div>
        <div className="text-sm text-blue-600 font-medium">
          {job.transport_type}
        </div>

        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 space-y-2">
            <div className="flex items-start gap-2">
              <CircleDot className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
              <div className="text-xs">
                <div className="text-muted-foreground">ต้นทาง</div>
                <div className="font-medium">{job.origin_location}</div>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <MapPin className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
              <div className="text-xs">
                <div className="text-muted-foreground">ปลายทาง</div>
                <div className="font-medium">{job.destination_location}</div>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-teal-50">
            <span className="text-lg font-bold text-teal-700">฿ {job.price.toLocaleString()}</span>
          </div>
        </div>

        <div className="bg-muted/50 rounded-lg p-3 space-y-1.5 text-xs">
          <div>
            <span className="text-muted-foreground">อุปกรณ์ติดรถ : </span>
            <span>{job.equipment_list || '-'}</span>
          </div>
          <div>
            <span className="text-muted-foreground">อุปกรณ์ Safety : </span>
            <span>{job.safety_equipment || '-'}</span>
          </div>
        </div>
      </div>

      <Button onClick={() => onAccept(job)} className="w-full h-11 text-base font-medium">
        รับงานนี้
      </Button>
    </Card>
  );
};
