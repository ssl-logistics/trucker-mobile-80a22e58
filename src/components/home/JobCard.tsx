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
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="inline-block px-3 py-1 rounded bg-green-50 text-green-700 text-xs font-medium mb-2">
            {job.order_code}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="w-3 h-3" />
            {formatDate(job.start_date)} | {job.start_time.substring(0, 5)}
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-sm font-medium">
          ผู้จ้าง : {job.employer_name}
        </div>
        <div className="text-xs text-primary font-medium">
          {job.transport_type}
        </div>

        <div className="space-y-1.5">
          <div className="flex items-start gap-2">
            <CircleDot className="w-4 h-4 text-green-600 mt-0.5" />
            <div className="text-xs">
              <div className="text-muted-foreground">ต้นทาง</div>
              <div className="font-medium">{job.origin_location}</div>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <MapPin className="w-4 h-4 text-red-600 mt-0.5" />
            <div className="text-xs">
              <div className="text-muted-foreground">ปลายทาง</div>
              <div className="font-medium">{job.destination_location}</div>
            </div>
          </div>
        </div>

        {job.equipment_list && (
          <div className="text-xs">
            <span className="text-muted-foreground">อุปกรณ์ติดรถ : </span>
            <span>{job.equipment_list}</span>
          </div>
        )}

        {job.safety_equipment && (
          <div className="text-xs">
            <span className="text-muted-foreground">อุปกรณ์ Safety : </span>
            <span>{job.safety_equipment}</span>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between pt-2 border-t">
        <div className="text-lg font-bold text-primary">
          ฿ {job.price.toLocaleString()}
        </div>
        <Button onClick={() => onAccept(job)} className="px-8">
          รับงาน
        </Button>
      </div>
    </Card>
  );
};
