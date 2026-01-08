import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Camera, Edit2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { toast } from '@/hooks/use-toast';
import troobLogo from '@/assets/troob-logo.png';

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
  const { user, profile: authProfile, refreshProfile } = useAuth();
  const { t } = useLanguage();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showPhotoDrawer, setShowPhotoDrawer] = useState(false);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user) {
      loadProfileDetails();
    }
  }, [user, authProfile]);

  const loadProfileDetails = async () => {
    if (!user) return;

    const { data: workPrefs } = await supabase
      .from('driver_work_preferences')
      .select('work_areas, price_range_min, price_range_max')
      .eq('driver_id', user.id)
      .maybeSingle();

    // Get phone number from profiles table
    const { data: profileData } = await supabase
      .from('profiles')
      .select('phone_number')
      .eq('id', user.id)
      .maybeSingle();

    setProfile({
      full_name: authProfile?.full_name || '',
      phone_number: profileData?.phone_number || '',
      avatar_url: authProfile?.avatar_url || undefined,
      email: user.email,
      work_areas: workPrefs?.work_areas || [],
      price_range_min: workPrefs?.price_range_min,
      price_range_max: workPrefs?.price_range_max,
    });
  };

  const handlePhotoDrawerOpen = () => {
    setShowPhotoDrawer(true);
  };

  const handleTakePhoto = () => {
    setShowPhotoDrawer(false);
    cameraInputRef.current?.click();
  };

  const handleSelectFromGallery = () => {
    setShowPhotoDrawer(false);
    galleryInputRef.current?.click();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0]) return;

    const file = e.target.files[0];
    setSelectedFile(file);
    
    // Create preview URL
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    setShowConfirmDialog(true);
  };

  const handleConfirmUpload = async () => {
    if (!selectedFile || !user) return;

    const fileExt = selectedFile.name.split('.').pop();
    const filePath = `${user.id}/avatar-${Date.now()}.${fileExt}`;

    setLoading(true);
    setShowConfirmDialog(false);

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(filePath, selectedFile);

    if (uploadError) {
      toast({ title: t('home.error_load'), description: t('profile.error_upload'), variant: 'destructive' });
      setLoading(false);
      cleanupPreview();
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
      // Refresh the global profile cache
      await refreshProfile();
      toast({ title: t('profile.success'), description: t('profile.success_desc') });
    } else {
      toast({ title: t('home.error_load'), description: t('profile.error_update'), variant: 'destructive' });
    }
    
    setLoading(false);
    cleanupPreview();
  };

  const handleCancelUpload = () => {
    setShowConfirmDialog(false);
    cleanupPreview();
  };

  const cleanupPreview = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setSelectedFile(null);
    setPreviewUrl(null);
  };

  const nameParts = profile?.full_name.split(' ') || [];
  const firstName = nameParts[0] || '';
  const lastName = nameParts.slice(1).join(' ') || '';

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-header text-header-foreground page-header-safe">
        <div className="flex items-center justify-center px-4 py-3 relative">
          <button onClick={() => navigate('/settings')} className="absolute left-0">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-semibold">{t('profile.title')}</h1>
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
            <button
              onClick={handlePhotoDrawerOpen}
              disabled={loading}
              className="absolute bottom-0 right-0 w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-md cursor-pointer border-2 border-gray-200"
            >
              <Camera className="w-5 h-5 text-gray-600" />
            </button>
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileSelect}
              className="hidden"
              disabled={loading}
            />
            <input
              ref={galleryInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
              disabled={loading}
            />
          </div>
        </div>
      </div>

      {/* Troob Logo */}
      <div className="flex justify-center py-6">
        <img src={troobLogo} alt="The Troob" className="h-12" />
      </div>

      {/* Profile Fields */}
      <div className="bg-white mt-2 divide-y">
        <div className="px-4 py-3">
          <div className="text-sm text-muted-foreground mb-1">{t('profile.first_name')}</div>
          <div className="flex items-center justify-between">
            <span className="text-foreground">{firstName}</span>
            <button
              onClick={() => navigate('/profile/edit', { 
                state: { 
                  field: 'firstName', 
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
          <div className="text-sm text-muted-foreground mb-1">{t('profile.last_name')}</div>
          <div className="flex items-center justify-between">
            <span className="text-foreground">{lastName}</span>
            <button
              onClick={() => navigate('/profile/edit', { 
                state: { 
                  field: 'lastName', 
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
          <div className="text-sm text-muted-foreground mb-1">{t('profile.phone')}</div>
          <div className="flex items-center justify-between">
            <span className="text-foreground">{profile?.phone_number}</span>
            <button
              onClick={() => navigate('/profile/edit', { 
                state: { 
                  field: 'phone', 
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
          <div className="text-sm text-muted-foreground mb-1">{t('profile.email')}</div>
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
            {t('profile.work_areas')}
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
          <div className="text-sm text-muted-foreground mb-1">{t('profile.price_range')}</div>
          <div className="text-foreground">
            {profile.price_range_min.toLocaleString()} - {profile.price_range_max.toLocaleString()}
          </div>
        </div>
      )}

      {/* Photo Source Drawer */}
      <Drawer open={showPhotoDrawer} onOpenChange={setShowPhotoDrawer}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>{t('profile.select_photo_source')}</DrawerTitle>
          </DrawerHeader>
          <div className="p-4 space-y-2">
            <button
              onClick={handleTakePhoto}
              className="w-full p-4 text-left rounded-lg border border-border hover:bg-accent"
            >
              <div className="flex items-center gap-3">
                <Camera className="w-5 h-5" />
                <span>{t('profile.take_photo')}</span>
              </div>
            </button>
            <button
              onClick={handleSelectFromGallery}
              className="w-full p-4 text-left rounded-lg border border-border hover:bg-accent"
            >
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span>{t('profile.select_from_gallery')}</span>
              </div>
            </button>
          </div>
        </DrawerContent>
      </Drawer>

      {/* Confirm Avatar Upload Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent className="max-w-[320px] w-[90%] fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-2xl">
          <AlertDialogHeader className="items-center">
            <div className="w-24 h-24 rounded-full overflow-hidden mb-3 border-4 border-gray-200">
              {previewUrl && (
                <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
              )}
            </div>
            <AlertDialogTitle className="text-center text-base">
              {t('profile.change_avatar')}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-center text-xs px-2">
              {t('profile.change_avatar_desc')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row gap-2">
            <AlertDialogAction 
              onClick={handleConfirmUpload}
              disabled={loading}
              className="flex-1 m-0 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {loading ? t('profile.uploading') : t('profile.confirm')}
            </AlertDialogAction>
            <AlertDialogCancel 
              onClick={handleCancelUpload}
              disabled={loading}
              className="flex-1 m-0"
            >
              {t('profile.cancel')}
            </AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
