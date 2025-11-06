import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Filter } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { JobCard } from '@/components/home/JobCard';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export default function SearchPage() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const [domesticType, setDomesticType] = useState('');
  const [internationalType, setInternationalType] = useState('');
  const [province, setProvince] = useState('');
  const [district, setDistrict] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [showResults, setShowResults] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [allJobs, setAllJobs] = useState<any[]>([]);

  const recentSearches = ['กรุงเทพ', 'สมุทรปราการ'];
  const popularSearches = ['กรุงเทพมหานคร', 'คลังสินค้า', 'ขนส่ง', 'ชิปปิ้ง'];

  useEffect(() => {
    loadJobs();
  }, []);

  // Real-time search with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.trim() || domesticType || internationalType || province || district || minPrice || maxPrice) {
        performSearch();
      } else {
        setShowResults(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, domesticType, internationalType, province, district, minPrice, maxPrice]);

  const loadJobs = async () => {
    const { data, error } = await supabase
      .from('jobs')
      .select('*')
      .eq('status', 'available')
      .order('created_at', { ascending: false });

    if (error) {
      toast({
        title: t('home.error_load'),
        description: t('home.error_load_desc'),
        variant: 'destructive',
      });
    } else {
      setAllJobs(data || []);
    }
  };

  const domesticTypes = ['ขนส่งเที่ยวเดียว', 'ขนส่งหลายที่'];
  const internationalTypes = ['ขนส่งขาเข้า', 'ขนส่งขาออก'];

  const provinces = [
    'กรุงเทพมหานคร',
    'นนทบุรี',
    'ปทุมธานี',
    'สมุทรปราการ',
    'สมุทรสาคร',
    'นครปฐม',
  ];

  const districtsByProvince: Record<string, string[]> = {
    'กรุงเทพมหานคร': ['บางรัก', 'ปทุมวัน', 'บางกอกใหญ่', 'บางกอกน้อย', 'ห้วยขวาง'],
    'นนทบุรี': ['เมืองนนทบุรี', 'บางกรวย', 'บางใหญ่', 'บางบัวทอง', 'ไทรน้อย'],
    'ปทุมธานี': ['เมืองปทุมธานี', 'คลองหลวง', 'ธัญบุรี', 'ลำลูกกา', 'หนองเสือ'],
    'สมุทรปราการ': ['เมืองสมุทรปราการ', 'บางบ่อ', 'บางพลี', 'พระประแดง', 'พระสมุทรเจดีย์'],
    'สมุทรสาคร': ['เมืองสมุทรสาคร', 'กระทุ่มแบน', 'บ้านแพ้ว'],
    'นครปฐม': ['เมืองนครปฐม', 'กำแพงแสน', 'นครชัยศรี', 'ดอนตูม', 'บางเลน'],
  };

  const availableDistricts = province ? districtsByProvince[province] || [] : [];

  const handleClearFilter = () => {
    setDomesticType('');
    setInternationalType('');
    setProvince('');
    setDistrict('');
    setMinPrice('');
    setMaxPrice('');
  };

  const handleProvinceChange = (value: string) => {
    setProvince(value);
    setDistrict(''); // Reset district when province changes
  };

  const performSearch = (query?: string) => {
    const searchTerm = query || searchQuery;
    
    let filtered = [...allJobs];

    // Filter by search query (bi-directional matching)
    if (searchTerm.trim()) {
      const lowerSearchTerm = searchTerm.toLowerCase();
      filtered = filtered.filter(job => {
        const fields = [
          job.employer_name,
          job.origin_location,
          job.destination_location,
          job.transport_type,
          job.order_code,
          job.province,
          job.district
        ];
        
        return fields.some(field => {
          if (!field) return false;
          const lowerField = field.toLowerCase();
          // Check both directions: search term in field OR field in search term
          return lowerField.includes(lowerSearchTerm) || lowerSearchTerm.includes(lowerField);
        });
      });
    }

    // Filter by domestic type
    if (domesticType) {
      filtered = filtered.filter(job => 
        job.transport_type?.includes(domesticType)
      );
    }

    // Filter by international type
    if (internationalType) {
      filtered = filtered.filter(job => 
        job.transport_type?.includes(internationalType)
      );
    }

    // Filter by province
    if (province) {
      filtered = filtered.filter(job => job.province === province);
    }

    // Filter by district
    if (district) {
      filtered = filtered.filter(job => job.district === district);
    }

    // Filter by price range
    if (minPrice) {
      filtered = filtered.filter(job => job.price >= parseFloat(minPrice));
    }
    if (maxPrice) {
      filtered = filtered.filter(job => job.price <= parseFloat(maxPrice));
    }

    setSearchResults(filtered);
    setShowResults(true);
  };

  const handleSearch = () => {
    performSearch();
    setFilterOpen(false);
  };

  const handleSearchTermClick = (term: string) => {
    setSearchQuery(term);
    performSearch(term);
  };

  const handleAcceptJob = (job: any) => {
    console.log('Accept job:', job);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-blue-50 px-4 py-4 border-b">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/home')} className="p-1">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-lg font-semibold flex-1 text-center">{t('search.title')}</h1>
          <div className="w-6" />
        </div>
      </header>

      {/* Search Bar */}
      <div className="px-4 py-4 bg-white border-b">
        <div className="relative flex gap-2">
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                performSearch();
              }
            }}
            placeholder={t('search.search')}
            className="flex-1 border-primary"
          />
          <button
            onClick={() => setFilterOpen(true)}
            className="p-2 border border-primary rounded-md"
          >
            <Filter className="w-5 h-5 text-primary" />
          </button>
        </div>
      </div>

      {/* Search Results or Suggestions */}
      {showResults ? (
        <div className="px-4 py-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">{t('search.results')}</h3>
            <span className="text-sm text-muted-foreground">
              {searchResults.length} {t('home.items')}
            </span>
          </div>
          {searchResults.length > 0 ? (
            <div className="space-y-3">
              {searchResults.map((job) => (
                <JobCard key={job.id} job={job} onAccept={handleAcceptJob} />
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              {t('search.no_results')}
            </div>
          )}
        </div>
      ) : (
        <div className="px-4 py-6 space-y-6">
          <div>
            <h3 className="text-sm font-semibold mb-3">{t('search.recent')}</h3>
            <div className="flex flex-wrap gap-2">
              {recentSearches.map((term) => (
                <button
                  key={term}
                  onClick={() => handleSearchTermClick(term)}
                  className="px-4 py-2 bg-blue-50 text-blue-700 rounded-full text-sm"
                >
                  {term}
                </button>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold mb-3">{t('search.popular')}</h3>
            <div className="flex flex-wrap gap-2">
              {popularSearches.map((term) => (
                <button
                  key={term}
                  onClick={() => handleSearchTermClick(term)}
                  className="px-4 py-2 bg-blue-50 text-blue-700 rounded-full text-sm"
                >
                  {term}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Filter Sheet */}
      <Sheet open={filterOpen} onOpenChange={setFilterOpen}>
        <SheetContent side="bottom" className="h-[85vh] rounded-t-3xl">
          <SheetHeader>
            <SheetTitle>{t('search.filter')}</SheetTitle>
            <SheetDescription className="sr-only">
              {t('search.filter_desc')}
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-6 overflow-y-auto max-h-[calc(85vh-200px)] pb-20">
            {/* Domestic Transport */}
            <div>
              <label className="text-sm font-medium mb-2 block">
                {t('search.domestic')}
              </label>
              <div className="flex flex-wrap gap-2">
                {domesticTypes.map((type) => (
                  <button
                    key={type}
                    onClick={() =>
                      setDomesticType(domesticType === type ? '' : type)
                    }
                    className={`px-4 py-2 rounded-full text-sm border transition-colors ${
                      domesticType === type
                        ? 'bg-blue-50 border-blue-500 text-blue-700'
                        : 'border-gray-300'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            {/* International Transport */}
            <div>
              <label className="text-sm font-medium mb-2 block">
                {t('search.international')}
              </label>
              <div className="flex flex-wrap gap-2">
                {internationalTypes.map((type) => (
                  <button
                    key={type}
                    onClick={() =>
                      setInternationalType(internationalType === type ? '' : type)
                    }
                    className={`px-4 py-2 rounded-full text-sm border transition-colors ${
                      internationalType === type
                        ? 'bg-blue-50 border-blue-500 text-blue-700'
                        : 'border-gray-300'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            {/* Province */}
            <div>
              <label className="text-sm font-medium mb-2 block">{t('search.province')}</label>
              <Select value={province} onValueChange={handleProvinceChange}>
                <SelectTrigger>
                  <SelectValue placeholder={t('search.select_province')} />
                </SelectTrigger>
                <SelectContent className="bg-background z-50">
                  {provinces.map((prov) => (
                    <SelectItem key={prov} value={prov}>
                      {prov}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* District */}
            <div>
              <label className="text-sm font-medium mb-2 block">{t('search.district')}</label>
              <Select 
                value={district} 
                onValueChange={setDistrict}
                disabled={!province}
              >
                <SelectTrigger>
                  <SelectValue placeholder={province ? t('search.select_district') : t('search.select_district_first')} />
                </SelectTrigger>
                <SelectContent className="bg-background z-50">
                  {availableDistricts.map((dist) => (
                    <SelectItem key={dist} value={dist}>
                      {dist}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Price Range */}
            <div>
              <label className="text-sm font-medium mb-2 block">
                {t('search.price_range')}
              </label>
              <div className="flex items-center gap-3">
                <Input
                  type="number"
                  placeholder={t('search.min_price')}
                  value={minPrice}
                  onChange={(e) => setMinPrice(e.target.value)}
                />
                <span>—</span>
                <Input
                  type="number"
                  placeholder={t('search.max_price')}
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="absolute bottom-6 left-4 right-4 flex gap-3">
            <Button
              variant="outline"
              onClick={handleClearFilter}
              className="flex-1"
            >
              {t('search.clear')}
            </Button>
            <Button onClick={handleSearch} className="flex-1">
              {t('search.apply')}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
