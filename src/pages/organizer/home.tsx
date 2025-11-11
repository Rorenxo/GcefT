  "use client"

  import { useState, useEffect, useRef, useCallback } from "react"
  import { createPortal } from "react-dom"
  import {
    Search,
    Bell,
    ChevronLeft,
    ChevronRight,
    ArrowRight,
    Pencil,
    BarChart,
    Users,
    Trash2,
    Calendar,
    MapPin,
  } from "lucide-react"
  import { collection, query, where, onSnapshot } from "firebase/firestore"
  import { db, auth } from "@/lib/firebase"
  import { Link } from "react-router-dom"
  import { format, isSameDay } from "date-fns"
import { useAuth } from "@/hooks/useAuth"
  import notificationSound from "@/assets/notification.mp3"

  interface Event {
    id: string
    eventName: string
    department: string
    startDate: Date
    endDate: Date
    location: string
    professor: string
    description: string
    imageUrl?: string
  }

  const departmentTagColors: Record<string, string> = {
    CCS: "bg-orange-300 text-orange-900",
    CEAS: "bg-blue-300 text-blue-900",
    CAHS: "bg-red-300 text-red-900",
    CHTM: "bg-pink-300 text-pink-900",
    CBA: "bg-yellow-300 text-yellow-900",
    ALL: "bg-gray-300 text-gray-900",
  }


  export default function Home() {
    const [events, setEvents] = useState<Event[]>([])
    const [search, setSearch] = useState("")
    const [loading, setLoading] = useState(true)
    const [currentDate, setCurrentDate] = useState(new Date())
    const [selectedDay, setSelectedDay] = useState<Date | null>(null)
    const [notifications, setNotifications] = useState<{ id: string; message: string }[]>(() => {
      try {
        const saved = localStorage.getItem("organizerNotifications")
        return saved ? JSON.parse(saved) : []
      } catch {
        return []
      }
    })
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [unreadCount, setUnreadCount] = useState(() => {
      try {
        const saved = localStorage.getItem("organizerUnreadCount")
        return saved ? JSON.parse(saved) : 0
      } catch {
        return 0
      }
    })
    const { user } = useAuth()
    const isInitialLoad = useRef(true)
    const dropdownRef = useRef<HTMLDivElement>(null)

    const handleOutsideClick = useCallback(
      (event: MouseEvent) => {
        if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
          setIsModalOpen(false)
        }
      },
      [setIsModalOpen]
    )

    useEffect(() => {
      if (isModalOpen) {
        document.addEventListener("mousedown", handleOutsideClick)
      }
      return () => document.removeEventListener("mousedown", handleOutsideClick)
    }, [isModalOpen, handleOutsideClick])

    useEffect(() => {
      localStorage.setItem("organizerNotifications", JSON.stringify(notifications))
      localStorage.setItem("organizerUnreadCount", JSON.stringify(unreadCount))
    }, [notifications, unreadCount])
    useEffect(() => {
      const currentUser = auth.currentUser
      if (!currentUser) {
        console.warn("No organizer logged in")
        setLoading(false)
        return
      }

      const eventsRef = collection(db, "events")
      //@ts-ignore
      const q = user?.role === "admin" ? query(eventsRef) : query(eventsRef, where("createdBy", "==", currentUser.uid))

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const fetchedEvents: Event[] = snapshot.docs.map((doc) => {
          const data = doc.data()
          return {
            id: doc.id,
            eventName: data.eventName || "Untitled Event",
            department: data.department || "Unknown",
            startDate: data.startDate?.toDate?.() || new Date(),
            endDate: data.endDate?.toDate?.() || new Date(),
            location: data.location || "Unknown Location",
            professor: data.professor || "N/A",
            description: data.description || "No description provided.",
            imageUrl: Array.isArray(data.imageUrls)
              ? data.imageUrls[0]
              : data.imageUrl || "/placeholder.jpg",
          }
        })

        setEvents(fetchedEvents)
        setLoading(false)
      })

      return () => unsubscribe()
    }, [user])

    useEffect(() => {
      if (isInitialLoad.current) {
        isInitialLoad.current = false
        return
      }

      const newEvent = events.find(e => !notifications.some(n => n.id === e.id && n.message.startsWith("")))

      if (newEvent) {
        const playSound = async () => {
          try {
            const audio = new Audio(notificationSound)
            await audio.play()
          } catch (error) {
            console.warn("Audio playback blocked.", error)
          }
        }
        playSound()
        setNotifications(n => [{ id: newEvent.id, message: `New event created: ${newEvent.eventName}` }, ...n])
        setUnreadCount(prev => prev + 1)
      }
    }, [events, notifications]) 


    useEffect(() => {
      if (!events.length) return

      const checkUpcomingEvents = () => {
        const now = new Date()
        const upcomingEvents = events.filter((event) => {
          const diff = event.startDate.getTime() - now.getTime()
          return diff > 0 && diff <= 60 * 60 * 1000
        })

        upcomingEvents.forEach(async (event) => {
          const alreadyNotified = notifications.some(
            (n) => n.id === event.id && n.message.startsWith("🔔")
          )
          if (!alreadyNotified) {
            try {
              const audio = new Audio(notificationSound)
              await audio.play()
            } catch (error) {
              console.warn("Audio playback was blocked by the browser.", error)
            }
            setNotifications((prev) => [
              { id: event.id, message: ` ${event.eventName} starts in less than 1 hour!` },
              ...prev,
            ])
            setUnreadCount(prev => prev + 1)
          }
        })
      }

      checkUpcomingEvents()
      const interval = setInterval(checkUpcomingEvents, 60000)

      return () => clearInterval(interval)
    }, [events, notifications]) 

    const filteredEvents = events.filter((event) => {
      const term = search.trim().toLowerCase()
      return (
        !term ||
        event.eventName.toLowerCase().includes(term) ||
        event.department.toLowerCase().includes(term)
      )
    })

    const getDaysInMonth = (date: Date) =>
      new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
    const getFirstDayOfMonth = (date: Date) =>
      new Date(date.getFullYear(), date.getMonth(), 1).getDay()

    const daysInMonth = getDaysInMonth(currentDate)
    const firstDay = getFirstDayOfMonth(currentDate)
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1)
    const emptyDays = Array.from({ length: firstDay === 0 ? 6 : firstDay - 1 }, (_, i) => i)
    const monthName = currentDate.toLocaleString("default", { month: "long", year: "numeric" })

    const getEventsForDay = (day: number) => {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day)
      return events.filter((event) => isSameDay(event.startDate, date))
    }

    const eventsForSelectedDay = selectedDay
      ? events.filter((event) => isSameDay(event.startDate, selectedDay))
      : []

    // Component para sa Search at Notification sa mobile header
    const HeaderActions = () => (
      <div className="lg:hidden flex items-center gap-2">
        {/* Search Bar */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search..."
            className="pl-10 h-10 w-full border rounded-lg border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>
        {/* Notifications Button */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => {
              setIsModalOpen((prev) => !prev)
              setUnreadCount(0)
            }}
            className="relative bg-white rounded-lg p-2.5 border border-gray-200 flex items-center justify-center cursor-pointer hover:bg-gray-50 transition-colors"
          >
            <Bell className="h-5 w-5 text-gray-600" />
            {unreadCount > 0 && (
              <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse">
                {unreadCount}
              </div>
            )}
          </button>
          {/* Ang dropdown content ay mananatili sa logic ng home.tsx */}
          {isModalOpen && (
            <div className="absolute top-full right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
              {/* ... (dropdown content JSX) ... */}
            </div>
          )}
        </div>
      </div>
    )

    // State para sa portal container
    const [portalContainer, setPortalContainer] = useState<Element | null>(null)

    useEffect(() => {
      // Hanapin ang container sa Olayout.tsx kapag ready na ang DOM
      const container = document.getElementById("mobile-header-actions")
      if (container) {
        setPortalContainer(container)
      }
    }, [])

    return (
      <div className="flex h-screen bg-gray-50 overflow-auto p-6">
        {/* I-render ang HeaderActions sa #mobile-header-actions div sa Olayout.tsx */}
        {portalContainer && createPortal(<HeaderActions />, portalContainer)}
        <main className="flex-1">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Events List */}
            <div className="lg:col-span-2 space-y-6">
              <h1 className="text-3xl font-bold text-gray-900">
                {user?.role === "admin" ? "All Events" : "My Events"}
              </h1>

              {/* Events Display */}
              {loading ? (
                <div className="text-center py-12 text-gray-500">Loading Events...</div>
              ) : filteredEvents.length > 0 ? (
                <div className="grid sm:grid-cols-2 lg:grid-cols-2 gap-6">
                  {filteredEvents.map(event => (
                    <div
                      key={event.id}
                      className="rounded-2xl overflow-hidden border border-gray-200 bg-white flex flex-col shadow-sm hover:shadow-lg transition-all"
                    >
                      <Link to={`/organizer/${user?.uid}/events/${event.id}`} className="block">
                        <div className="h-40 w-full overflow-hidden">
                          <img
                            src={event.imageUrl || "/placeholder.jpg"}
                            alt={event.eventName}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="p-4 flex-grow space-y-2">
                          <h3 className="text-lg font-bold text-gray-900 mb-1">{event.eventName}</h3>
                          <div className="flex items-center gap-2 text-sm text-gray-700">
                            <Calendar className="h-4 w-4 flex-shrink-0 " />
                            <span className="font-bold">
                              {format(event.startDate, "MMM d, h:mm a")} - {format(event.endDate, "h:mm a")}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-gray-600">
                            <MapPin className="h-4 w-4 flex-shrink-0 " />
                            <span>{event.location}</span>
                          </div>
                        </div>
                      </Link>
                      <div className="p-4 pt-2 border-t border-gray-200 mt-auto">
                        <div className="flex items-center justify-between text-sm">
                          <span
                            className={`font-medium px-2 py-0.5 rounded-full ${
                              departmentTagColors[event.department] || departmentTagColors.ALL
                            }`}
                          >{event.department}</span>
                          <div className="flex items-center gap-1">
                            <button className="p-2 rounded-md bg-yellow-100 text-yellow-700 hover:bg-yellow-200 transform hover:scale-105 transition-all duration-200">
                              <Pencil className="h-4 w-4" />
                            </button>
                            <Link to="/organizer/stats">
                              <button className="p-2 rounded-md bg-green-100 text-green-700 hover:bg-green-200 transform hover:scale-105 transition-all duration-200">
                                <BarChart className="h-4 w-4" />
                              </button>
                            </Link>
                            <button className="p-2 rounded-md bg-purple-100 text-purple-700 hover:bg-purple-200 transform hover:scale-105 transition-all duration-200">
                              <Users className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() =>
                                alert(`Delete action for ${event.eventName} needs to be implemented.`)
                              }
                              className="p-2 rounded-md bg-red-100 text-red-700 hover:bg-red-200 transform hover:scale-105 transition-all duration-200"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">No Event Found</div>
              )}
            </div>

            {/* RIGHT: Notifications + Calendar */}
            <div className="space-y-6">
              {/* Header with Search and Notifications */}
              <div className="hidden lg:flex items-center gap-4">
                {/* Search Bar */}
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search Events..."
                    className="pl-10 h-11 w-full border rounded-lg border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                </div>

                {/* Notifications Button */}
                <div className="relative" ref={dropdownRef}>
                  <button
                    onClick={() => {
                      setIsModalOpen((prev) => !prev)
                      setUnreadCount(0)
                    }}
                    className="relative bg-white rounded-2xl p-3 border border-gray-200 flex items-center justify-center cursor-pointer hover:bg-gray-50 transition-colors"
                  >
                    <Bell className="h-6 w-6 text-gray-600" />
                    {unreadCount > 0 && (
                      <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center animate-pulse">
                        {unreadCount}
                      </div>
                    )}
                  </button>

                  {isModalOpen && (
                    <div className="absolute top-full right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                      <div className="p-3 border-b border-gray-200">
                        <div className="flex items-center justify-between">
                          <h3 className="font-semibold text-gray-900">Notifications</h3>
                          {notifications.length > 0 && (
                            <button
                              onClick={() => { setNotifications([]); setUnreadCount(0); }}
                              className="text-xs text-red-600 hover:text-red-800"
                            >
                              Clear All
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="max-h-[60vh] overflow-y-auto">
                        {notifications.length > 0 ? (
                          notifications.map((note) => (
                            <div key={`${note.id}-${note.message}`} className="p-3 border-b border-gray-100 hover:bg-gray-50">
                              <p className="text-sm text-gray-800 whitespace-normal">{note.message}</p>
                            </div>
                          ))
                        ) : (
                          <div className="p-4 text-center text-sm text-gray-500">No new notifications.</div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Calendar */}
              <div className="bg-white rounded-2xl p-6 border border-gray-200">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="font-semibold text-gray-900">{monthName}</h3>
                  <div className="flex gap-2">
                    <button
                      onClick={() =>
                        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1))
                      }
                      className="p-1 hover:bg-gray-100 rounded-lg"
                    >
                      <ChevronLeft className="h-5 w-5 text-gray-600" />
                    </button>
                    <button
                      onClick={() =>
                        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1))
                      }
                      className="p-1 hover:bg-gray-100 rounded-lg"
                    >
                      <ChevronRight className="h-5 w-5 text-gray-600" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-7 gap-2 mb-2 text-xs font-semibold text-gray-500">
                  {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
                    <div key={day} className="text-center py-2">
                      {day}
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-7 gap-2">
                  {emptyDays.map((_, i) => (
                    <div key={`empty-${i}`} className="aspect-square" />
                  ))}
                  {days.map((day) => {
                    const eventsOnDay = getEventsForDay(day)
                    const hasEvents = eventsOnDay.length > 0
                    return (
                      <button
                        key={day}
                        onClick={() =>
                          setSelectedDay(new Date(currentDate.getFullYear(), currentDate.getMonth(), day))
                        }
                        className={`aspect-square rounded-lg text-sm font-medium transition-colors relative ${
                          hasEvents
                            ? "bg-blue-100 text-blue-700 hover:bg-blue-200"
                            : "text-gray-700 hover:bg-gray-100"
                        }`}
                      >
                        {day}
                        {hasEvents && (
                          <span className="absolute bottom-1 left-1/2 transform -translate-x-1/2 w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Selected Day Events */}
              <div className="bg-white rounded-2xl p-6 border border-gray-200">
                <h3 className="font-semibold text-gray-900 mb-4">
                  {selectedDay ? `Events on ${format(selectedDay, "MMMM d, yyyy")}` : "Select a date"}
                </h3>
                {selectedDay ? (
                  eventsForSelectedDay.length > 0 ? (
                    <div className="space-y-3">
                      {eventsForSelectedDay.map((event) => (
                        <div
                          key={event.id}
                          className="p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-all"
                        >
                          <p className="font-medium text-gray-900">{event.eventName}</p>
                          <p className="text-xs text-gray-500">
                            {event.department} • {event.location}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">No events on this day.</p>
                  )
                ) : (
                  <p className="text-sm text-gray-500">Click a date to view events.</p>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    )
  }
