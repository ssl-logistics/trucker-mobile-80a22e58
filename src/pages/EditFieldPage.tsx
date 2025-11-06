import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ChevronLeft, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';

export default function EditFieldPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { field, value: initialValue, fullName } = location.state || {};
  
  const [value, setValue] = useState(initialValue || '');
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!user) return;

    setLoading(true);

    if (field === 'ชื่อ') {
      const nameParts = fullName?.split(' ') || [];
      const newFullName = `${value} ${nameParts.slice(1).join(' ')}`;
      
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: newFullName })
        .eq('id', user.id);

      if (!error) {
        toast({ title: 'สำเร็จ', description: 'อัพเดทข้อมูลแล้ว' });
        navigate(-1);
      } else {
        toast({ title: 'เกิดข้อผิดพลาด', description: 'ไม่สามารถอัพเดทข้อมูลได้', variant: 'destructive' });
      }
    } else if (field === 'นามสกุล') {
      const nameParts = fullName?.split(' ') || [];
      const newFullName = `${nameParts[0]} ${value}`;
      
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: newFullName })
        .eq('id', user.id);

      if (!error) {
        toast({ title: 'สำเร็จ', description: 'อัพเดทข้อมูลแล้ว' });
        navigate(-1);
      } else {
        toast({ title: 'เกิดข้อผิดพลาด', description: 'ไม่สามารถอัพเดทข้อมูลได้', variant: 'destructive' });
      }
    } else if (field === 'เบอร์โทรศัพท์') {
      const { error } = await supabase
        .from('profiles')
        .update({ phone_number: value })
        .eq('id', user.id);

      if (!error) {
        toast({ title: 'สำเร็จ', description: 'อัพเดทข้อมูลแล้ว' });
        navigate(-1);
      } else {
        toast({ title: 'เกิดข้อผิดพลาด', description: 'ไม่สามารถอัพเดทข้อมูลได้', variant: 'destructive' });
      }
    }

    setLoading(false);
  };

  const handleClear = () => {
    setValue('');
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-header text-header-foreground px-4 py-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)}>
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-semibold">โปรไฟล์</h1>
        </div>
      </header>

      {/* Edit Form */}
      <div className="p-4">
        <div className="mb-6">
          <div className="text-sm text-muted-foreground mb-2">{field}</div>
          <div className="relative">
            <Input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="border-b border-gray-300 rounded-none px-0 pb-2 focus-visible:ring-0 focus-visible:border-blue-600 text-lg"
              placeholder={field}
              autoFocus
            />
            {value && (
              <button
                onClick={handleClear}
                className="absolute right-0 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-gray-300 flex items-center justify-center"
              >
                <X className="w-4 h-4 text-white" />
              </button>
            )}
          </div>
        </div>

        <Button
          onClick={handleSave}
          disabled={loading || !value.trim()}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white py-6 text-base"
        >
          บันทึก
        </Button>
      </div>
    </div>
  );
}
