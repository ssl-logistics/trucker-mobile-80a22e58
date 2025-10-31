import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Filter } from 'lucide-react';
import { JobCard } from '@/components/home/JobCard';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
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

  const recentSearches = ['กรุงเทพ', 'สมุทรปราการ'];
  const popularSearches = ['กรุงเทพมหานคร', 'คลังสินค้า', 'ขนส่ง', 'ชิปปิ้ง'];

  // Mock data for demonstration
  const mockJobs = [
    {
      id: '1',
      order_code: 'รหัสออเดอร์ ORO0001',
      job_type: 'domestic',
      employer_name: 'ไอเดียฟิล จำกัดมหาชน',
      transport_type: 'ขนส่งทางมอเตอร์เวย์ ขนส่งเที่ยวเดียว (ทน่ข้า)',
      origin_location: 'ที่เรือกรุงเทพ',
      destination_location: 'คลังสินค้าที่เรือแหลมฉบัง',
      price: 5000,
      start_date: '2024-02-29',
      start_time: '10:00',
      equipment_list: 'อุปกรณ์ติดรถ : น้ำมัน, รถมืด, กล้องหน้า',
      safety_equipment: '-',
    },
  ];

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

  const handleSearch = (query?: string) => {
    const searchTerm = query || searchQuery;
    if (searchTerm.trim()) {
      // Filter mock jobs based on search query
      const filtered = mockJobs.filter(job => 
        job.employer_name.includes(searchTerm) ||
        job.origin_location.includes(searchTerm) ||
        job.destination_location.includes(searchTerm) ||
        job.transport_type.includes(searchTerm)
      );
      setSearchResults(filtered);
      setShowResults(true);
      setFilterOpen(false);
    }
  };

  const handleSearchTermClick = (term: string) => {
    setSearchQuery(term);
    handleSearch(term);
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
          <h1 className="text-lg font-semibold flex-1 text-center">ค้นหา</h1>
          <div className="w-6" />
        </div>
      </header>

      {/* Search Bar */}
      <div className="px-4 py-4 bg-white border-b">
        <div className="relative flex gap-2">
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="ค้นหา"
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
            <h3 className="text-sm font-semibold">ผลการค้นหา</h3>
            <span className="text-sm text-muted-foreground">
              {searchResults.length} รายการ
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
              ไม่พบผลการค้นหา
            </div>
          )}
        </div>
      ) : (
        <div className="px-4 py-6 space-y-6">
          <div>
            <h3 className="text-sm font-semibold mb-3">คำค้นหาล่าสุด</h3>
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
            <h3 className="text-sm font-semibold mb-3">คำค้นหายอดนิยม</h3>
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
            <SheetTitle>ตัวกรอง</SheetTitle>
            <SheetDescription className="sr-only">
              กรองผลการค้นหา
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-6 overflow-y-auto max-h-[calc(85vh-200px)] pb-20">
            {/* Domestic Transport */}
            <div>
              <label className="text-sm font-medium mb-2 block">
                ขนส่งภายในประเทศ
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
                ขนส่งภายนอกประเทศ
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
              <label className="text-sm font-medium mb-2 block">จังหวัด</label>
              <Select value={province} onValueChange={handleProvinceChange}>
                <SelectTrigger>
                  <SelectValue placeholder="เลือกจังหวัด" />
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
              <label className="text-sm font-medium mb-2 block">อำเภอ</label>
              <Select 
                value={district} 
                onValueChange={setDistrict}
                disabled={!province}
              >
                <SelectTrigger>
                  <SelectValue placeholder={province ? "เลือกอำเภอ" : "กรุณาเลือกจังหวัดก่อน"} />
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
                ช่วงราคา (฿)
              </label>
              <div className="flex items-center gap-3">
                <Input
                  type="number"
                  placeholder="ใส่ราคาต่ำสุด"
                  value={minPrice}
                  onChange={(e) => setMinPrice(e.target.value)}
                />
                <span>—</span>
                <Input
                  type="number"
                  placeholder="ใส่ราคาสูงสุด"
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
              ล้างค่า
            </Button>
            <Button onClick={() => handleSearch()} className="flex-1">
              ค้นหา
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
