import { useState, useEffect } from 'react'
import { CheckCircleIcon, XCircleIcon, Bars3Icon } from '@heroicons/react/24/outline'

type BookingStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED'

type BookingRequest = {
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

export function DemoAdminDashboardPage() {
  const [bookings, setBookings] = useState<BookingRequest[]>([])
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  // Polling localStorage
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

  const updateStatus = (id: string, newStatus: BookingStatus) => {
    const updated = bookings.map((b) => (b.id === id ? { ...b, status: newStatus } : b))
    setBookings(updated)
    localStorage.setItem('demo_bookings', JSON.stringify(updated))
    
    // Show toast (Mock LINE Notify)
    const action = newStatus === 'APPROVED' ? 'อนุมัติ' : 'ปฏิเสธ'
    setToast({
      message: `[LINE Notify] ส่งแจ้งเตือนการ${action}ไปยังผู้จองแล้ว!`,
      type: newStatus === 'APPROVED' ? 'success' : 'error'
    })
    
    setTimeout(() => setToast(null), 3500)
  }

  const pendingBookings = bookings.filter((b) => b.status === 'PENDING')
  const historyBookings = bookings.filter((b) => b.status !== 'PENDING')

  return (
    <div className="drawer lg:drawer-open bg-base-200 min-h-screen font-sans" data-theme="dashwind-light">
      <input id="admin-drawer" type="checkbox" className="drawer-toggle" />
      <div className="drawer-content flex flex-col">
        {/* Navbar */}
        <div className="w-full navbar bg-base-100 shadow-sm border-b border-base-200">
          <div className="flex-none lg:hidden">
            <label htmlFor="admin-drawer" className="btn btn-square btn-ghost">
              <Bars3Icon className="inline-block w-6 h-6 stroke-current" />
            </label>
          </div>
          <div className="flex-1 px-2 mx-2 font-bold text-xl text-base-content">EasyBook Admin Demo</div>
          <div className="flex-none">
            <div className="avatar placeholder">
              <div className="bg-neutral text-neutral-content rounded-full w-10">
                <span>AD</span>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <main className="p-6 max-w-7xl mx-auto w-full flex-1">
          <h1 className="text-2xl font-bold mb-6 text-base-content">กระดานสรุปผล (Dashboard)</h1>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="stat bg-base-100 rounded-xl shadow-sm border border-base-200">
              <div className="stat-title">คำขอรอตรวจสอบ</div>
              <div className="stat-value text-warning">{pendingBookings.length}</div>
            </div>
            <div className="stat bg-base-100 rounded-xl shadow-sm border border-base-200">
              <div className="stat-title">อนุมัติแล้ววันนี้</div>
              <div className="stat-value text-success">
                {historyBookings.filter(b => b.status === 'APPROVED' && b.date === new Date().toISOString().split('T')[0]).length}
              </div>
            </div>
            <div className="stat bg-base-100 rounded-xl shadow-sm border border-base-200">
              <div className="stat-title">สถานที่ทั้งหมด</div>
              <div className="stat-value text-base-content">9</div>
            </div>
          </div>

          <div className="bg-base-100 rounded-xl shadow-sm border border-base-200 overflow-hidden mb-8">
            <div className="p-4 border-b border-base-200 bg-base-100 flex justify-between items-center">
              <h2 className="text-lg font-bold text-base-content">รายการคำขอรอดำเนินการ (Pending Requests)</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="table table-zebra w-full text-base-content">
                <thead className="bg-base-200 text-base-content font-semibold">
                  <tr>
                    <th>วันที่จอง</th>
                    <th>เวลา</th>
                    <th>สถานที่</th>
                    <th>รายละเอียด</th>
                    <th>จำนวนคน</th>
                    <th className="text-right">จัดการ</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingBookings.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-base-content/50">
                        ไม่มีคำขอจองค้างในระบบ
                      </td>
                    </tr>
                  ) : (
                    pendingBookings.map((b) => (
                      <tr key={b.id}>
                        <td>{b.date}</td>
                        <td>{b.startTime} - {b.endTime} {b.endTime <= b.startTime && <span className="text-xs text-error font-bold">(ข้ามวัน)</span>}</td>
                        <td className="font-semibold">{b.venueName}</td>
                        <td>{b.purpose}</td>
                        <td>{b.attendees}</td>
                        <td className="text-right space-x-2">
                          <button
                            className="btn btn-sm btn-success text-white"
                            onClick={() => updateStatus(b.id, 'APPROVED')}
                          >
                            <CheckCircleIcon className="w-4 h-4" /> อนุมัติ
                          </button>
                          <button
                            className="btn btn-sm btn-error btn-outline"
                            onClick={() => updateStatus(b.id, 'REJECTED')}
                          >
                            <XCircleIcon className="w-4 h-4" /> ปฏิเสธ
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-base-100 rounded-xl shadow-sm border border-base-200 overflow-hidden">
            <div className="p-4 border-b border-base-200 bg-base-100">
              <h2 className="text-lg font-bold text-base-content">ประวัติการจัดการล่าสุด</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="table w-full text-base-content">
                <thead className="bg-base-200 text-base-content font-semibold">
                  <tr>
                    <th>สถานะ</th>
                    <th>สถานที่</th>
                    <th>วันที่จอง</th>
                  </tr>
                </thead>
                <tbody>
                  {historyBookings.slice(0, 5).map((b) => (
                    <tr key={b.id}>
                      <td>
                        {b.status === 'APPROVED' ? (
                          <div className="badge badge-success text-xs text-white">อนุมัติแล้ว</div>
                        ) : b.status === 'CANCELLED' ? (
                          <div className="badge badge-neutral text-xs text-white">ยกเลิกโดยผู้ใช้</div>
                        ) : (
                          <div className="badge badge-error text-xs text-white">ปฏิเสธ</div>
                        )}
                      </td>
                      <td>{b.venueName}</td>
                      <td>{b.date}</td>
                    </tr>
                  ))}
                  {historyBookings.length === 0 && (
                    <tr><td colSpan={3} className="text-center py-4 text-base-content/50">ยังไม่มีประวัติ</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>
      <div className="drawer-side z-40">
        <label htmlFor="admin-drawer" className="drawer-overlay"></label>
        <ul className="menu p-4 w-64 h-full bg-base-100 text-base-content border-r border-base-200">
          <div className="text-2xl font-black text-primary mb-8 px-4 mt-2">EasyBook</div>
          <li><a className="active">Dashboard (Demo)</a></li>
          <li><a className="opacity-50 cursor-not-allowed">จัดการสถานที่</a></li>
          <li><a className="opacity-50 cursor-not-allowed">รายงาน</a></li>
          <div className="divider"></div>
          <li><a className="text-error">ออกจากระบบ</a></li>
        </ul>
      </div>

      {/* Toast Notification */}
      {toast && (
        <div className="toast toast-top toast-end z-50 mt-16 lg:mt-0">
          <div className={`alert ${toast.type === 'success' ? 'alert-success text-white' : 'alert-error text-white'} shadow-lg`}>
            {toast.type === 'success' ? <CheckCircleIcon className="w-6 h-6 shrink-0" /> : <XCircleIcon className="w-6 h-6 shrink-0" />}
            <span className="font-semibold">{toast.message}</span>
          </div>
        </div>
      )}
    </div>
  )
}
