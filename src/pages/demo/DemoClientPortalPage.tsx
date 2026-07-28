import { useState, useEffect } from 'react'
import {
  MagnifyingGlassIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CheckCircleIcon,
  XCircleIcon,
  CalendarDaysIcon,
} from '@heroicons/react/24/outline'

// ==========================================
// 1. MOCK DATA & TYPES
// ==========================================
export type Venue = {
  id: string
  name: string
  category: string
  capacity: number
  status: 'OPEN' | 'CLOSED'
  imageUrl: string
  description: string
  facilities: string[]
}

export const MOCK_VENUES: Venue[] = [
  {
    id: 'v1',
    name: 'หอประชุมวารณ',
    category: 'หอประชุม',
    capacity: 500,
    status: 'OPEN',
    imageUrl: 'https://placehold.co/600x400/2563eb/white?text=Waran+Hall',
    description: 'หอประชุมขนาดใหญ่ เหมาะสำหรับจัดกิจกรรมระดับโรงเรียน',
    facilities: ['เครื่องเสียงชุดใหญ่', 'โปรเจคเตอร์ 2 ตัว', 'แอร์'],
  },
  {
    id: 'v2',
    name: 'สนามฟุตบอลเทศบาล',
    category: 'สนามกีฬา',
    capacity: 1000,
    status: 'OPEN',
    imageUrl: 'https://placehold.co/600x400/16a34a/white?text=Football+Field',
    description: 'สนามหญ้าจริงขนาดมาตรฐาน สำหรับแข่งกีฬาและกีฬาสี',
    facilities: ['ไฟส่องสว่าง', 'อัฒจันทร์'],
  },
  {
    id: 'v3',
    name: 'ห้องประชุม A101',
    category: 'ห้องประชุม',
    capacity: 50,
    status: 'OPEN',
    imageUrl: 'https://placehold.co/600x400/9333ea/white?text=Meeting+A101',
    description: 'ห้องประชุมย่อย อาคาร A สำหรับประชุมแผนก',
    facilities: ['ทีวี 65 นิ้ว', 'แอร์', 'กระดานไวท์บอร์ด'],
  },
  {
    id: 'v4',
    name: 'ห้องสมุด',
    category: 'อาคารเรียน',
    capacity: 100,
    status: 'CLOSED',
    imageUrl: 'https://placehold.co/600x400/dc2626/white?text=Library',
    description: 'พื้นที่กำลังปิดปรับปรุงชั่วคราว',
    facilities: [],
  },
  {
    id: 'v5',
    name: 'ลานกิจกรรมโดม',
    category: 'ลานกิจกรรม',
    capacity: 200,
    status: 'OPEN',
    imageUrl: 'https://placehold.co/600x400/ea580c/white?text=Activity+Area',
    description: 'ลานโดมในร่ม พื้นยางสังเคราะห์',
    facilities: ['พัดลมยักษ์'],
  },
  {
    id: 'v6',
    name: 'โรงอาหารกลาง',
    category: 'อาคารเรียน',
    capacity: 300,
    status: 'OPEN',
    imageUrl: 'https://placehold.co/600x400/0891b2/white?text=Canteen',
    description: 'พื้นที่จัดเลี้ยงและรับประทานอาหาร',
    facilities: ['โต๊ะเก้าอี้', 'อ่างล้างมือ'],
  },
  {
    id: 'v7',
    name: 'ห้องแล็บคอมพิวเตอร์',
    category: 'ห้องเรียน',
    capacity: 40,
    status: 'OPEN',
    imageUrl: 'https://placehold.co/600x400/4f46e5/white?text=Com+Lab+1',
    description: 'ห้องเรียนคอมพิวเตอร์ 1',
    facilities: ['PC 40 เครื่อง', 'โปรเจคเตอร์', 'แอร์'],
  },
  {
    id: 'v8',
    name: 'ห้องวิทยาศาสตร์',
    category: 'ห้องเรียน',
    capacity: 40,
    status: 'OPEN',
    imageUrl: 'https://placehold.co/600x400/059669/white?text=Science+Lab',
    description: 'ห้องทดลองทางวิทยาศาสตร์',
    facilities: ['อ่างล้างมือ', 'อุปกรณ์ทดลองพื้นฐาน'],
  },
  {
    id: 'v9',
    name: 'โรงยิมเนเซียม',
    category: 'สนามกีฬา',
    capacity: 300,
    status: 'OPEN',
    imageUrl: 'https://placehold.co/600x400/be123c/white?text=Gymnasium',
    description: 'โรงยิมอเนกประสงค์ พื้นไม้ปาร์เก้',
    facilities: ['สนามบาสเกตบอล', 'สนามวอลเลย์บอล', 'ห้องน้ำแยกชายหญิง'],
  },
]

export type BookingStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED'

export type BookingRequest = {
  id: string
  venueId: string
  venueName: string
  date: string
  startTime: string
  endTime: string
  purpose: string
  attendees: number
  status: BookingStatus
  createdAt: string
}

export const getBookingTimes = (date: string, startTime: string, endTime: string) => {
  const start = new Date(`${date}T${startTime}`)
  const end = new Date(`${date}T${endTime}`)
  if (end <= start) {
    end.setDate(end.getDate() + 1)
  }
  return { start, end }
}

// ==========================================
// 2. MAIN COMPONENT (State Manager)
// ==========================================
export function DemoClientPortalPage() {
  const [screen, setScreen] = useState<'home' | 'details' | 'form' | 'my-bookings'>('home')
  const [selectedVenue, setSelectedVenue] = useState<Venue | null>(null)
  const [bookings, setBookings] = useState<BookingRequest[]>([])

  // Load from localStorage on mount and poll every second to sync with Admin tab
  useEffect(() => {
    const loadBookings = () => {
      const stored = localStorage.getItem('demo_bookings')
      if (stored) {
        setBookings(JSON.parse(stored))
      }
    }
    loadBookings()
    const interval = setInterval(loadBookings, 1000)
    return () => clearInterval(interval)
  }, [])

  // Navigation handlers
  const goHome = () => setScreen('home')
  const goMyBookings = () => setScreen('my-bookings')
  const openDetails = (venue: Venue) => {
    setSelectedVenue(venue)
    setScreen('details')
  }
  const openForm = () => {
    setScreen('form')
  }

  // Save new booking
  const handleCreateBooking = (newBooking: BookingRequest) => {
    const updated = [newBooking, ...bookings]
    setBookings(updated)
    localStorage.setItem('demo_bookings', JSON.stringify(updated))
    setScreen('my-bookings') // Go to my bookings after success
  }

  const cancelBooking = (id: string) => {
    const updated = bookings.map((b) => (b.id === id ? { ...b, status: 'CANCELLED' as BookingStatus } : b))
    setBookings(updated)
    localStorage.setItem('demo_bookings', JSON.stringify(updated))
  }

  return (
    <div className="mx-auto min-h-screen max-w-md bg-base-200 pb-20 shadow-2xl relative">
      {screen === 'home' && <HomeScreen onSelect={openDetails} />}
      {screen === 'details' && selectedVenue && (
        <DetailsScreen venue={selectedVenue} onBack={goHome} onBook={openForm} bookings={bookings} />
      )}
      {screen === 'form' && selectedVenue && (
        <FormScreen
          venue={selectedVenue}
          onBack={() => setScreen('details')}
          onSubmit={handleCreateBooking}
          bookings={bookings} // pass bookings to check overlaps
        />
      )}
      {screen === 'my-bookings' && <MyBookingsScreen bookings={bookings} onCancel={cancelBooking} />}

      {/* Bottom Navigation */}
      {(screen === 'home' || screen === 'my-bookings') && (
        <div className="fixed bottom-0 w-full max-w-md bg-base-100 shadow-[0_-4px_15px_rgb(0,0,0,0.05)] z-50 flex border-t border-base-200">
          <button
            className={`flex-1 flex flex-col items-center justify-center py-3 transition-colors ${screen === 'home' ? 'text-primary font-bold' : 'text-base-content/60 hover:bg-base-200/50'}`}
            onClick={goHome}
          >
            <MagnifyingGlassIcon className="h-6 w-6 mb-1" />
            <span className="text-[10px] uppercase tracking-wider">ค้นหา</span>
          </button>
          <button
            className={`flex-1 flex flex-col items-center justify-center py-3 transition-colors ${screen === 'my-bookings' ? 'text-primary font-bold' : 'text-base-content/60 hover:bg-base-200/50'}`}
            onClick={goMyBookings}
          >
            <CalendarDaysIcon className="h-6 w-6 mb-1" />
            <span className="text-[10px] uppercase tracking-wider">การจองของฉัน</span>
          </button>
        </div>
      )}
    </div>
  )
}

// ==========================================
// 3. SCREENS
// ==========================================

function HomeScreen({ onSelect }: { onSelect: (v: Venue) => void }) {
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState('ทั้งหมด')

  const categories = ['ทั้งหมด', 'ห้องประชุม', 'หอประชุม', 'สนามกีฬา', 'ห้องเรียน', 'ลานกิจกรรม']

  const filtered = MOCK_VENUES.filter((v) => {
    const matchCat = activeTab === 'ทั้งหมด' || v.category === activeTab
    const matchSearch = v.name.includes(search)
    return matchCat && matchSearch
  })

  return (
    <div className="flex flex-col h-full">
      <div className="bg-primary px-4 pt-8 pb-4 text-primary-content shadow-md">
        <h1 className="text-xl font-bold">ระบบจองสถานที่</h1>
        <p className="text-sm opacity-80">โรงเรียนเทศบาลท่าโขลง 1</p>
        <div className="mt-4 relative">
          <MagnifyingGlassIcon className="absolute left-3 top-3 h-5 w-5 text-base-content/50" />
          <input
            type="text"
            placeholder="ค้นหาสถานที่..."
            className="input input-bordered w-full rounded-full pl-10 text-base-content bg-base-100"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="px-4 py-3 overflow-x-auto whitespace-nowrap bg-base-100 shadow-sm scrollbar-hide">
        <div className="tabs tabs-box gap-2">
          {categories.map((cat) => (
            <button
              key={cat}
              className={`tab ${activeTab === cat ? 'tab-active' : ''}`}
              onClick={() => setActiveTab(cat)}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 p-4 space-y-4 overflow-y-auto">
        {filtered.map((venue) => (
          <div
            key={venue.id}
            className="card bg-base-100 shadow-sm border border-base-300 cursor-pointer active:scale-[0.98] transition-transform"
            onClick={() => onSelect(venue)}
          >
            <figure className="h-32 w-full">
              <img src={venue.imageUrl} alt={venue.name} className="object-cover w-full h-full" />
            </figure>
            <div className="card-body p-4">
              <div className="flex justify-between items-start">
                <h2 className="card-title text-base">{venue.name}</h2>
                {venue.status === 'OPEN' ? (
                  <div className="badge badge-success badge-sm text-xs text-white">เปิดให้บริการ</div>
                ) : (
                  <div className="badge badge-error badge-sm text-xs text-white">ปิดปรับปรุง</div>
                )}
              </div>
              <p className="text-sm text-base-content/60">ความจุ: {venue.capacity} คน</p>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="text-center text-base-content/50 mt-10">ไม่พบสถานที่ที่ค้นหา</div>
        )}
      </div>
    </div>
  )
}

function DetailsScreen({
  venue,
  onBack,
  onBook,
  bookings,
}: {
  venue: Venue
  onBack: () => void
  onBook: () => void
  bookings: BookingRequest[]
}) {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  
  const selectedBookings = bookings.filter((b) => {
    if (b.venueId !== venue.id || b.status === 'REJECTED' || b.status === 'CANCELLED') return false;
    const { start, end } = getBookingTimes(b.date, b.startTime, b.endTime)
    const dayStart = new Date(`${selectedDate}T00:00:00`)
    const dayEnd = new Date(`${selectedDate}T23:59:59`)
    return start <= dayEnd && end > dayStart
  })

  const [currentMonth, setCurrentMonth] = useState(() => {
     const d = new Date()
     return new Date(d.getFullYear(), d.getMonth(), 1)
  })

  const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate()
  const firstDayOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay()
  
  const calendarDays: (Date | null)[] = []
  for (let i = 0; i < firstDayOfMonth; i++) calendarDays.push(null)
  for (let i = 1; i <= daysInMonth; i++) calendarDays.push(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), i))

  const prevMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))
  const nextMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))
  
  const monthNames = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"]
  const monthName = monthNames[currentMonth.getMonth()]
  const yearStr = currentMonth.getFullYear() + 543

  const formatValue = (d: Date) => {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${dd}`
  }

  return (
    <div className="flex flex-col min-h-screen bg-base-100 relative">
      <div className="absolute top-0 left-0 w-full z-10 p-4 flex items-center gap-2">
        <button onClick={onBack} className="btn btn-circle btn-sm bg-base-100/80 backdrop-blur border-none shadow-md">
          <ChevronLeftIcon className="h-5 w-5 text-base-content" />
        </button>
      </div>

      <div className="h-64 w-full">
        <img src={venue.imageUrl} alt={venue.name} className="object-cover w-full h-full" />
      </div>

      <div className="p-5 pb-24">
        <div className="flex justify-between items-center mb-2">
          <h1 className="text-2xl font-bold">{venue.name}</h1>
          <div className="badge badge-primary">{venue.category}</div>
        </div>
        <p className="text-base-content/70">{venue.description}</p>
        
        <div className="mt-4 flex items-center gap-2 text-sm">
          <span className="font-semibold">ความจุ:</span> {venue.capacity} คน
        </div>

        <div className="mt-4">
          <h3 className="font-semibold mb-2">สิ่งอำนวยความสะดวก</h3>
          <div className="flex flex-wrap gap-2">
            {venue.facilities.length > 0 ? (
              venue.facilities.map((fac) => (
                <div key={fac} className="badge badge-outline badge-sm py-2 px-3">{fac}</div>
              ))
            ) : (
              <span className="text-sm text-base-content/50">ไม่มีข้อมูล</span>
            )}
          </div>
        </div>

        <div className="divider"></div>

        <h3 className="font-bold mb-4 flex items-center gap-2">
          <CalendarDaysIcon className="h-5 w-5 text-primary" /> ตารางการใช้งาน
        </h3>
        
        {/* Monthly Calendar View */}
        <div className="bg-base-100 border border-base-200 rounded-2xl p-4 shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <button className="btn btn-sm btn-ghost btn-circle" onClick={prevMonth}><ChevronLeftIcon className="w-5 h-5"/></button>
            <div className="font-bold text-lg">{monthName} {yearStr}</div>
            <button className="btn btn-sm btn-ghost btn-circle" onClick={nextMonth}><ChevronRightIcon className="w-5 h-5"/></button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center mb-2">
            {['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'].map(d => <div key={d} className="text-xs font-bold text-base-content/50">{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((d, idx) => {
              if (!d) return <div key={`empty-${idx}`} className="p-2"></div>
              
              const val = formatValue(d)
              const isSelected = selectedDate === val
              const isToday = formatValue(new Date()) === val
              
              const hasBooking = bookings.some(b => {
                if (b.venueId !== venue.id || b.status === 'REJECTED' || b.status === 'CANCELLED') return false;
                const { start, end } = getBookingTimes(b.date, b.startTime, b.endTime)
                const dayStart = new Date(`${val}T00:00:00`)
                const dayEnd = new Date(`${val}T23:59:59`)
                return start <= dayEnd && end > dayStart
              })

              return (
                <button
                  key={val}
                  onClick={() => setSelectedDate(val)}
                  className={`relative flex flex-col items-center justify-center h-10 w-full rounded-lg text-sm transition-all ${
                    isSelected
                      ? 'bg-primary text-primary-content font-bold shadow-md'
                      : isToday 
                        ? 'bg-base-200 text-primary font-bold hover:bg-base-300'
                        : 'hover:bg-base-200 text-base-content'
                  }`}
                >
                  <span>{d.getDate()}</span>
                  {hasBooking && (
                    <div className={`w-1 h-1 rounded-full absolute bottom-1 ${isSelected ? 'bg-white' : 'bg-error'}`} />
                  )}
                </button>
              )
            })}
          </div>
        </div>
        
        <div className="bg-base-200 rounded-2xl p-4 mt-2 shadow-inner border border-base-300/50">
          {selectedBookings.length > 0 ? (
            <div className="space-y-3">
              {selectedBookings.map((b) => (
                <div key={b.id} className="flex items-center gap-4 bg-base-100 p-4 rounded-xl shadow-sm border border-base-200 hover:border-primary/30 transition-colors">
                  <div className={`w-1.5 h-12 rounded-full ${b.status === 'APPROVED' ? 'bg-success' : 'bg-warning'}`}></div>
                  <div className="flex-1">
                    <div className="text-sm font-bold text-base-content">{b.startTime} - {b.endTime} น. {b.endTime <= b.startTime && <span className="text-[10px] text-error">(ข้ามวัน)</span>}</div>
                    <div className="text-xs text-base-content/70 mt-1">{b.purpose}</div>
                  </div>
                  <div className="text-right">
                    {b.status === 'APPROVED' ? (
                      <span className="badge badge-success badge-sm text-[10px] text-white">อนุมัติ</span>
                    ) : (
                      <span className="badge badge-warning badge-sm text-[10px]">รอตรวจ</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <CheckCircleIcon className="h-12 w-12 text-success/50 mx-auto mb-3" />
              <p className="text-sm text-base-content/70 font-semibold">ไม่มีคิวจองในวันนี้</p>
              <p className="text-xs text-base-content/50 mt-1">คุณสามารถจองได้เลย</p>
            </div>
          )}
        </div>
      </div>

      <div className="fixed bottom-0 left-0 w-full bg-base-100 p-4 shadow-[0_-4px_15px_rgb(0,0,0,0.1)] z-50 max-w-md mx-auto right-0">
        <button 
          className="btn btn-primary w-full text-lg shadow-lg" 
          onClick={onBook}
          disabled={venue.status === 'CLOSED'}
        >
          {venue.status === 'CLOSED' ? 'ปิดให้บริการ' : 'จองสถานที่นี้'}
        </button>
      </div>
    </div>
  )
}

function FormScreen({
  venue,
  onBack,
  onSubmit,
  bookings
}: {
  venue: Venue
  onBack: () => void
  onSubmit: (b: BookingRequest) => void
  bookings: BookingRequest[]
}) {
  const getInitialTimes = () => {
    const d = new Date()
    let h = d.getHours()
    let m = d.getMinutes()
    
    if (m > 0 && m <= 30) {
      m = 30
    } else if (m > 30) {
      m = 0
      h += 1
    }
    
    if (h >= 24) {
      h = 0
      d.setDate(d.getDate() + 1)
    }
    
    const startTime = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
    
    let endH = h + 1
    if (endH >= 24) endH = 0
    const endTime = `${endH.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
    
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    const dateStr = `${year}-${month}-${day}`
    
    return { dateStr, startTime, endTime }
  }

  const [initial] = useState(() => getInitialTimes())
  const [date, setDate] = useState(initial.dateStr)
  const [startTime, setStartTime] = useState(initial.startTime)
  const [endTime, setEndTime] = useState(initial.endTime)
  const [purpose, setPurpose] = useState('')
  const [attendees, setAttendees] = useState(venue.capacity.toString())
  
  const now = new Date()
  const { start: currentStart, end: currentEnd } = getBookingTimes(date, startTime, endTime)
  const isPast = currentStart < now
  
  const isOverlap = bookings.some((b) => {
    if (b.venueId !== venue.id || b.status === 'REJECTED' || b.status === 'CANCELLED') return false;
    const { start: bStart, end: bEnd } = getBookingTimes(b.date, b.startTime, b.endTime)
    return currentStart < bEnd && currentEnd > bStart
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (isOverlap) return;
    
    onSubmit({
      id: 'req-' + Math.random().toString(36).substr(2, 9),
      venueId: venue.id,
      venueName: venue.name,
      date,
      startTime,
      endTime,
      purpose,
      attendees: parseInt(attendees, 10),
      status: 'PENDING',
      createdAt: new Date().toISOString(),
    })
  }

  return (
    <div className="min-h-screen bg-base-100">
      <div className="navbar bg-base-100 shadow-sm sticky top-0 z-10">
        <button onClick={onBack} className="btn btn-ghost btn-circle">
          <ChevronLeftIcon className="h-6 w-6" />
        </button>
        <h1 className="text-lg font-bold">สร้างคำขอจอง</h1>
      </div>

      <div className="p-5">
        <div className="bg-primary/10 rounded-xl p-4 mb-6 border border-primary/20">
          <p className="text-xs text-primary font-semibold uppercase mb-1">สถานที่</p>
          <p className="text-base font-bold">{venue.name}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <fieldset className="fieldset">
            <legend className="fieldset-legend font-semibold">วันที่ต้องการใช้งาน</legend>
            <input type="date" className="input input-bordered w-full" value={date} onChange={(e) => setDate(e.target.value)} required />
          </fieldset>

          <div className="grid grid-cols-2 gap-4">
            <fieldset className="fieldset">
              <legend className="fieldset-legend font-semibold">เวลาเริ่มต้น</legend>
              <input type="time" className="input input-bordered w-full" value={startTime} onChange={(e) => setStartTime(e.target.value)} required />
            </fieldset>
            <fieldset className="fieldset">
              <legend className="fieldset-legend font-semibold">เวลาสิ้นสุด</legend>
              <input type="time" className="input input-bordered w-full" value={endTime} onChange={(e) => setEndTime(e.target.value)} required />
            </fieldset>
          </div>

          <fieldset className="fieldset">
            <legend className="fieldset-legend font-semibold">จำนวนผู้เข้าร่วม (คน)</legend>
            <input type="number" className="input input-bordered w-full" value={attendees} onChange={(e) => setAttendees(e.target.value)} max={venue.capacity} required />
            <span className="fieldset-label text-xs text-base-content/50">สูงสุดไม่เกิน {venue.capacity} คน</span>
          </fieldset>

          <fieldset className="fieldset">
            <legend className="fieldset-legend font-semibold">รายละเอียด</legend>
            <textarea className="textarea textarea-bordered w-full h-24" placeholder="ระบุรายละเอียด..." value={purpose} onChange={(e) => setPurpose(e.target.value)} required></textarea>
          </fieldset>

          {isPast && (
            <div className="alert alert-error mt-6 text-sm">
              <XCircleIcon className="h-5 w-5 shrink-0" />
              <span>ไม่สามารถจองเวลาย้อนหลังได้</span>
            </div>
          )}

          {isOverlap && !isPast && (
            <div className="alert alert-error mt-6 text-sm">
              <XCircleIcon className="h-5 w-5 shrink-0" />
              <span>เวลานี้ถูกจองแล้ว โปรดเลือกเวลาอื่น</span>
            </div>
          )}

          <div className="pt-6">
            <button type="submit" className="btn btn-primary w-full text-lg shadow-md" disabled={isOverlap || isPast || !purpose || startTime === endTime}>
              ส่งคำขอจองสถานที่
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function MyBookingsScreen({ bookings, onCancel }: { bookings: BookingRequest[], onCancel: (id: string) => void }) {
  const [tab, setTab] = useState<'ACTIVE' | 'HISTORY'>('ACTIVE')

  const filtered = bookings.filter((b) => {
    if (tab === 'ACTIVE') return b.status === 'PENDING' || b.status === 'APPROVED'
    return b.status === 'REJECTED' || b.status === 'CANCELLED'
  })

  const StatusBadge = ({ status }: { status: BookingStatus }) => {
    if (status === 'PENDING') return <div className="badge badge-warning text-xs">รอตรวจสอบ</div>
    if (status === 'APPROVED') return <div className="badge badge-success text-xs text-white">อนุมัติแล้ว</div>
    if (status === 'CANCELLED') return <div className="badge badge-neutral text-xs text-white">ยกเลิกแล้ว</div>
    return <div className="badge badge-error text-xs text-white">ปฏิเสธ</div>
  }

  return (
    <div className="min-h-screen flex flex-col bg-base-200">
      <div className="bg-base-100 px-4 pt-8 pb-4 shadow-sm z-10 sticky top-0">
        <h1 className="text-xl font-bold mb-4">การจองของฉัน</h1>
        <div className="tabs tabs-bordered w-full grid grid-cols-2">
          <a className={`tab ${tab === 'ACTIVE' ? 'tab-active font-bold' : ''}`} onClick={() => setTab('ACTIVE')}>คิวปัจจุบัน</a>
          <a className={`tab ${tab === 'HISTORY' ? 'tab-active font-bold' : ''}`} onClick={() => setTab('HISTORY')}>ประวัติ</a>
        </div>
      </div>

      <div className="flex-1 p-4 space-y-4 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="text-center text-base-content/50 mt-10">ไม่มีรายการจองในหมวดหมู่นี้</div>
        ) : (
          filtered.map((b) => (
            <div key={b.id} className="card bg-base-100 shadow-sm border border-base-200">
              <div className="card-body p-4">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-bold text-base">{b.venueName}</h3>
                  <StatusBadge status={b.status} />
                </div>
                <div className="text-sm text-base-content/70 space-y-1">
                  <p><span className="font-semibold">วันที่:</span> {b.date}</p>
                  <p><span className="font-semibold">เวลา:</span> {b.startTime} - {b.endTime} น. {b.endTime <= b.startTime && <span className="text-error font-bold text-xs">(ข้ามวัน)</span>}</p>
                  <p><span className="font-semibold">รายละเอียด:</span> {b.purpose}</p>
                </div>
                
                {(b.status === 'PENDING' || b.status === 'APPROVED') && (
                  <div className="card-actions justify-end mt-4 pt-4 border-t border-base-200">
                    <button 
                      className="btn btn-sm btn-outline text-error border-error hover:bg-error hover:text-white hover:border-error" 
                      onClick={() => {
                        if (confirm('คุณต้องการยกเลิกการจองนี้ใช่หรือไม่?')) onCancel(b.id)
                      }}
                    >
                      ยกเลิกคำขอจอง
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
