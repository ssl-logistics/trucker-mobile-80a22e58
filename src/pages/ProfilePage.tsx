import { ACCEPT_IMAGE_DOC } from '@/utils/uploadAccept';
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Camera, Edit2, Loader2 } from 'lucide-react';
import profileBg from '@/assets/profile-bg.png';

import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { usePresignedImageUrl } from '@/hooks/usePresignedImageUrl';
import { getDriverTypeFromUserType } from '@/utils/driverTypeMapping';
import { getAuthItem, setAuthItem } from '@/utils/authStorage';
import { updateFreelanceDriver } from '@/lib/externalApi';
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
import { compressImage } from '@/utils/imageCompression';

interface LineUser {
  lineUserId: string;
  displayName: string;
  pictureUrl?: string;
  statusMessage?: string;
}

interface ProfileData {
  first_name: string;
  last_name: string;
  phone_number: string;
  avatar_url?: string;
  email?: string;
  location?: string;
  price_range_min?: number;
  price_range_max?: number;
  loginType?: 'normal' | 'line';
  lineUser?: LineUser;
}

export default function ProfilePage() {
  const navigate = useNavigate();
  const { user, userType, refreshUser } = useAuth();
  const { t } = useLanguage();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showPhotoDrawer, setShowPhotoDrawer] = useState(false);
  const [uploadedAvatarUrl, setUploadedAvatarUrl] = useState<string | null>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  
  // Get presigned URL for S3 profile photos - prioritize uploaded URL
  const avatarSourceUrl = uploadedAvatarUrl || profile?.avatar_url;
  const { url: presignedAvatarUrl, isLoading: isAvatarLoading } = usePresignedImageUrl(avatarSourceUrl);

  useEffect(() => {
    console.log('ProfilePage user data:', user);
    if (user) {
      // Check if login via LINE
      const isLineLogin = user.loginType === 'line' || !!user.lineUser;
      
      // Derive first/last name - prefer TMS data (full_name, first_name, last_name) over LINE displayName
      let firstName = user.first_name || '';
      let lastName = user.last_name || '';
      
      // If no explicit first/last name, try to split full_name
      if (!firstName && user.full_name) {
        const parts = user.full_name.split(' ');
        firstName = parts[0] || '';
        lastName = parts.slice(1).join(' ') || '';
      }
      
      // Only fall back to LINE displayName if no TMS name available
      if (!firstName && isLineLogin && user.lineUser?.displayName) {
        const parts = user.lineUser.displayName.split(' ');
        firstName = parts[0] || user.lineUser.displayName;
        lastName = parts.slice(1).join(' ') || '';
      }

      // Use data directly from AuthContext - prefer TMS data over LINE profile data
      const profileData: ProfileData = {
        first_name: firstName,
        last_name: lastName,
        phone_number: user.phone_number || user.phone || '',
        avatar_url: isLineLogin && user.lineUser?.pictureUrl 
          ? user.lineUser.pictureUrl 
          : user.profile_photo_url || user.avatar_url || undefined,
        email: user.email || user.username || '',
        location: user.location || '',
        price_range_min: user.price_range_min,
        price_range_max: user.price_range_max,
        loginType: isLineLogin ? 'line' : 'normal',
        lineUser: user.lineUser,
      };
      console.log('Setting profile:', profileData);
      setProfile(profileData);
    }
  }, [user]);

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

    setLoading(true);
    setShowConfirmDialog(false);

    try {
      // Upload to AWS S3 via edge function
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('folder', 'profile');
      formData.append('fileName', `${user.id}_${Date.now()}.${selectedFile.name.split('.').pop() || 'jpg'}`);

      const uploadRes = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/upload-to-s3`,
        {
          method: 'POST',
          headers: {
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: formData,
        }
      );

      const uploadJson = await uploadRes.json();
      if (!uploadRes.ok || !uploadJson?.url) {
        console.error('S3 Upload error:', uploadJson);
        toast({ title: t('home.error_load'), description: uploadJson?.error || t('profile.error_upload'), variant: 'destructive' });
        setLoading(false);
        cleanupPreview();
        return;
      }

      const publicUrl: string = uploadJson.url;

      // Update via external API directly
      const driverType = getDriverTypeFromUserType(userType);
      const { data, error: updateError } = await updateFreelanceDriver({
        driver_id: user.id,
        driver_type: driverType as 'internal' | 'external' | 'freelance',
        profile_photo_url: publicUrl,
      } as any);

      console.log('Update profile photo response:', data, updateError);

      if (!updateError) {
        setUploadedAvatarUrl(publicUrl);
        setProfile(prev => (prev ? { ...prev, avatar_url: publicUrl } : null));
        
        // Persist photo URL in localStorage so it survives navigation
        const storedDriver = await getAuthItem('auth_driver');
        if (storedDriver) {
          try {
            const driverData = JSON.parse(storedDriver);
            driverData.profile_photo_url = publicUrl;
            await setAuthItem('auth_driver', JSON.stringify(driverData));
            window.dispatchEvent(new Event('auth_driver_updated'));
          } catch (e) {
            console.error('Error updating local storage:', e);
          }
        }
        
        toast({ title: t('profile.success'), description: t('profile.success_desc') });
      } else {
        toast({ title: t('home.error_load'), description: updateError || t('profile.error_update'), variant: 'destructive' });
      }
    } catch (error) {
      console.error('Error updating profile photo:', error);
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

  const firstName = profile?.first_name || '';
  const lastName = profile?.last_name || '';

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
      <div className="relative bg-white px-4 py-8">
        <div className="absolute top-2 left-4 right-4 bottom-2 rounded-xl overflow-hidden">
          <img 
            src={profileBg} 
            alt="" 
            className="w-full h-full object-contain object-center pointer-events-none"
          />
        </div>
        <div className="flex flex-col items-center relative">
          <div className="relative">
            <Avatar className="w-20 h-20">
              {isAvatarLoading ? (
                <AvatarFallback className="bg-primary/10 text-primary text-3xl">
                  <Loader2 className="w-6 h-6 animate-spin" />
                </AvatarFallback>
              ) : (
                <>
                  <AvatarImage 
                    src={profile?.loginType === 'line' && profile?.lineUser?.pictureUrl 
                      ? profile.lineUser.pictureUrl 
                      : presignedAvatarUrl || undefined
                    } 
                    alt={`${firstName} ${lastName}`} 
                  />
                  <AvatarFallback className="bg-primary/10 text-primary text-3xl">
                    {firstName ? firstName.charAt(0) : '👤'}
                  </AvatarFallback>
                </>
              )}
            </Avatar>
            {profile?.loginType !== 'line' && (
              <button
                onClick={handlePhotoDrawerOpen}
                disabled={loading}
                className="absolute bottom-0 right-0 w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-md cursor-pointer border-2 border-gray-200"
              >
                <Camera className="w-5 h-5 text-gray-600" />
              </button>
            )}
            <input
              ref={cameraInputRef}
              type="file"
              accept={ACCEPT_IMAGE_DOC}
              capture="environment"
              onChange={handleFileSelect}
              className="hidden"
              disabled={loading}
            />
            <input
              ref={galleryInputRef}
              type="file"
              accept={ACCEPT_IMAGE_DOC}
              onChange={handleFileSelect}
              className="hidden"
              disabled={loading}
            />
          </div>
          
          {/* Login Type Badge */}
          <div className="mt-3">
            {profile?.loginType === 'line' ? (
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#00B900] text-white text-xs font-medium">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63h2.386c.349 0 .63.285.63.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63.349 0 .631.285.631.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.281.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/>
                </svg>
                เข้าสู่ระบบด้วย LINE
              </div>
            ) : (
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-muted text-muted-foreground text-xs font-medium">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                เข้าสู่ระบบปกติ
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Profile Fields */}
      <div className="bg-white mt-2 divide-y">
        {/* For LINE login, show display name as single field */}
        {profile?.loginType === 'line' ? (
          <div className="px-4 py-3">
            <div className="text-sm text-muted-foreground mb-1">ชื่อ LINE</div>
            <div className="flex items-center justify-between">
              <span className="text-foreground">{profile.lineUser?.displayName || `${firstName} ${lastName}`}</span>
            </div>
          </div>
        ) : (
          <>
            <div className="px-4 py-3">
              <div className="text-sm text-muted-foreground mb-1">{t('profile.first_name')}</div>
              <div className="flex items-center justify-between">
                <span className="text-foreground">{firstName}</span>
                <button
                  onClick={() => navigate('/profile/edit', { 
                    state: { 
                      field: 'firstName', 
                      value: firstName
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
                      value: lastName
                    } 
                  })}
                  className="p-2"
                >
                  <Edit2 className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>
            </div>
          </>
        )}

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
          </div>
        </div>
      </div>

      {/* Location */}
      {profile?.location && (
        <div className="bg-white mt-2 px-4 py-3">
          <div className="text-sm text-muted-foreground mb-1">
            {t('profile.location')}
          </div>
          <div className="text-foreground">{profile.location}</div>
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
