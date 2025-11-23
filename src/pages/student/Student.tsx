  "use client"

  import { motion, AnimatePresence, wrap } from "framer-motion"
  import { useEffect, useState, useRef, ComponentType } from "react"
  import { Link } from "react-router-dom"
  import {collection,query,orderBy,onSnapshot,doc,updateDoc,arrayUnion,arrayRemove,addDoc,serverTimestamp} from "firebase/firestore"
  import { db } from "@/lib/firebase"
  import useAuth from "@/shared/components/useStudentAuth"
  import {Calendar,MapPin,Heart,MessageCircle,Send,ArrowLeft,ArrowRight,Eye,Settings, X, ZoomIn, ZoomOut, LogOut} from "lucide-react"
  import { format } from "date-fns"
  import { Timestamp } from "firebase/firestore"
  import { useStudentLayoutContext } from "@/shared/components/layout/studentLayout/studentLayout"

  type EventType = {
    id: string
    eventName?: string
    department?: string
    location?: string
    startDate: Date
    endDate: Date
    professor?: string
    description?: string
    imageUrl?: string
    hearts?: string[]
    category?: 'School Event' | 'Seminar' | 'Activity' | 'Social';
  }

  type CommentType = {
    id: string
    authorId: string
    authorName: string
    text: string
    createdAt: Timestamp
  }

  const featuredEventsData = [
    {
      id: 'featured-1',
      title: 'GC APERTURA',
      description: 'Witness the clash of champions. A week of sports, spirit, and unity.',
      imageUrl: 'src/assets/APERTURA.png',
    },
    {
      id: 'featured-2',
      title: 'GC Foundation Week',
      description: 'Celebrate our history and future with a series of special events and activities.',
      imageUrl: 'src/assets/FOUNDING.jpg',
    },
    {
      id: 'featured-3',
      title: 'GC SIKLAB SPORTFEST',
      description: 'Explore the future of technology with industry leaders and innovators.',
      imageUrl: 'src/assets/SPORTSFEST.png',
    },
    {
      id: 'featured-4',
      title: 'GC-CCS ACQUAINTANCE',
      description: 'A vibrant showcase of student talent in music, dance, and visual arts.',
      imageUrl: 'src/assets/ACC.jpg',
    }
  ];

  export default function StudentFeed() {
    const [events, setEvents] = useState<EventType[]>([])
    const [loading, setLoading] = useState(true)
    const { searchQuery } = useStudentLayoutContext();
    const [activeFilter, setActiveFilter] = useState('All');
    const { user } = useAuth()
    const [commentModalEvent, setCommentModalEvent] = useState<EventType | null>(null)
    const [isProfileMenuOpen, setProfileMenuOpen] = useState(false);
    const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);
    const profileMenuRef = useRef<HTMLDivElement>(null);
    const sliderRef = useRef<HTMLDivElement>(null);
    
    useEffect(() => {
      const q = query(collection(db, "events"), orderBy("startDate", "desc"))
      const unsub = onSnapshot(q, (snap) => {
        const fetchedEvents = snap.docs.map((d) => {
          const data = d.data()
          return {
            id: d.id,
            ...data,
            startDate: data.startDate?.toDate() ?? new Date(),
            endDate: data.endDate?.toDate() ?? new Date(),
          } as EventType
        })
        setEvents(fetchedEvents)
        setLoading(false)
      })
      return () => unsub()
    }, [])

    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
          setProfileMenuOpen(false);
        }
      };
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }, []);

    const [[page, direction], setPage] = useState([0, 0]);
    const slideIndex = wrap(0, featuredEventsData.length, page);

    const paginate = (newDirection: number) => {
      setPage([page + newDirection, newDirection]);
    };

    const goToSlide = (slideIndex: number) => {
      const newDirection = slideIndex > page ? 1 : -1;
      setPage([slideIndex, newDirection]);
    }

    useEffect(() => {
      const interval = setInterval(() => {
        paginate(1);
      }, 5000); 

      return () => clearInterval(interval);
    }, [page]);


    
    const toggleLike = async (eventId: string) => {
      if (!user) return alert("Please sign in to like posts")
        
      setEvents(prevEvents =>
        prevEvents.map(event => {
          if (event.id === eventId) {
            const currentHearts = event.hearts || []
            const isLiked = currentHearts.includes(user.uid)
            const newHearts = isLiked
              ? currentHearts.filter(uid => uid !== user.uid)
              : [...currentHearts, user.uid]
            return { ...event, hearts: newHearts }
          }
          return event
        })
      )

      const eventRef = doc(db, "events", eventId)
      const eventToUpdate = events.find(e => e.id === eventId)
      const alreadyLiked = eventToUpdate?.hearts?.includes(user.uid)
      await updateDoc(eventRef, { hearts: alreadyLiked ? arrayRemove(user.uid) : arrayUnion(user.uid) })
    }

    const addComment = async (eventId: string, text: string) => {
      if (!user) return alert("Please sign in to comment")
      if (!text.trim()) return
      try {
        const commentsRef = collection(db, "events", eventId, "comments")
        await addDoc(commentsRef, {
          authorId: user.uid,
          authorName: user.displayName || user.email || "Student",
          text: text.trim(),
          createdAt: serverTimestamp(),
        })
      } catch (err) {
        console.error("Error adding comment:", err)
        alert("Failed to post comment.")
      }
    }

    if (loading) {
      return (
        <div className="flex h-screen items-center justify-center bg-background">
          <div className="flex flex-col items-center gap-4">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-muted border-t-primary" />
            <p className="text-sm text-muted-foreground">Loading events...</p>
          </div>
        </div>
      )
    }

    const searchFilteredEvents = events.filter((event) => {
        const searchMatch =
            event.eventName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            event.description?.toLowerCase().includes(searchQuery.toLowerCase());

        const categoryMatch = activeFilter === 'All' || event.category === activeFilter;

        return searchMatch && categoryMatch;
    }
    )

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const endOfToday = new Date()
    endOfToday.setHours(23, 59, 59, 999)
    const sevenDaysFromNow = new Date(today)
    sevenDaysFromNow.setDate(today.getDate() + 7)

    const trendingEvents = searchFilteredEvents
      .filter(event => event.startDate >= today && (event.hearts?.length || 0) > 0) 
      .sort((a, b) => (b.hearts?.length || 0) - (a.hearts?.length || 0)) 
      .slice(0, 3); 


    const todaysEvents = searchFilteredEvents.filter(event => event.startDate >= today && event.startDate <= endOfToday);

    const upcomingEvents = searchFilteredEvents.filter(event => event.startDate > endOfToday && event.startDate <= sevenDaysFromNow);

    const pastEvents = searchFilteredEvents.filter(event => event.startDate < today);

    return (
      <>
          <section className="bg-gradient-to-b from-slate-50 to-white pt-4">
            <div className="relative px-4 md:px-8 ">
              <div className="relative h-96 w-full overflow-hidden">
                <AnimatePresence initial={false} custom={direction}>
                  <FeaturedEventCard
                    key={page}
                    title={featuredEventsData[slideIndex].title}
                    description={featuredEventsData[slideIndex].description}
                    imageUrl={featuredEventsData[slideIndex].imageUrl}
                    direction={direction}
                  />
                </AnimatePresence>
                <div className="absolute top-1/2 -translate-y-1/2 left-2 md:left-4 z-20">
                  <button onClick={() => paginate(-1)} className="bg-white/60 hover:bg-white backdrop-blur-sm rounded-full p-2 shadow-md transition-all">
                    <ArrowLeft className="h-6 w-6 text-gray-800" />
                  </button>
                </div>
                <div className="absolute top-1/2 -translate-y-1/2 right-2 md:right-4 z-20">
                  <button onClick={() => paginate(1)} className="bg-white/60 hover:bg-white backdrop-blur-sm rounded-full p-2 shadow-md transition-all">
                    <ArrowRight className="h-6 w-6 text-gray-800" />
                  </button>
                </div>
              </div>
              {/* Slider Dots */}
              <div className="flex justify-center gap-2 mt-4">
                {featuredEventsData.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => goToSlide(index)}
                    className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
                      slideIndex === index ? 'bg-green-600 scale-125' : 'bg-gray-300 hover:bg-gray-400'
                    }`}
                    aria-label={`Go to slide ${index + 1}`}
                  />
                ))}
              </div>
            </div>

            {/* Category Filters */}
            <div className="px-4 md:px-8 py-6">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 md:gap-6">
                <FilterCard
                  label="All Events"
                  imageUrl="src/assets/campusEvent.jpg"
                  isActive={activeFilter === 'All'}
                  onClick={() => setActiveFilter('All')}
                />
                <FilterCard
                  label="Seminars"
                  imageUrl="src/assets/gcSeminar.jpg"
                  isActive={activeFilter === 'Seminar'}
                  onClick={() => setActiveFilter('Seminar')}
                />
                <FilterCard
                  label="Activities"
                  imageUrl="src/assets/gcAct.jpg"
                  isActive={activeFilter === 'Activity'}
                  onClick={() => setActiveFilter('Activity')}
                />
                <FilterCard
                  label="Social"
                  imageUrl="src/assets/socialGC.jpg"
                  isActive={activeFilter === 'Social'}
                  onClick={() => setActiveFilter('Social')}
                />
              </div>
            </div>

            <div className="p-4 md:p-6">
              {searchFilteredEvents.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20">
                  <div className="text-center">
                    <p className="text-muted-foreground text-lg mb-2">
                      {searchQuery
                        ? "No events match your search." : "No events available."}
                    </p>
                    <p className="text-muted-foreground text-sm">Check back soon for exciting campus events!</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-10">
                  {/* Trending Events */}
                  {trendingEvents.length > 0 && (
                    <div>
                      <div className="flex items-center gap-3 mb-6">
                        <div className="flex items-center gap-2">
                          <div className="w-1 h-8 bg-gradient-to-b from-pink-500 to-rose-500 rounded-full"></div>
                          <h3 className="text-2xl font-bold text-foreground">Trending Now</h3>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 gap-6">
                        {trendingEvents.map((event) => (
                          <TrendingEventCard
                            key={`trending-${event.id}`}
                            event={event}
                            onCommentClick={(event) => setCommentModalEvent(event)}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Upcoming Events */}
                  {upcomingEvents.length > 0 && (
                    <div>
                      <div className="flex items-center gap-3 mb-6">
                        <div className="flex items-center gap-2">
                          <div className="w-1 h-8 bg-gradient-to-b from-indigo-600 to-purple-600 rounded-full"></div>
                          <h3 className="text-2xl font-bold text-foreground">Upcoming Events</h3>
                        </div>
                        <span className="ml-auto text-sm font-semibold px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full">
                          {upcomingEvents.length}
                        </span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {upcomingEvents.map((event) => (
                          <EventCard
                            key={event.id}
                            event={event}
                            onLike={toggleLike}
                            currentUser={user}
                            onCommentClick={(event) => setCommentModalEvent(event)}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Today's Events */}
                  {todaysEvents.length > 0 && (
                    <div>
                      <div className="flex items-center gap-3 mb-6">
                        <div className="flex items-center gap-2">
                          <div className="w-1 h-8 bg-gradient-to-b from-orange-500 to-red-500 rounded-full"></div>
                          <h3 className="text-2xl font-bold text-foreground">Today's Events</h3>
                        </div>
                        <span className="ml-auto text-sm font-semibold px-3 py-1 bg-orange-100 text-orange-700 rounded-full">
                          {todaysEvents.length}
                        </span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {todaysEvents.map((event) => (
                          <EventCard
                            key={event.id}
                            event={event}
                            onLike={toggleLike}
                            currentUser={user}
                            onCommentClick={(event) => setCommentModalEvent(event)}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Past Events */}
                  {pastEvents.length > 0 && (
                    <div>
                      <div className="flex items-center gap-3 mb-6">
                        <div className="flex items-center gap-2">
                          <div className="w-1 h-8 bg-gradient-to-b from-gray-400 to-gray-600 rounded-full"></div>
                          <h3 className="text-2xl font-bold text-foreground">Past Events</h3>
                        </div>
                        <span className="ml-auto text-sm font-semibold px-3 py-1 bg-gray-100 text-gray-700 rounded-full">
                          {pastEvents.length}
                        </span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {pastEvents.map((event) => (
                          <EventCard
                            key={event.id}
                            event={event}
                            onLike={toggleLike}
                            currentUser={user}
                            onCommentClick={(event) => setCommentModalEvent(event)}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>
        <AnimatePresence>
          {commentModalEvent && (
            <ExpandedEventCard
              event={commentModalEvent}
              onClose={() => setCommentModalEvent(null)}
              onLike={toggleLike}
              onComment={addComment}
            />
          )}
        </AnimatePresence>

        <AnimatePresence>
          {isLogoutConfirmOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6"
              >
                <h3 className="text-lg font-bold text-gray-900">Confirm Logout</h3>
                <p className="text-sm text-gray-600 mt-2">Are you sure you want to log out of your account?</p>
                <div className="mt-6 flex justify-end gap-3">
                  <button
                    onClick={() => setIsLogoutConfirmOpen(false)}
                    className="px-4 py-2 text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button onClick={() => { /* This will now use the layout's handleLogout */ }} className="px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors">
                    Logout
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

      </>
    )
  }

  const sliderVariants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 1000 : -1000,
      opacity: 0
    }),
    center: {
      zIndex: 1,
      x: 0,
      opacity: 1
    },
    exit: (direction: number) => ({
      zIndex: 0,
      x: direction < 0 ? 1000 : -1000,
      opacity: 0
    })
  };

  const FeaturedEventCard = ({ title, description, imageUrl, direction }: { title: string, description: string, imageUrl: string, direction: number }) => {
    return (
      <motion.div 
        key={title}
        custom={direction}
        variants={sliderVariants}
        initial="enter"
        animate="center"
        exit="exit"
        transition={{ x: { type: "spring", stiffness: 300, damping: 30 }, opacity: { duration: 0.2 } }}
        className="absolute h-96 w-full rounded-2xl overflow-hidden group cursor-pointer shadow-xl"
      >
        <img src={imageUrl} alt={title} className="w-full h-full object-cover transition-transform duration-700 ease-in-out group-hover:scale-110" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-transparent"></div>
        <div className="absolute bottom-0 left-0 p-6 md:p-8 text-white w-full md:w-3/4 lg:w-2/3">
          <h3 className="text-3xl md:text-4xl font-bold drop-shadow-lg">{title}</h3>
          <p className="text-sm md:text-base text-white/90 mt-2 line-clamp-2 drop-shadow-md">{description}</p>
          <button className="mt-4 inline-flex items-center gap-2 text-sm font-bold bg-white text-black px-5 py-2.5 rounded-lg shadow-lg hover:bg-gray-200 transition-colors transform hover:-translate-y-0.5">
            Learn More <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </motion.div>
    );
  };



  function EventCard({ 
    event,
    onLike,
    onCommentClick,
  }: {
    event: EventType;
    onLike: (id: string) => void;
    onCommentClick: (event: EventType) => void
    currentUser: any
  }) {
    const [comments, setComments] = useState<CommentType[]>([])

    useEffect(() => {
      const q = query(collection(db, "events", event.id, "comments"), orderBy("createdAt", "asc"))
      const unsub = onSnapshot(q, (snap) => {
        const arr = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }))
        setComments(arr)
      })
      return () => unsub()
    }, [event.id])

    const hearts = event.hearts ?? []
    const { user } = useAuth()
    const liked = user && user.uid && hearts.includes(user.uid)

    return (
      <motion.div layoutId={`card-container-${event.id}`} whileHover={{ y: -8 }} transition={{ duration: 0.2 }}>
        <div 
          onClick={() => onCommentClick(event)}
          className="group relative rounded-xl overflow-hidden bg-black shadow-lg hover:shadow-2xl transition-all duration-300 cursor-pointer h-96 flex flex-col"
        >
          {/* Image Container */}
          <div className="relative h-72 overflow-hidden flex-shrink-0">
            {event.imageUrl ? (
              <img
                src={event.imageUrl}
                alt={event.eventName || "Event"}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center">
                <div className="text-center text-white">
                  <div className="text-3xl mb-2">📸</div>
                  <p className="text-sm font-semibold">Event Poster</p>
                </div>
              </div>
            )}
            
            {/* Gradient Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

            {/* Department Badge */}
            {event.department && (
              <div className="absolute top-3 right-3 px-3 py-1 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full shadow-lg">
                <span className="text-xs font-bold text-white">{event.department}</span>
              </div>
            )}

            {/* Event Title - Always visible */}
            <div className="absolute bottom-0 left-0 right-0 p-3 z-10">
              <h3 className="text-base font-bold text-white line-clamp-2 drop-shadow-lg">
                {event.eventName || "Untitled Event"}
              </h3>
            </div>
          </div>

          {/* Interactive Footer */}
          <div className="h-24 p-3 bg-white flex flex-col justify-between flex-grow">
            {/* Event Info */}
            <div className="space-y-1.5 text-xs">
              {event.location && (
                <div className="flex items-start gap-2 text-gray-600">
                  <MapPin className="h-3 w-3 flex-shrink-0 mt-0.5" />
                  <span className="line-clamp-1 font-medium">{event.location}</span>
                </div>
              )}
              {event.startDate && !isNaN(event.startDate.getTime()) && (
                <div className="flex items-start gap-2 text-gray-600">
                  <Calendar className="h-3 w-3 flex-shrink-0 mt-0.5" />
                  <span className="line-clamp-1 font-medium">{format(event.startDate, "MMM dd, yyyy")}</span>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-between gap-2 pt-2 border-t border-gray-200">
              <button
                onClick={(e) => { e.stopPropagation(); onLike(event.id); }}
                className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
                  liked 
                    ? 'bg-red-100 text-red-600' 
                    : 'bg-gray-100 text-gray-600 hover:bg-red-50'
                }`}
              >
                <Heart className={`h-3.5 w-3.5 ${liked ? "fill-current" : ""}`} />
                <span>{hearts.length}</span>
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onCommentClick(event); }}
                className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-semibold bg-gray-100 text-gray-600 hover:bg-indigo-50 hover:text-indigo-600 transition-all duration-200"
              >
                <MessageCircle className="h-3.5 w-3.5" />
                <span>{comments.length}</span>
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onCommentClick(event); }}
                className="ml-auto flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors duration-200"
                title="View details"
              >
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    )
  }

  function TrendingEventCard({ event, onCommentClick }: { event: EventType, onCommentClick: (event: EventType) => void }) {
    const { user } = useAuth();
    const hearts = event.hearts ?? [];
    const liked = user && user.uid && hearts.includes(user.uid);

    return (
        <motion.div 
            whileHover={{ y: -5 }} 
            transition={{ duration: 0.2 }}
            onClick={() => onCommentClick(event)}
            className="group relative rounded-2xl overflow-hidden bg-white shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer flex flex-col md:flex-row h-auto md:h-48"
        >
            {/* Image */}
            <div className="w-full md:w-2/5 h-48 md:h-auto relative flex-shrink-0">
                <img
                    src={event.imageUrl || 'src/assets/placeholder.jpg'}
                    alt={event.eventName || "Event"}
                    className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
            </div>

            {/* Content */}
            <div className="flex flex-col p-5">
                <h3 className="text-xl font-bold text-foreground mb-2 line-clamp-2">{event.eventName}</h3>
                <p className="text-sm text-muted-foreground mb-4 line-clamp-2 flex-grow">{event.description}</p>
                <div className="flex items-center gap-4 text-xs text-muted-foreground mt-auto">
                    <div className="flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5" />
                        <span>{format(event.startDate, "MMM dd, yyyy")}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5" />
                        <span>{event.location}</span>
                    </div>
                    <div className={`flex items-center gap-1.5 font-semibold ${liked ? 'text-red-500' : ''}`}>
                        <Heart className="h-3.5 w-3.5" />
                        <span>{hearts.length} Likes</span>
                    </div>
                </div>
            </div>
        </motion.div>
    );
}

  const FilterCard = ({ label, imageUrl, isActive, onClick }: { label: string, imageUrl: string, isActive: boolean, onClick: () => void }) => {
    return (
      <motion.div
        onClick={onClick}
        className={`relative h-24 rounded-full bg-cover bg-center shadow-lg overflow-hidden group cursor-pointer transition-all duration-300 transform hover:-translate-y-1 ${isActive ? 'ring-4 ring-offset-2 ring-[#7cb93c]' : 'ring-0'}`}
        style={{ backgroundImage: `url(${imageUrl})` }}
      >
        <div className="absolute inset-0 bg-black/40 group-hover:bg-black/50 transition-colors duration-300"></div>
        <div className="absolute inset-0 flex items-center justify-center p-2">
          <h4 className="text-white font-bold text-sm md:text-base lg:text-lg text-center drop-shadow-md">
            {label}
          </h4>
        </div>
      </motion.div>
    );
  };



  function ExpandedEventCard({ event, onClose, onLike, onComment }: { event: EventType, onClose: () => void, onLike: (id: string) => void, onComment: (id: string, text: string) => void }) { // eslint-disable-line
    const [comment, setComment] = useState("")
    const [comments, setComments] = useState<CommentType[]>([])
    const [scale, setScale] = useState(1);
    const [fitType, setFitType] = useState<'cover' | 'contain'>('cover');

    const { user } = useAuth() 
    useEffect(() => {
      const q = query(collection(db, "events", event.id, "comments"), orderBy("createdAt", "asc"))
      const unsub = onSnapshot(q, (snap) => {
        const arr = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }))
        setComments(arr)
      })
      return () => unsub()
    }, [event.id])

    const hearts = event.hearts ?? []
    const liked = user && user.uid && hearts.includes(user.uid)

    const modalContentRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
      const handleClickOutside = (e: MouseEvent) => {
        if (modalContentRef.current && !modalContentRef.current.contains(e.target as Node)) {
          onClose()
        }
      }
      document.addEventListener("mousedown", handleClickOutside)
      return () => document.removeEventListener("mousedown", handleClickOutside)
    }, [onClose])



    const toggleFitType = () => {
      setFitType(prev => prev === 'cover' ? 'contain' : 'cover');
      setScale(1); // Reset zoom when changing fit type
    }

    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4"
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-white hover:text-white/80 transition-colors z-50 bg-black/40 hover:bg-black/60 rounded-full p-2"
        >
          <X className="h-6 w-6" />
        </button>
        <motion.div
          layoutId={`card-container-${event.id}`}
          className="w-full max-w-5xl max-h-[90vh] flex flex-col md:flex-row bg-white rounded-2xl overflow-hidden shadow-2xl"
        >
          {/* Image Section */}
          <div className="w-full md:w-3/5 bg-black flex items-center justify-center flex-shrink-0 relative overflow-hidden">
            {event.imageUrl ? (
              <div className="relative w-full h-full flex items-center justify-center">
                <motion.img
                  src={event.imageUrl}
                  alt={event.eventName || "Event"}
                  className={`h-full w-full transition-all duration-300 ${fitType === 'cover' ? 'object-cover' : 'object-contain'}`}
                  style={{ scale: scale, cursor: scale > 1 ? 'grab' : 'auto' }}
                  whileDrag={{ cursor: 'grabbing' }}
                  drag={scale > 1}
                  dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
                />
                <div className="absolute bottom-4 right-4 flex gap-1 bg-black/50 backdrop-blur-sm rounded-lg p-1">
                  <button onClick={toggleFitType} className="p-2 text-white/80 hover:text-white transition-colors" title="Toggle fit">
                    <Eye className="h-5 w-5" />
                  </button>
                  <div className="w-px bg-white/20"></div>
                  <button onClick={() => setScale(s => Math.min(s * 1.2, 3))} className="p-2 text-white/80 hover:text-white transition-colors disabled:opacity-50" disabled={fitType === 'contain'} title="Zoom in">
                    <ZoomIn className="h-5 w-5" />
                  </button>
                  <button onClick={() => setScale(s => Math.max(s / 1.2, 1))} disabled={scale <= 1 || fitType === 'contain'} className="p-2 text-white/80 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed" title="Zoom out">
                    <ZoomOut className="h-5 w-5" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-white/50 text-center p-8">
                <p>No poster available for this event.</p>
              </div>
            )}
          </div>

          {/* Content Section */}
          <div className="w-full md:w-2/5 flex flex-col overflow-hidden">
            <div className="flex-1 flex flex-col overflow-y-auto">
              {/* Header */}
              <div className="p-6 pb-4 bg-gradient-to-r from-indigo-50 to-purple-50 border-b border-gray-200 flex-shrink-0">
                <h2 className="text-2xl font-bold text-foreground mb-2 line-clamp-2">
                  {event.eventName || "Untitled Event"}
                </h2>
                {event.department && (
                  <div className="inline-block px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-xs font-bold">
                    {event.department}
                  </div>
                )}
              </div>

              {/* Description & Details */}
              <div className="p-6 space-y-4 flex-1">
                {event.description && (
                  <div>
                    <p className="text-sm leading-relaxed text-gray-700">
                      {event.description}
                    </p>
                  </div>
                )}
                
                <div className="space-y-3 pt-4 border-t border-gray-200">
                  {event.startDate && !isNaN(event.startDate.getTime()) && (
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-indigo-100">
                        <Calendar className="h-5 w-5 text-indigo-600" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 font-medium">Date & Time</p>
                        <p className="text-sm font-semibold text-gray-900">{format(event.startDate, "PPP 'at' p")}</p>
                      </div>
                    </div>
                  )}
                  
                  {event.location && (
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-purple-100">
                        <MapPin className="h-5 w-5 text-purple-600" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 font-medium">Location</p>
                        <p className="text-sm font-semibold text-gray-900">{event.location}</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Comments Section */}
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
                    <MessageCircle className="h-4 w-4" />
                    Comments ({comments.length})
                  </h3>
                  <div className="space-y-3 max-h-40 overflow-y-auto">
                    {comments.length > 0 ? (
                      comments.map((c) => (
                        <div key={c.id} className="bg-gray-50 rounded-lg p-3 text-sm group/comment hover:bg-gray-100 transition">
                          <p className="font-semibold text-gray-900">{c.authorName}</p>
                          <p className="text-gray-700 mt-1">{c.text}</p>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-gray-500 italic">No comments yet</p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Action Bar */}
            <div className="p-4 bg-white border-t border-gray-200 flex-shrink-0 space-y-3">
              {/* Engagement Stats */}
              <div className="flex items-center gap-4 pb-3 border-b border-gray-100">
                <button
                  onClick={() => onLike(event.id)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg font-medium transition-all duration-200 ${
                    liked 
                      ? 'bg-red-100 text-red-600' 
                      : 'bg-gray-100 text-gray-600 hover:bg-red-50 hover:text-red-600'
                  }`}
                >
                  <motion.div whileTap={{ scale: 1.2 }}>
                    <Heart className={`h-5 w-5 ${liked ? "fill-current" : ""}`} />
                  </motion.div>
                  <span>{hearts.length}</span>
                </button>
              </div>

              {/* Comment Input */}
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  if (comment.trim()) {
                    onComment(event.id, comment)
                    setComment("")
                  }
                }}
                className="flex gap-2"
              >
                <input
                  type="text"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Add a comment..."
                  className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm bg-gray-50 text-foreground placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
                <button
                  type="submit"
                  disabled={!comment.trim()}
                  className="p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                >
                  <Send className="h-5 w-5" />
                </button>
              </form>
            </div>
          </div>
        </motion.div>
      </motion.div>
    )
  }
