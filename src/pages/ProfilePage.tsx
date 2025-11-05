import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Camera, Edit2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { toast } from '@/hooks/use-toast';

interface ProfileData {
  full_name: string;
  phone_number: string;
  avatar_url?: string;
  email?: string;
  work_areas?: string[];
  price_range_min?: number;
  price_range_max?: number;
}

export default function ProfilePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      loadProfile();
    }
  }, [user]);

  const loadProfile = async () => {
    if (!user) return;

    const { data: profileData } = await supabase
      .from('profiles')
      .select('full_name, phone_number, avatar_url')
      .eq('id', user.id)
      .single();

    const { data: workPrefs } = await supabase
      .from('driver_work_preferences')
      .select('work_areas, price_range_min, price_range_max')
      .eq('driver_id', user.id)
      .single();

    setProfile({
      ...profileData,
      email: user.email,
      work_areas: workPrefs?.work_areas || [],
      price_range_min: workPrefs?.price_range_min,
      price_range_max: workPrefs?.price_range_max,
    });
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0] || !user) return;

    const file = e.target.files[0];
    const fileExt = file.name.split('.').pop();
    const filePath = `${user.id}/avatar-${Date.now()}.${fileExt}`;

    setLoading(true);
    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(filePath, file);

    if (uploadError) {
      toast({ title: 'เกิดข้อผิดพลาด', description: 'ไม่สามารถอัพโหลดรูปภาพได้', variant: 'destructive' });
      setLoading(false);
      return;
    }

    const { data: { publicUrl } } = supabase.storage
      .from('avatars')
      .getPublicUrl(filePath);

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ avatar_url: publicUrl })
      .eq('id', user.id);

    if (!updateError) {
      setProfile(prev => prev ? { ...prev, avatar_url: publicUrl } : null);
      toast({ title: 'สำเร็จ', description: 'อัพเดทรูปโปรไฟล์แล้ว' });
    }
    setLoading(false);
  };

  const nameParts = profile?.full_name.split(' ') || [];
  const firstName = nameParts[0] || '';
  const lastName = nameParts.slice(1).join(' ') || '';

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-gradient-to-r from-blue-600 to-blue-500 text-white px-4 py-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)}>
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-semibold">โปรไฟล์</h1>
        </div>
      </header>

      {/* Avatar Section */}
      <div className="bg-white px-4 py-8">
        <div className="flex justify-center relative">
          <div className="relative">
            <Avatar className="w-32 h-32">
              <AvatarImage src={profile?.avatar_url} alt={profile?.full_name} />
              <AvatarFallback className="bg-primary/10 text-primary text-3xl">
                {firstName.charAt(0)}
              </AvatarFallback>
            </Avatar>
            <label className="absolute bottom-0 right-0 w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-md cursor-pointer border-2 border-gray-200">
              <Camera className="w-5 h-5 text-gray-600" />
              <input
                type="file"
                accept="image/*"
                onChange={handleAvatarUpload}
                className="hidden"
                disabled={loading}
              />
            </label>
          </div>
        </div>
      </div>

      {/* Profile Fields */}
      <div className="bg-white mt-2 divide-y">
        <div className="px-4 py-3">
          <div className="text-sm text-muted-foreground mb-1">ชื่อ</div>
          <div className="flex items-center justify-between">
            <span className="text-foreground">{firstName}</span>
            <button
              onClick={() => navigate('/profile/edit', { 
                state: { 
                  field: 'ชื่อ', 
                  value: firstName, 
                  fullName: profile?.full_name 
                } 
              })}
              className="p-2"
            >
              <Edit2 className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        </div>

        <div className="px-4 py-3">
          <div className="text-sm text-muted-foreground mb-1">นามสกุล</div>
          <div className="flex items-center justify-between">
            <span className="text-foreground">{lastName}</span>
            <button
              onClick={() => navigate('/profile/edit', { 
                state: { 
                  field: 'นามสกุล', 
                  value: lastName, 
                  fullName: profile?.full_name 
                } 
              })}
              className="p-2"
            >
              <Edit2 className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        </div>

        <div className="px-4 py-3">
          <div className="text-sm text-muted-foreground mb-1">เบอร์โทรศัพท์</div>
          <div className="flex items-center justify-between">
            <span className="text-foreground">{profile?.phone_number}</span>
            <button
              onClick={() => navigate('/profile/edit', { 
                state: { 
                  field: 'เบอร์โทรศัพท์', 
                  value: profile?.phone_number || '' 
                } 
              })}
              className="p-2"
            >
              <Edit2 className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        </div>

        <div className="px-4 py-3">
          <div className="text-sm text-muted-foreground mb-1">อีเมล</div>
          <div className="flex items-center justify-between">
            <span className="text-foreground">{profile?.email}</span>
            <button className="p-2">
              <Edit2 className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        </div>
      </div>

      {/* Work Areas */}
      {profile?.work_areas && profile.work_areas.length > 0 && (
        <div className="bg-white mt-2 px-4 py-3">
          <div className="text-sm text-muted-foreground mb-3">
            อำเภอ หรือ จังหวัด ที่ถนัดหรือจังหวัดทั่วเป็นประจำ
          </div>
          <div className="flex flex-wrap gap-2">
            {profile.work_areas.map((area, index) => (
              <span
                key={index}
                className="px-3 py-1 rounded-full bg-blue-50 text-blue-600 text-sm"
              >
                {area}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Price Range */}
      {profile?.price_range_min && profile?.price_range_max && (
        <div className="bg-white mt-2 px-4 py-3">
          <div className="text-sm text-muted-foreground mb-1">เรทราคาวังงาน (฿)</div>
          <div className="text-foreground">
            {profile.price_range_min.toLocaleString()} - {profile.price_range_max.toLocaleString()}
          </div>
        </div>
      )}
    </div>
  );
}
