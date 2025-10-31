import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Filter, X } from 'lucide-react';
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
  const [transportType, setTransportType] = useState('');
  const [province, setProvince] = useState('');
  const [district, setDistrict] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');

  const recentSearches = ['ศุรุงเทพ', 'สมุทรปราการ'];
  const popularSearches = ['ศุรุงเทพมหานคร', 'คลังสินค้า', 'ค้าง', 'ชีพ'];

  const transportTypes = [
    'ส่งเที่ยวเดียว',
    'ส่งหลายที่',
    'ส่งข่างประเทศ',
  ];

  const handleClearFilter = () => {
    setTransportType('');
    setProvince('');
    setDistrict('');
    setMinPrice('');
    setMaxPrice('');
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-blue-50 px-4 py-4 border-b">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)}>
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

      {/* Search Suggestions */}
      <div className="px-4 py-6 space-y-6">
        <div>
          <h3 className="text-sm font-semibold mb-3">คำค้นหาล่าสุด</h3>
          <div className="flex flex-wrap gap-2">
            {recentSearches.map((term) => (
              <button
                key={term}
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
                className="px-4 py-2 bg-blue-50 text-blue-700 rounded-full text-sm"
              >
                {term}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Filter Sheet */}
      <Sheet open={filterOpen} onOpenChange={setFilterOpen}>
        <SheetContent side="bottom" className="h-[85vh] rounded-t-3xl">
          <SheetHeader>
            <SheetTitle>ตัวกรอง</SheetTitle>
            <SheetDescription className="sr-only">
              กรองผลการค้นหา
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-6">
            {/* Transport Type */}
            <div>
              <label className="text-sm font-medium mb-2 block">
                ประเภทการขนส่ง
              </label>
              <div className="flex flex-wrap gap-2">
                {transportTypes.map((type) => (
                  <button
                    key={type}
                    onClick={() =>
                      setTransportType(transportType === type ? '' : type)
                    }
                    className={`px-4 py-2 rounded-full text-sm border transition-colors ${
                      transportType === type
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
              <Select value={province} onValueChange={setProvince}>
                <SelectTrigger>
                  <SelectValue placeholder="จังหวัด" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="กรุงเทพมหานคร">กรุงเทพมหานคร</SelectItem>
                  <SelectItem value="นนทบุรี">นนทบุรี</SelectItem>
                  <SelectItem value="สมุทรปราการ">สมุทรปราการ</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* District */}
            <div>
              <label className="text-sm font-medium mb-2 block">อำเภอ</label>
              <Select value={district} onValueChange={setDistrict}>
                <SelectTrigger>
                  <SelectValue placeholder="อำเภอ" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="บางรัก">บางรัก</SelectItem>
                  <SelectItem value="ปทุมวัน">ปทุมวัน</SelectItem>
                  <SelectItem value="บางกอกใหญ่">บางกอกใหญ่</SelectItem>
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
            <Button onClick={() => setFilterOpen(false)} className="flex-1">
              ค้นหา
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
