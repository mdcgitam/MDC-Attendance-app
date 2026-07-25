

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { getFirestore, collection, addDoc, onSnapshot, updateDoc, doc, deleteDoc, serverTimestamp, query, where, getDocs } from 'firebase/firestore';

// Only GITAM student/staff Google accounts may sign in.
const ALLOWED_EMAIL_DOMAINS = ['gitam.in', 'student.gitam.edu'];
const isAllowedEmailDomain = (email) => !!email && ALLOWED_EMAIL_DOMAINS.some(domain => email.toLowerCase().endsWith(`@${domain}`));

// A drop-in replacement for <select> with the same value/onChange(value) contract,
// used where a native <select> would otherwise feel visually flat (its open menu
// can't be styled or animated in any browser).
const CustomSelect = ({ value, onChange, options, className = '' }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selected = options.find(o => o.value === value);

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen(prev => !prev)}
        className={`w-full flex items-center justify-between gap-2 p-3 rounded-lg bg-white border transition-colors focus:outline-none focus:ring-2 focus:ring-mdc-500 focus:border-transparent ${open ? 'border-mdc-500 ring-2 ring-mdc-500' : 'border-mdc-300 hover:border-mdc-500'}`}
      >
        <span className="text-sm text-mdc-900 truncate">{selected ? selected.label : 'Select'}</span>
        <svg
          className={`w-4 h-4 text-mdc-500 flex-shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>
      {open && (
        <div className="animate-dropdown-in origin-top absolute left-0 right-0 mt-2 bg-white rounded-2xl shadow-xl shadow-mdc-900/10 border border-mdc-100 p-1.5 z-20 max-h-64 overflow-y-auto">
          {options.map(o => (
            <button
              key={o.value}
              type="button"
              onClick={() => { onChange(o.value); setOpen(false); }}
              className={`w-full flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-sm text-left transition-colors ${o.value === value ? 'bg-mdc-100 text-mdc-900 font-semibold' : 'text-gray-700 hover:bg-mdc-50'}`}
            >
              {o.label}
              {o.value === value && (
                <svg className="w-4 h-4 text-mdc-700 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// A multi-select variant of CustomSelect: value/onChange deal in arrays, an empty
// array means "all" (matching the filter predicates' existing 'all' semantics).
const CustomMultiSelect = ({ value, onChange, options, allLabel = 'All', className = '' }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleValue = (val) => {
    onChange(value.includes(val) ? value.filter(v => v !== val) : [...value, val]);
  };

  const triggerLabel = value.length === 0
    ? allLabel
    : value.length === 1
      ? (options.find(o => o.value === value[0])?.label || value[0])
      : `${value.length} selected`;

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen(prev => !prev)}
        className={`w-full flex items-center justify-between gap-2 p-3 rounded-lg bg-white border transition-colors focus:outline-none focus:ring-2 focus:ring-mdc-500 focus:border-transparent ${open ? 'border-mdc-500 ring-2 ring-mdc-500' : 'border-mdc-300 hover:border-mdc-500'}`}
      >
        <span className={`text-sm truncate ${value.length ? 'text-mdc-900 font-medium' : 'text-mdc-900'}`}>{triggerLabel}</span>
        <svg
          className={`w-4 h-4 text-mdc-500 flex-shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>
      {open && (
        <div className="animate-dropdown-in origin-top absolute left-0 right-0 mt-2 bg-white rounded-2xl shadow-xl shadow-mdc-900/10 border border-mdc-100 p-1.5 z-20 max-h-64 overflow-y-auto min-w-max">
          {value.length > 0 && (
            <button
              type="button"
              onClick={() => onChange([])}
              className="w-full flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-left font-semibold text-mdc-700 hover:bg-mdc-50 transition-colors"
            >
              Clear selection
            </button>
          )}
          {options.map(o => {
            const checked = value.includes(o.value);
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => toggleValue(o.value)}
                className={`w-full flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-left transition-colors ${checked ? 'bg-mdc-100 text-mdc-900 font-semibold' : 'text-gray-700 hover:bg-mdc-50'}`}
              >
                <span className={`w-4 h-4 rounded flex-shrink-0 border flex items-center justify-center transition-colors ${checked ? 'bg-mdc-700 border-mdc-700' : 'border-mdc-300'}`}>
                  {checked && (
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  )}
                </span>
                {o.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

// A drop-in replacement for <input type="date"> (value/onChange as 'YYYY-MM-DD' strings)
// with an animated custom calendar panel, since the native date picker can't be styled.
const CustomDateInput = ({ value, onChange, placeholder = 'Select date', className = '' }) => {
  const [open, setOpen] = useState(false);
  const [viewDate, setViewDate] = useState(() => (value ? new Date(`${value}T00:00:00`) : new Date()));
  const ref = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (open) setViewDate(value ? new Date(`${value}T00:00:00`) : new Date());
  }, [open, value]);

  const toISO = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const isSameDay = (d1, d2) => d1 && d2 && d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();

  const selectedDate = value ? new Date(`${value}T00:00:00`) : null;
  const today = new Date();
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const startWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const displayLabel = selectedDate
    ? `${String(selectedDate.getDate()).padStart(2, '0')} ${MONTH_NAMES[selectedDate.getMonth()].slice(0, 3)} ${selectedDate.getFullYear()}`
    : placeholder;

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen(prev => !prev)}
        className={`w-full flex items-center justify-between gap-2 p-3 rounded-lg bg-white border transition-colors focus:outline-none focus:ring-2 focus:ring-mdc-500 focus:border-transparent ${open ? 'border-mdc-500 ring-2 ring-mdc-500' : 'border-mdc-300 hover:border-mdc-500'}`}
      >
        <span className={`text-sm truncate ${selectedDate ? 'text-mdc-900' : 'text-gray-400'}`}>{displayLabel}</span>
        <svg className="w-4 h-4 text-mdc-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
        </svg>
      </button>
      {open && (
        <div className="animate-dropdown-in origin-top absolute left-0 mt-2 w-72 bg-white rounded-2xl shadow-xl shadow-mdc-900/10 border border-mdc-100 p-3 z-20">
          <div className="flex items-center justify-between mb-2">
            <button type="button" onClick={() => setViewDate(new Date(year, month - 1, 1))} className="p-1.5 rounded-lg hover:bg-mdc-100 text-mdc-700 transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
            </button>
            <span className="text-sm font-semibold text-mdc-900">{MONTH_NAMES[month]} {year}</span>
            <button type="button" onClick={() => setViewDate(new Date(year, month + 1, 1))} className="p-1.5 rounded-lg hover:bg-mdc-100 text-mdc-700 transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1 mb-1">
            {WEEKDAY_LABELS.map((d, i) => (
              <div key={i} className="text-center text-[11px] font-semibold text-gray-400">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map((d, idx) => {
              if (!d) return <div key={idx} className="h-8" />;
              const cellDate = new Date(year, month, d);
              const selected = isSameDay(cellDate, selectedDate);
              const isToday = isSameDay(cellDate, today);
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => { onChange(toISO(cellDate)); setOpen(false); }}
                  className={`h-8 rounded-lg text-xs font-medium transition-colors ${selected ? 'bg-mdc-700 text-white shadow-sm' : isToday ? 'bg-mdc-100 text-mdc-900 font-semibold' : 'text-gray-700 hover:bg-mdc-50'}`}
                >
                  {d}
                </button>
              );
            })}
          </div>
          {value && (
            <button
              type="button"
              onClick={() => { onChange(''); setOpen(false); }}
              className="mt-2 w-full text-center text-xs font-semibold text-mdc-500 hover:text-mdc-700 py-1.5 transition-colors"
            >
              Clear date
            </button>
          )}
        </div>
      )}
    </div>
  );
};

// Sample data shown only when Firebase isn't configured yet (see .env.example),
// so the UI can be reviewed end-to-end via the dev bypass before real credentials exist.
// Never written anywhere - purely local state seeding, no Firestore calls involved.
const TEAM_2026_27 = [
  { username: "DANDU HASINI", email: "hdandu2@gitam.in", regNo: "2023002808", contact: "6305327994", year: "4th year", program: "BTECH-CSE AIML", domain: "EB", position: "President", isAdmin: true, status: "active", photo: null },
  { username: "KARRI AKASH KISHAN", email: "akarri4@gitam.in", regNo: "2023002725", contact: "8374849797", year: "4th year", program: "BTECH-CSE", domain: "EB", position: "Vice President", isAdmin: true, status: "active", photo: null },
  { username: "KUNDRAPU TANISHQ", email: "tkundrap@student.gitam.edu", regNo: "2024036990", contact: "9652177526", year: "3rd year", program: "BTECH-CSE", domain: "EB", position: "Secretary", isAdmin: true, status: "active", photo: null },
  { username: "KATRAGADDA SRINIVAS KARTHIK", email: "skatrag1@student.gitam.edu", regNo: "2025058532", contact: "6302655976", year: "2nd year", program: "BTECH-CSEAIML", domain: "EB", position: "Head of Operations", isAdmin: true, status: "active", photo: null },
  { username: "AKI SRI HARSHA", email: "saki@gitam.in", regNo: "2023000683", contact: "7780610391", year: "3rd year", program: "BTECH-CSE", domain: "EB", position: "Technical Head", isAdmin: true, status: "active", photo: null },
  { username: "MANNEM LIKHITA", email: "lmannem@student.gitam.edu", regNo: "2025203946", contact: "9849497687", year: "2nd year", program: "BTECH-CSE AIML", domain: "EB", position: "Creative Head", isAdmin: true, status: "active", photo: null },
  { username: "IKKARA RISHI KARTHIKEYAN", email: "rikkara@student.gitam.edu", regNo: "2024002809", contact: "9417086863", year: "3rd year", program: "BTECH-CSE", domain: "DataVerse", position: "Member", isAdmin: false, status: "active", photo: null },
  { username: "NIHAL MAREDLA", email: "nmaredla@student.gitam.edu", regNo: "2024003999", contact: "8985807898", year: "3rd year", program: "BTECH-CSE", domain: "DataVerse", position: "Member", isAdmin: false, status: "active", photo: null },
  { username: "MEDIDI SANJANA", email: "smedidi@student.gitam.edu", regNo: "2024000543", contact: "9000272639", year: "3rd year", program: "BTECH-CSE AIML", domain: "DataVerse", position: "Member", isAdmin: false, status: "active", photo: null },
  { username: "SAGI LAKSHMI KAIVALYA", email: "lsagi@student.gitam.edu", regNo: "2024003872", contact: "9121396159", year: "3rd year", program: "BTECH-CSE", domain: "DataVerse", position: "Member", isAdmin: false, status: "active", photo: null },
  { username: "DHANA TARUN BALIVADA", email: "dbalivad2@student.gitam.edu", regNo: "2024014973", contact: "8341135355", year: "3rd year", program: "BTECH-CSE", domain: "DataVerse", position: "Member", isAdmin: false, status: "active", photo: null },
  { username: "SIRIKI SAI SATYA YASWANTH", email: "ssiriki@student.gitam.edu", regNo: "2025023567", contact: "8247598200", year: "2nd year", program: "BTECH-CSE", domain: "DataVerse", position: "Member", isAdmin: false, status: "active", photo: null },
  { username: "SOMAYAJULA RAAM SASHANK", email: "ssomaya1@student.gitam.edu", regNo: "2025016278", contact: "7396096611", year: "2nd year", program: "BTECH-CSE", domain: "DataVerse", position: "Member", isAdmin: false, status: "active", photo: null },
  { username: "MOHAMED MAHABOOB ALI", email: "mmohamed@student.gitam.edu", regNo: "2024006642", contact: "9848096151", year: "3rd year", program: "BTECH-CSE AIML", domain: "WebArcs", position: "Domain Lead", isAdmin: false, status: "active", photo: null },
  { username: "GAJJALA JASWITHA REDDY", email: "jgajjala@student.gitam.edu", regNo: "2024008155", contact: "7893752980", year: "3rd year", program: "BTECH-CSE", domain: "WebArcs", position: "Member", isAdmin: false, status: "active", photo: null },
  { username: "DADI DIVYA SREE", email: "ddadi2@student.gitam.edu", regNo: "2024112838", contact: "7093151520", year: "3rd year", program: "BTECH-CSE", domain: "WebArcs", position: "Member", isAdmin: false, status: "active", photo: null },
  { username: "YADLA SAI SUSHMA", email: "syadla2@student.gitam.edu", regNo: "2024165826", contact: "7207017342", year: "3rd year", program: "BTECH-CSE", domain: "WebArcs", position: "Member", isAdmin: false, status: "active", photo: null },
  { username: "TEDDI GUNA", email: "gteddi@student.gitam.edu", regNo: "2025066665", contact: "8790376902", year: "2nd year", program: "BTECH-CSE", domain: "WebArcs", position: "Member", isAdmin: false, status: "active", photo: null },
  { username: "EATY VENKATA LAKSHMI PRIYANKA", email: "veaty@student.gitam.edu", regNo: "2024003875", contact: "9059737669", year: "3rd year", program: "BTECH-CSE", domain: "CP", position: "Member", isAdmin: false, status: "active", photo: null },
  { username: "D BHARGAVI", email: "bdevired@student.gitam.edu", regNo: "2025346791", contact: "7013859801", year: "2nd year", program: "BTECH-CSE", domain: "CP", position: "Member", isAdmin: false, status: "active", photo: null },
  { username: "PRIANSHU KUMAR SAHU", email: "psahu1@student.gitam.edu", regNo: "2025055906", contact: "7620269872", year: "2nd year", program: "BTECH-CSE", domain: "CP", position: "Member", isAdmin: false, status: "active", photo: null },
  { username: "KOUSTAV BOSE", email: "kbose@student.gitam.edu", regNo: "2025068958", contact: "8583999769", year: "2nd year", program: "BTECH-CSE", domain: "CP", position: "Member", isAdmin: false, status: "active", photo: null },
  { username: "CHITROTHU SANJITA", email: "schitrot@student.gitam.edu", regNo: "2025222588", contact: "6300843004", year: "2nd year", program: "BTECH-CSE", domain: "CP", position: "Member", isAdmin: false, status: "active", photo: null },
  { username: "BALABHADRUNI AKSHAYA", email: "abalabha@student.gitam.edu", regNo: "2024018066", contact: "6305419983", year: "3rd year", program: "BTECH-CSE", domain: "Content", position: "Member", isAdmin: false, status: "active", photo: null },
  { username: "GOLI SAHITHI", email: "sgoli2@student.gitam.edu", regNo: "2024021633", contact: "7780440641", year: "3rd year", program: "BTECH-CSE", domain: "Content", position: "Member", isAdmin: false, status: "active", photo: null },
  { username: "NAMMI SAI JAHNAVI", email: "snammi@student.gitam.edu", regNo: "2025223289", contact: "7793959681", year: "2nd year", program: "BTECH-CSE AIML", domain: "Content", position: "Member", isAdmin: false, status: "active", photo: null },
  { username: "ILAPAKURTHY SAI SINDHU MANASA", email: "silapaku@student.gitam.edu", regNo: "2024001918", contact: "7013894069", year: "3rd year", program: "BTECH-CSE", domain: "Design", position: "Member", isAdmin: false, status: "active", photo: null },
  { username: "AFREEN NAAZ ALI", email: "aali2@student.gitam.edu", regNo: "2025271991", contact: "8763346675", year: "2nd year", program: "BTECH-CSE AIML", domain: "Design", position: "Member", isAdmin: false, status: "active", photo: null },
  { username: "WARIZ SHAIK", email: "wshaik@student.gitam.edu", regNo: "2025050327", contact: "7893537788", year: "2nd year", program: "BTECH-CSE", domain: "Design", position: "Member", isAdmin: false, status: "active", photo: null },
  { username: "SONALI SRIPATHI", email: "ssripath@student.gitam.edu", regNo: "2025356418", contact: "9347376837", year: "2nd year", program: "BTECH-CSE", domain: "Design", position: "Member", isAdmin: false, status: "active", photo: null },
  { username: "HIMESH KAMAL ESARLA", email: "hesarla@student.gitam.edu", regNo: "2025112687", contact: "8121611248", year: "2nd year", program: "BTECH-CSE", domain: "Design", position: "Member", isAdmin: false, status: "active", photo: null },
  { username: "KALAGARLA SAI SATHVIKA", email: "skalagar@student.gitam.edu", regNo: "2024006491", contact: "8985099101", year: "3rd year", program: "BTECH-CSE", domain: "Photography", position: "Member", isAdmin: false, status: "active", photo: null },
  { username: "K VAMSI KRISHNA", email: "vkaranam@student.gitam.edu", regNo: "2024026464", contact: "9182136152", year: "3rd year", program: "BTECH-CSE AIML", domain: "Photography", position: "Member", isAdmin: false, status: "active", photo: null },
  { username: "ATLA VINAY", email: "vatla@student.gitam.edu", regNo: "2024041712", contact: "7032272667", year: "3rd year", program: "BTECH-CSE", domain: "Photography", position: "Member", isAdmin: false, status: "active", photo: null },
  { username: "SRADDHA KASARA", email: "skasara@student.gitam.edu", regNo: "2025585984", contact: "6301428794", year: "2nd year", program: "BSC", domain: "Photography", position: "Member", isAdmin: false, status: "active", photo: null },
  { username: "POSAM ADRIJA", email: "aposam@student.gitam.edu", regNo: "2024008586", contact: "8106698963", year: "3rd year", program: "BTECH-CSE AIML", domain: "PR", position: "Member", isAdmin: false, status: "active", photo: null },
  { username: "SREE MAHI CHANDAGANI", email: "schandag@student.gitam.edu", regNo: "2024017749", contact: "9032446824", year: "3rd year", program: "BTECH-CSE AIML", domain: "PR", position: "Member", isAdmin: false, status: "active", photo: null },
  { username: "PENMETSA CHANDRA HASINI", email: "cpenmets@student.gitam.edu", regNo: "2025026422", contact: "8093560963", year: "2nd year", program: "BTECH-CSE", domain: "PR", position: "Member", isAdmin: false, status: "active", photo: null },
  { username: "ANIKETH KUMAR YADAV", email: "ayadav8@student.gitam.edu", regNo: "2025466212", contact: "7579861571", year: "2nd year", program: "BTECH-CSE AIML", domain: "PR", position: "Member", isAdmin: false, status: "active", photo: null }
];

const MOCK_USERS = TEAM_2026_27.map((user, index) => ({
  id: `u${index + 1}`,
  ...user
}));

// Active roster eligible for every mock slot below.
const MOCK_ELIGIBLE_IDS = MOCK_USERS.map(user => user.id);

// Per-user attendance across the 7 mock slots, in date order.
const MOCK_ATTENDANCE_BY_USER = MOCK_USERS.reduce((acc, user, index) => {
  acc[user.id] = [
    index % 3 !== 0,
    index % 4 !== 0,
    index % 5 !== 0,
    true,
    index % 6 !== 0,
    true,
    index % 2 === 0
  ];
  return acc;
}, {});

const MOCK_SLOT_META = [
  { slotType: 'Event', slotName: 'Orientation Meetup', date: '2026-06-01', venue: 'Main Auditorium', timings: '4:00 PM - 5:30 PM' },
  { slotType: 'Domain Meeting', slotName: 'WebArcs Domain Sync', date: '2026-06-08', venue: 'Room 204', timings: '5:00 PM - 6:00 PM' },
  { slotType: 'Core Team Meeting', slotName: 'Core Team Sync', date: '2026-06-15', venue: 'Conference Hall', timings: '6:00 PM - 7:00 PM' },
  { slotType: 'Event', slotName: 'Hackathon Kickoff', date: '2026-06-22', venue: 'Innovation Lab', timings: '3:00 PM - 6:00 PM' },
  { slotType: 'Domain Meeting', slotName: 'DataVerse Deep Dive', date: '2026-06-29', venue: 'Room 204', timings: '5:00 PM - 6:00 PM' },
  { slotType: 'Core Team Meeting', slotName: 'Monthly Review', date: '2026-07-05', venue: 'Conference Hall', timings: '6:00 PM - 7:00 PM' },
  { slotType: 'Event', slotName: 'Tech Talk: Cloud Native', date: '2026-07-12', venue: 'Main Auditorium', timings: '4:00 PM - 5:30 PM' },
];

const MOCK_ATTENDANCE_SLOTS = MOCK_SLOT_META.map((meta, i) => ({
  id: `s${i + 1}`,
  ...meta,
  eligibleUserIds: MOCK_ELIGIBLE_IDS,
  attendance: MOCK_ELIGIBLE_IDS.map(userId => ({ userId, isPresent: MOCK_ATTENDANCE_BY_USER[userId][i] })),
}));

const App = () => {
  // State for Firebase services and user information
  const [db, setDb] = useState(null);
  const [auth, setAuth] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [firebaseNotConfigured, setFirebaseNotConfigured] = useState(false);
  const profileDropdownRef = useRef(null);
  // Not displayed anywhere - only drives the inactivity auto-logout timer below.
  const [, setRemainingTime] = useState(1800);


  // State for UI navigation and Admin Panel view
  const [view, setView] = useState('login'); // 'login', 'userDashboard', 'adminDashboard'
  const [adminView, setAdminView] = useState('dashboard'); // 'dashboard', 'manageUsers', 'attendanceSlots'
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);

  // State for messages
  const [message, setMessage] = useState(''); // Global message for main screen
  const [modalMessage, setModalMessage] = useState(''); // Message for inside modals
  const [allUsers, setAllUsers] = useState([]);
  const [editingUser, setEditingUser] = useState(null);
  const [newUser, setNewUser] = useState(null);
  const [deletingUser, setDeletingUser] = useState(null);
  const [deletingSlot, setDeletingSlot] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState([]);
  const [filterDomain, setFilterDomain] = useState([]);
  const [filterYear, setFilterYear] = useState([]);
  const [filterPosition, setFilterPosition] = useState([]);


  // State for Attendance Slots
  const [attendanceSlots, setAttendanceSlots] = useState([]);
  const [showCreateSlot, setShowCreateSlot] = useState(false);
  const [newSlotForm, setNewSlotForm] = useState({ slotType: 'Event', slotName: '', date: '', venue: '', timings: '' });
  const [editingSlot, setEditingSlot] = useState(null);
  const [selectedDomains, setSelectedDomains] = useState([]);
  const [slotAttendance, setSlotAttendance] = useState([]); // Array of { id, username, email, domain, position, isPresent }
  const [loginRegNo, setLoginRegNo] = useState('');
  const [loginEmail, setLoginEmail] = useState('');
  const [attendanceSearchTerm, setAttendanceSearchTerm] = useState('');
  const [attendanceFilterDomain, setAttendanceFilterDomain] = useState([]);
  const [attendanceFilterPosition, setAttendanceFilterPosition] = useState([]);
  const previousSlotAttendanceRef = useRef(null);
  const [showUndoToast, setShowUndoToast] = useState(false);
  const undoTimerRef = useRef(null);
  const [slotTypeFilter, setSlotTypeFilter] = useState([]);
  const [slotMonthFilter, setSlotMonthFilter] = useState([]);
  const [slotYearFilter, setSlotYearFilter] = useState([]);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState(null);

  // State for Dashboard
  const [showMemberAttendanceDetails, setShowMemberAttendanceDetails] = useState(false);
  const [selectedMember, setSelectedMember] = useState(null);
  const [showViolationModal, setShowViolationModal] = useState(false);
  const [violationModalMember, setViolationModalMember] = useState(null);
  const [dashboardFilterMonth, setDashboardFilterMonth] = useState([]);
  const [dashboardFilterYear, setDashboardFilterYear] = useState([]);
  const [dashboardFilterDomain, setDashboardFilterDomain] = useState([]);
  const [dashboardFilterPosition, setDashboardFilterPosition] = useState([]);
  const [dashboardFilterAttendance, setDashboardFilterAttendance] = useState([]);

  // User Dashboard State
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [userProfile, setUserProfile] = useState(null);
  const [userDashboardFilters, setUserDashboardFilters] = useState({ slotType: [], status: [], fromDate: '', toDate: '' });


  // Your web app's Firebase configuration.
  // Fill these in via a .env.local file (see .env.example) once the Firebase project is created.
  const firebaseConfig = useMemo(() => ({
    apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
    authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
    storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.REACT_APP_FIREBASE_APP_ID
  }), []);

  const appId = firebaseConfig.appId;

  // Domain and Position dropdown options (custom order for display)
  const domainPriority = ["EB", "DataVerse", "WebArcs", "CP", "Content", "Design", "PR", "Photography"];
  const yearPriority = ["4th year", "3rd year", "2nd year", "1st year"];
  const positionPriority = [
    "President",
    "Vice President",
    "Secretary",
    "Head of Operations",
    "Technical Head",
    "Creative Head",
    "Domain Lead",
    "Member"
  ];
  const domains = ["WebArcs", "DataVerse", "CP", "Content", "Design", "PR", "Photography", "EB"];
  const positions = ["President", "Vice President", "Secretary", "Head of Operations", "Technical Head", "Creative Head", "Domain Lead", "Member"];
  const years = ["1st year", "2nd year", "3rd year", "4th year"];
  const slotTypes = ["Event", "Domain Meeting", "Core Team Meeting"];
  const slotTypesMap = {
    'event': 'Event',
    'coreteammeeting': 'Core Team Meeting',
    'domainmeeting': 'Domain Meeting'
  };

  const normalizeSlotType = (type) => type.toLowerCase().replace(/\s/g, '');


  // Initialize Firebase and Session Verification
  useEffect(() => {
    // Preload login image (use local public asset)
    const loginImage = new Image();
    loginImage.src = "/MDC%20Team%20Photo.jpeg";

    if (!firebaseConfig.apiKey) {
      setFirebaseNotConfigured(true);

      const savedSession = localStorage.getItem('mdc_user_session');
      if (savedSession) {
        try {
          const session = JSON.parse(savedSession);
          const mockUser = MOCK_USERS.find(
            u => u.regNo.toLowerCase() === session.regNo.toLowerCase() &&
              u.email.toLowerCase() === session.email.toLowerCase()
          );
          if (mockUser && mockUser.status === 'active') {
            setUserProfile(mockUser);
            setIsAdmin(mockUser.domain === 'EB');
            setView(mockUser.domain === 'EB' ? 'adminDashboard' : 'userDashboard');
          } else {
            localStorage.removeItem('mdc_user_session');
          }
        } catch (e) {
          console.error("Error loading mock session: ", e);
        }
      }
      setIsAuthReady(true);
      return;
    }

    const app = initializeApp(firebaseConfig);
    const authInstance = getAuth(app);
    const dbInstance = getFirestore(app);

    setAuth(authInstance);
    setDb(dbInstance);

    const checkPersistedSession = async () => {
      const savedSession = localStorage.getItem('mdc_user_session');
      if (savedSession) {
        try {
          const session = JSON.parse(savedSession);
          const usersCollectionPath = `/artifacts/${appId}/public/data/users`;
          const q = query(
            collection(dbInstance, usersCollectionPath),
            where('regNo', '==', session.regNo),
            where('email', '==', session.email)
          );
          const querySnapshot = await getDocs(q);
          if (!querySnapshot.empty) {
            const docSnap = querySnapshot.docs[0];
            const userData = docSnap.data();
            if (userData.status === 'active') {
              setUserProfile({ id: docSnap.id, ...userData });
              setIsAdmin(userData.domain === 'EB');
              setView(userData.domain === 'EB' ? 'adminDashboard' : 'userDashboard');
            } else {
              localStorage.removeItem('mdc_user_session');
            }
          } else {
            localStorage.removeItem('mdc_user_session');
          }
        } catch (e) {
          console.error("Error restoring session: ", e);
        }
      }
      setIsAuthReady(true);
    };

    checkPersistedSession();
  }, [appId, firebaseConfig]);

  // While Firebase isn't configured (see .env.example), seed local state with mock
  // data instead so the dev bypass has something real to render.
  useEffect(() => {
    if (!firebaseNotConfigured || (!isAdmin && !userProfile)) {
      return;
    }
    setAllUsers(MOCK_USERS);
    setAttendanceSlots(MOCK_ATTENDANCE_SLOTS);
  }, [firebaseNotConfigured, isAdmin, userProfile]);

  // Set default selected domains based on slot type
  useEffect(() => {
    const activeSlotType = editingSlot ? editingSlot.slotType : newSlotForm.slotType;
    if (!activeSlotType) return;

    if (activeSlotType === 'Core Team Meeting') {
      setSelectedDomains(domains);
    } else if (activeSlotType === 'Domain Meeting') {
      if (editingSlot) {
        let domainsList = editingSlot.selectedDomains;
        if (!domainsList || domainsList.length === 0) {
          domainsList = Array.from(new Set(
            allUsers.filter(u => (editingSlot.eligibleUserIds || []).includes(u.id)).map(u => u.domain)
          ));
        }
        setSelectedDomains(domainsList.slice(0, 1));
      } else {
        setSelectedDomains([]);
      }
    } else if (activeSlotType === 'Event') {
      if (editingSlot) {
        let domainsList = editingSlot.selectedDomains;
        if (!domainsList || domainsList.length === 0) {
          domainsList = Array.from(new Set(
            allUsers.filter(u => (editingSlot.eligibleUserIds || []).includes(u.id)).map(u => u.domain)
          ));
        }
        setSelectedDomains(domainsList);
      } else {
        setSelectedDomains(domains);
      }
    }
  }, [newSlotForm.slotType, editingSlot?.slotType, showCreateSlot, editingSlot]);

  // Sync users list to slotAttendance when selectedDomains or active users change
  useEffect(() => {
    if (!showCreateSlot && !editingSlot) return;

    const filteredActiveUsers = allUsers.filter(u => u.status === 'active' && selectedDomains.includes(u.domain));

    setSlotAttendance(prev => {
      return filteredActiveUsers.map(user => {
        const existing = prev.find(p => p.id === user.id);
        if (existing) {
          return existing;
        }

        // If editing an existing slot, check if this user has a saved attendance record
        if (editingSlot && editingSlot.attendance) {
          const savedRecord = editingSlot.attendance.find(a => a.userId === user.id);
          if (savedRecord) {
            return {
              id: user.id,
              username: user.username,
              email: user.email,
              domain: user.domain,
              position: user.position,
              isPresent: savedRecord.isPresent
            };
          }
        }

        return {
          id: user.id,
          username: user.username,
          email: user.email,
          domain: user.domain,
          position: user.position,
          isPresent: false
        };
      });
    });
  }, [selectedDomains, allUsers, showCreateSlot, editingSlot]);

  // Fetch all data from Firestore after login/auth is ready
  useEffect(() => {
    if (!isAuthReady || !db || (!isAdmin && !userProfile)) {
      return;
    }

    const usersCollectionPath = `/artifacts/${appId}/public/data/users`;
    const unsubUsers = onSnapshot(collection(db, usersCollectionPath), (snapshot) => {
      setAllUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => console.error("Error fetching users:", error));

    const slotsCollectionPath = `/artifacts/${appId}/public/data/attendance_slots`;
    const unsubSlots = onSnapshot(collection(db, slotsCollectionPath), (snapshot) => {
      setAttendanceSlots(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => console.error("Error fetching slots:", error));

    return () => {
      unsubUsers();
      unsubSlots();
    };
  }, [isAuthReady, db, isAdmin, userProfile, appId]);

  // Effect for auto-clearing the main page message after 1 second
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => {
        setMessage('');
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  // Effect for auto-clearing modal messages
  useEffect(() => {
    if (modalMessage) {
      const timer = setTimeout(() => {
        setModalMessage('');
      }, 2000); // Give a bit more time to read modal messages
      return () => clearTimeout(timer);
    }
  }, [modalMessage]);

  // Effect for closing dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(event.target)) {
        setShowProfileDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Effect for scroll-locking the body when any modal is open
  useEffect(() => {
    const isAnyModalOpen =
      showCreateSlot ||
      showImportModal ||
      showMemberAttendanceDetails ||
      showEditProfileModal ||
      !!editingSlot ||
      !!editingUser ||
      !!newUser ||
      !!deletingUser ||
      !!deletingSlot;

    if (isAnyModalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }

    // Cleanup function to restore scroll on component unmount
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, [
    showCreateSlot,
    showImportModal,
    showMemberAttendanceDetails,
    showEditProfileModal,
    editingSlot,
    editingUser,
    newUser,
    deletingUser,
    deletingSlot
  ]);

  // Effect for inactivity logout timer
  useEffect(() => {
    let inactivityTimeout;

    const handleInactivityLogout = () => {
      // Log out and reset state
      setView('login');
      setIsAdmin(false);
      setUserProfile(null);
      setMessage('You have been logged out due to inactivity.');
      if (auth) signOut(auth);
    };

    const resetInactivityTimer = () => {
      clearTimeout(inactivityTimeout);
      setRemainingTime(1800); // Reset display timer
      // Set timeout for 30 minutes (1800000 milliseconds)
      inactivityTimeout = setTimeout(handleInactivityLogout, 1800000);
    };

    if (isAdmin || userProfile) {
      const events = ['mousemove', 'mousedown', 'keypress', 'scroll'];
      events.forEach(event => window.addEventListener(event, resetInactivityTimer));
      resetInactivityTimer(); // Start the timer

      return () => { // Cleanup function
        clearTimeout(inactivityTimeout);
        events.forEach(event => window.removeEventListener(event, resetInactivityTimer));
      };
    }
  }, [isAdmin, userProfile, auth]);

  // Effect for countdown display timer
  useEffect(() => {
    if (isAdmin || userProfile) {
      const timer = setInterval(() => {
        setRemainingTime(prevTime => {
          if (prevTime <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prevTime - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [isAdmin, userProfile]);


  // Handle custom credentials login (Roll Number and GITAM Email)
  const handleCredentialsLogin = async (e) => {
    if (e) e.preventDefault();
    setMessage('');

    if (!loginRegNo.trim() || !loginEmail.trim()) {
      setMessage("Please enter both Roll Number and GITAM Email.");
      return;
    }

    const regNo = loginRegNo.trim();
    const email = loginEmail.trim().toLowerCase();

    if (firebaseNotConfigured) {
      const mockUser = MOCK_USERS.find(
        u => u.regNo.toLowerCase() === regNo.toLowerCase() &&
          u.email.toLowerCase() === email
      );

      if (!mockUser) {
        setMessage("Invalid Roll Number or GITAM Email.");
        return;
      }

      if (mockUser.status === 'inactive') {
        setMessage("Your account is inactive. Please contact the admin.");
        return;
      }

      setUserProfile(mockUser);
      setIsAdmin(mockUser.domain === 'EB');
      localStorage.setItem('mdc_user_session', JSON.stringify({ regNo: mockUser.regNo, email: mockUser.email }));
      setView(mockUser.domain === 'EB' ? 'adminDashboard' : 'userDashboard');
      setAdminView('dashboard');
      return;
    }

    try {
      const usersCollectionPath = `/artifacts/${appId}/public/data/users`;
      const q = query(
        collection(db, usersCollectionPath),
        where('regNo', '==', regNo),
        where('email', '==', email)
      );
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        setMessage("Invalid Roll Number or GITAM Email.");
        return;
      }

      const docSnap = querySnapshot.docs[0];
      const userData = docSnap.data();

      if (userData.status === 'inactive') {
        setMessage("Your account is inactive. Please contact the admin.");
        return;
      }

      const isUserAdmin = userData.domain === 'EB';
      setUserProfile({ id: docSnap.id, ...userData });
      setIsAdmin(isUserAdmin);
      localStorage.setItem('mdc_user_session', JSON.stringify({ regNo: userData.regNo, email: userData.email }));
      setView(isUserAdmin ? 'adminDashboard' : 'userDashboard');
      setAdminView('dashboard');
    } catch (e) {
      console.error("Login error: ", e);
      setMessage("An error occurred during sign-in. Please try again.");
    }
  };

  // Dev-only bypass so the UI can be reviewed before Firebase credentials exist.
  const handleDevBypass = (asAdmin) => {
    setMessage('');
    if (asAdmin) {
      setIsAdmin(true);
      const mockAdmin = MOCK_USERS.find(u => u.domain === 'EB') || { id: 'u2', username: 'Aarav Mehta', email: 'aarav.mehta@student.gitam.edu', regNo: '20BCE1042', domain: 'EB', isAdmin: true, status: 'active' };
      setUserProfile(mockAdmin);
      localStorage.setItem('mdc_user_session', JSON.stringify({ regNo: mockAdmin.regNo, email: mockAdmin.email }));
      setView('adminDashboard');
      setAdminView('dashboard');
    } else {
      setIsAdmin(false);
      const mockMember = MOCK_USERS.find(u => u.id === 'u1');
      setUserProfile(mockMember);
      localStorage.setItem('mdc_user_session', JSON.stringify({ regNo: mockMember.regNo, email: mockMember.email }));
      setView('userDashboard');
    }
  };

  const handleLogout = () => {
    setIsAdmin(false);
    setUserProfile(null);
    setView('login');
    setMessage('');
    setLoginRegNo('');
    setLoginEmail('');
    setShowProfileDropdown(false);
    localStorage.removeItem('mdc_user_session');
    if (auth) {
      try {
        signOut(auth);
      } catch (e) {
        console.error("Auth signout error:", e);
      }
    }
  };

  // Handle admin actions (users)
  const handleToggleStatus = async (user) => {
    if (!db || !isAdmin) return;
    try {
      let newStatus;
      if (user.status === 'active') {
        newStatus = 'inactive';
      } else {
        // This handles both 'inactive' and 'pending' statuses
        newStatus = 'active';
      }
      const userDocRef = doc(db, `/artifacts/${appId}/public/data/users`, user.id);
      await updateDoc(userDocRef, { status: newStatus });
      setMessage(`User ${user.email} status changed to ${newStatus}.`);
    } catch (e) {
      console.error("Error updating user status: ", e.message);
      setMessage("Failed to update user status. Please try again.");
    }
  };

  const handleDeleteUser = async (user) => {
    if (!db || !isAdmin) return;
    setModalMessage('');
    setDeletingUser(user);
  };

  const confirmDelete = async () => {
    if (!db || !isAdmin || !deletingUser) return;
    try {
      // Deleting a user from Firebase Auth by an admin is not possible from the client-side SDK.
      // The auth account will become an orphan but will be unusable as the Firestore doc is deleted.

      // Delete the user's Firestore document
      const userDocRef = doc(db, `/artifacts/${appId}/public/data/users`, deletingUser.id);
      await deleteDoc(userDocRef);

      setMessage(`User ${deletingUser.username} has been deleted.`);
      setDeletingUser(null);
    } catch (e) {
      console.error("Error deleting user: ", e.message);
      setMessage("Failed to delete user. Please try again.");
      setDeletingUser(null);
    }
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!db || !isAdmin || !editingUser) return;

    try {
      const userDocRef = doc(db, `/artifacts/${appId}/public/data/users`, editingUser.id);
      await updateDoc(userDocRef, {
        username: editingUser.username,
        email: editingUser.email,
        contact: editingUser.contact,
        year: editingUser.year,
        regNo: editingUser.regNo,
        program: editingUser.program,
        domain: editingUser.domain,
        position: editingUser.position,
        isAdmin: editingUser.domain === 'EB'
      });
      setModalMessage(`User ${editingUser.username} details updated successfully.`);
      setTimeout(() => {
        setEditingUser(null);
        setModalMessage('');
      }, 1000);
    } catch (e) {
      console.error("Error updating user: ", e.message);
      setMessage("Failed to update user details. Please try again.");
    }
  };

  const handleCreateUser = async (e) => {
    if (e) e.preventDefault();
    if (!db || !isAdmin || !newUser) return;

    if (!newUser.username || !newUser.email || !newUser.regNo) {
      setModalMessage("Name, Email and Roll Number are required.");
      return;
    }

    if (firebaseNotConfigured) {
      const mockNewUser = {
        id: `u${allUsers.length + 1}`,
        username: newUser.username.trim(),
        email: newUser.email.trim().toLowerCase(),
        contact: (newUser.contact || '').trim(),
        year: newUser.year || '1st year',
        regNo: newUser.regNo.trim(),
        program: (newUser.program || '').trim(),
        domain: newUser.domain || 'EB',
        position: newUser.position || 'Member',
        status: 'active',
        isAdmin: newUser.domain === 'EB',
        photo: null
      };

      if (allUsers.some(u => u.email.toLowerCase() === mockNewUser.email.toLowerCase() || u.regNo.toLowerCase() === mockNewUser.regNo.toLowerCase())) {
        setModalMessage("A user with this Email or Roll Number already exists.");
        return;
      }

      setAllUsers(prev => [...prev, mockNewUser]);
      setModalMessage("Member added successfully! (Local Mock)");
      setTimeout(() => {
        setNewUser(null);
        setModalMessage('');
      }, 1000);
      return;
    }

    try {
      const usersCollectionPath = `/artifacts/${appId}/public/data/users`;

      const qEmail = query(collection(db, usersCollectionPath), where('email', '==', newUser.email.trim().toLowerCase()));
      const queryEmail = await getDocs(qEmail);
      if (!queryEmail.empty) {
        setModalMessage("A user with this Email already exists.");
        return;
      }

      const qReg = query(collection(db, usersCollectionPath), where('regNo', '==', newUser.regNo.trim()));
      const queryReg = await getDocs(qReg);
      if (!queryReg.empty) {
        setModalMessage("A user with this Roll Number already exists.");
        return;
      }

      await addDoc(collection(db, usersCollectionPath), {
        username: newUser.username.trim(),
        email: newUser.email.trim().toLowerCase(),
        contact: (newUser.contact || '').trim(),
        year: newUser.year || '1st year',
        regNo: newUser.regNo.trim(),
        program: (newUser.program || '').trim(),
        domain: newUser.domain || 'EB',
        position: newUser.position || 'Member',
        status: 'active',
        isAdmin: newUser.domain === 'EB',
        photo: null,
        createdAt: serverTimestamp ? serverTimestamp() : new Date()
      });

      setModalMessage("Member added successfully!");
      setTimeout(() => {
        setNewUser(null);
        setModalMessage('');
      }, 1000);
    } catch (e) {
      console.error("Error adding user: ", e.message);
      setModalMessage(`Failed to add user: ${e.message}`);
    }
  };

  const handleSeedTeam = async () => {
    if (firebaseNotConfigured) {
      setAllUsers(MOCK_USERS);
      setMessage("Local mock database seeded with 2026-27 team.");
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    if (!db || !isAdmin) return;
    setMessage("Seeding 2026-27 team members to Firestore...");

    try {
      const usersCollectionPath = `/artifacts/${appId}/public/data/users`;
      let seededCount = 0;
      let skippedCount = 0;

      // Fetch existing users to avoid duplicates
      const querySnapshot = await getDocs(collection(db, usersCollectionPath));
      const existingEmails = new Set(querySnapshot.docs.map(doc => {
        const data = doc.data();
        return data.email ? data.email.toLowerCase() : '';
      }));

      for (const member of TEAM_2026_27) {
        if (existingEmails.has(member.email.toLowerCase())) {
          skippedCount++;
          continue;
        }

        await addDoc(collection(db, usersCollectionPath), {
          username: member.username,
          email: member.email,
          regNo: member.regNo,
          contact: member.contact,
          year: member.year,
          program: member.program,
          domain: member.domain,
          position: member.position,
          status: 'active',
          isAdmin: member.isAdmin,
          photo: null,
          createdAt: serverTimestamp ? serverTimestamp() : new Date()
        });
        seededCount++;
      }

      setMessage(`Seeding complete. Added ${seededCount} new members, skipped ${skippedCount} existing.`);
      setTimeout(() => setMessage(''), 5000);
    } catch (e) {
      console.error("Error seeding team:", e);
      setMessage(`Failed to seed team: ${e.message}`);
      setTimeout(() => setMessage(''), 5000);
    }
  };

  // Calculate user counts
  const totalUsers = allUsers.length;
  const activeUsersCount = allUsers.filter(user => user.status === 'active').length;
  const inactiveUsersCount = allUsers.filter(user => user.status === 'inactive').length;
  const pendingUsersCount = allUsers.filter(user => user.status === 'pending').length;

  // Custom sort function for users
  function userSort(a, b) {
    // 1. Domain priority
    const domainA = domainPriority.indexOf(a.domain);
    const domainB = domainPriority.indexOf(b.domain);
    if (domainA !== domainB) return domainA - domainB;
    // 2. For EB domain, sort by position
    if (a.domain === "EB" && b.domain === "EB") {
      const posA = positionPriority.indexOf(a.position);
      const posB = positionPriority.indexOf(b.position);
      if (posA !== posB) return posA - posB;
      // fallback: alphabetical by name
      return (a.username || '').localeCompare(b.username || '');
    }
    // 3. For other domains, sort by year then regNo
    const yearA = yearPriority.indexOf(a.year);
    const yearB = yearPriority.indexOf(b.year);
    if (yearA !== yearB) return yearA - yearB;
    const regA = a.regNo || '';
    const regB = b.regNo || '';
    const numA = parseInt(regA, 10);
    const numB = parseInt(regB, 10);
    if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
    return regA.localeCompare(regB);
  }

  // Filter and search logic
  const filteredUsers = allUsers.filter(user => {
    const matchesSearch = searchTerm === '' ||
      user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = filterStatus.length === 0 || filterStatus.includes(user.status);
    const matchesDomain = filterDomain.length === 0 || filterDomain.includes(user.domain);
    const matchesYear = filterYear.length === 0 || filterYear.includes(user.year);
    const matchesPosition = filterPosition.length === 0 || filterPosition.includes(user.position);

    return matchesSearch && matchesStatus && matchesDomain && matchesYear && matchesPosition;
  }).sort(userSort);

  const downloadUsersCSV = () => {
    const header = ['Full Name', 'Email', 'Contact', 'Year', 'Reg No', 'Program', 'Domain', 'Position', 'Status'];
    const rows = filteredUsers.map(user =>
      [
        `"${user.username}"`,
        user.email,
        user.contact,
        user.year,
        user.regNo,
        user.program,
        user.domain,
        user.position,
        user.status
      ].join(',')
    );

    const csvContent = [header.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'mdc_users_list.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Handle admin actions (attendance slots)
  const handleCreateSlot = async (e) => {
    e.preventDefault();
    if (!db || !isAdmin) return;

    if (!newSlotForm.slotType || !newSlotForm.slotName || !newSlotForm.date) {
      setModalMessage("Slot Type, Slot Name, and Date are mandatory.");
      return;
    }

    if (slotAttendance.length === 0) {
      setModalMessage("Please select at least one participating domain with active members.");
      return;
    }

    try {
      const slotsCollectionPath = `/artifacts/${appId}/public/data/attendance_slots`;
      const attendanceToSave = slotAttendance.map(user => ({
        userId: user.id,
        isPresent: user.isPresent,
        username: user.username,
        domain: user.domain,
        position: user.position,
      }));

      await addDoc(collection(db, slotsCollectionPath), {
        slotType: newSlotForm.slotType,
        slotName: newSlotForm.slotName,
        date: newSlotForm.date,
        venue: newSlotForm.venue || '',
        timings: newSlotForm.timings || '',
        selectedDomains: selectedDomains,
        eligibleUserIds: slotAttendance.map(u => u.id),
        attendance: attendanceToSave,
        createdAt: serverTimestamp(),
      });

      setModalMessage("Attendance slot created and posted successfully.");
      setNewSlotForm({ slotType: 'Event', slotName: '', date: '', venue: '', timings: '' });
      setSelectedDomains([]);
      setSlotAttendance([]);
      setTimeout(() => {
        setShowCreateSlot(false);
        setModalMessage('');
      }, 1000);
    } catch (e) {
      console.error("Error creating slot:", e.message);
      setModalMessage("Failed to create attendance slot. Please try again.");
    }
  };

  const handleEditSlot = async (e) => {
    e.preventDefault();
    if (!db || !isAdmin || !editingSlot) return;

    if (slotAttendance.length === 0) {
      setModalMessage("Please select at least one participating domain with active members.");
      return;
    }

    try {
      const slotDocRef = doc(db, `/artifacts/${appId}/public/data/attendance_slots`, editingSlot.id);
      const attendanceToSave = slotAttendance.map(user => ({
        userId: user.id,
        isPresent: user.isPresent,
        username: user.username,
        domain: user.domain,
        position: user.position,
      }));

      await updateDoc(slotDocRef, {
        slotType: editingSlot.slotType,
        slotName: editingSlot.slotName,
        date: editingSlot.date,
        venue: editingSlot.venue || '',
        timings: editingSlot.timings || '',
        selectedDomains: selectedDomains,
        eligibleUserIds: slotAttendance.map(u => u.id),
        attendance: attendanceToSave,
      });

      setModalMessage("Attendance records updated/overridden successfully.");
      setTimeout(() => {
        setEditingSlot(null);
        setModalMessage('');
        setSelectedDomains([]);
        setSlotAttendance([]);
      }, 1000);
    } catch (e) {
      console.error("Error updating slot:", e);
      setModalMessage("Failed to update attendance records. Please try again.");
    }
  };

  const handleDeleteSlot = (slot) => {
    if (!db || !isAdmin) return;
    setModalMessage('');
    setDeletingSlot(slot);
  };

  const confirmDeleteSlot = async () => {
    if (!db || !isAdmin || !deletingSlot) return;
    try {
      const slotDocRef = doc(db, `/artifacts/${appId}/public/data/attendance_slots`, deletingSlot.id);
      await deleteDoc(slotDocRef);
      setMessage("Attendance slot deleted successfully.");
      setDeletingSlot(null);
    } catch (e) {
      console.error("Error deleting slot:", e.message);
      setMessage("Failed to delete attendance slot. Please try again.");
      setDeletingSlot(null);
    }
  };

  const handleMarkAttendance = (slot) => {
    setModalMessage('');
    setEditingSlot(slot);

    let domainsList = slot.selectedDomains;
    if (!domainsList || domainsList.length === 0) {
      domainsList = Array.from(new Set(
        allUsers.filter(u => (slot.eligibleUserIds || []).includes(u.id)).map(u => u.domain)
      ));
    }
    setSelectedDomains(domainsList);

    const usersForSlot = allUsers.filter(u => u.status === 'active' && domainsList.includes(u.domain));
    const initialAttendance = usersForSlot.map(user => {
      const attendanceRecord = (slot.attendance || []).find(a => a.userId === user.id);
      return {
        id: user.id,
        username: user.username,
        email: user.email,
        domain: user.domain,
        position: user.position,
        isPresent: attendanceRecord ? attendanceRecord.isPresent : false
      };
    });
    setSlotAttendance(initialAttendance);
  };

  const handleOverrideUserAttendance = async (userId, slotId, newIsPresent) => {
    if (firebaseNotConfigured) {
      setAttendanceSlots(prev => prev.map(s => {
        if (s.id !== slotId) return s;
        const updatedAttendance = (s.attendance || []).map(a =>
          a.userId === userId ? { ...a, isPresent: newIsPresent } : a
        );
        if (!updatedAttendance.some(a => a.userId === userId)) {
          const user = MOCK_USERS.find(u => u.id === userId);
          if (user) {
            updatedAttendance.push({
              userId: user.id,
              isPresent: newIsPresent,
              username: user.username,
              domain: user.domain,
              position: user.position
            });
          }
        }
        return { ...s, attendance: updatedAttendance };
      }));
      setMessage("Attendance overridden successfully (Local Mock).");
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    if (!db || !isAdmin) return;

    try {
      const slot = attendanceSlots.find(s => s.id === slotId);
      if (!slot) return;

      const slotDocRef = doc(db, `/artifacts/${appId}/public/data/attendance_slots`, slotId);

      const updatedAttendance = (slot.attendance || []).map(a =>
        a.userId === userId ? { ...a, isPresent: newIsPresent } : a
      );

      if (!updatedAttendance.some(a => a.userId === userId)) {
        const user = allUsers.find(u => u.id === userId);
        if (user) {
          updatedAttendance.push({
            userId: user.id,
            isPresent: newIsPresent,
            username: user.username,
            domain: user.domain,
            position: user.position
          });
        }
      }

      await updateDoc(slotDocRef, {
        attendance: updatedAttendance
      });

      setMessage("Attendance overridden successfully.");
      setTimeout(() => setMessage(''), 3000);
    } catch (e) {
      console.error("Error overriding attendance:", e);
      setMessage("Failed to override attendance.");
      setTimeout(() => setMessage(''), 3000);
    }
  };

  const handleExportAttendance = () => {
    if (slotAttendance.length === 0) {
      setModalMessage("No attendance data to export.");
      return;
    }

    const header = ['Full Name', 'email', 'status'];
    const rows = slotAttendance.map(user =>
      [user.username, user.email, user.isPresent ? 'present' : 'absent'].join(',')
    );

    const csvContent = [header.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    const activeSlot = editingSlot;
    const fileName = `attendance_${activeSlot ? activeSlot.slotName.replace(/ /g, '_') : 'slot'}_${activeSlot ? activeSlot.date : 'date'}.csv`;
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImportCSV = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const text = evt.target.result;
        const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
        if (lines.length <= 1) return;

        const headers = lines[0].toLowerCase().split(',');
        const emailIndex = headers.indexOf('email');
        const statusIndex = headers.indexOf('status');

        if (emailIndex === -1 || statusIndex === -1) {
          setModalMessage("CSV must contain 'email' and 'status' columns.");
          return;
        }

        const imported = lines.slice(1).map(line => {
          const parts = line.split(',');
          return {
            email: parts[emailIndex]?.trim()?.toLowerCase(),
            status: parts[statusIndex]?.trim()?.toLowerCase()
          };
        });

        setSlotAttendance(prev => prev.map(u => {
          const record = imported.find(i => i.email === u.email.toLowerCase());
          return record ? { ...u, isPresent: record.status === 'present' } : u;
        }));

        setModalMessage("CSV imported successfully!");
      } catch (err) {
        console.error(err);
        setModalMessage("Failed to parse CSV.");
      }
    };
    reader.readAsText(file);
  };

  const filteredAttendanceList = slotAttendance.filter(user => {
    const matchesSearch = attendanceSearchTerm === '' || user.username.toLowerCase().includes(attendanceSearchTerm.toLowerCase());
    const matchesDomain = attendanceFilterDomain.length === 0 || attendanceFilterDomain.includes(user.domain);
    const matchesPosition = attendanceFilterPosition.length === 0 || attendanceFilterPosition.includes(user.position);
    return matchesSearch && matchesDomain && matchesPosition;
  });

  const presentCount = filteredAttendanceList.filter(user => user.isPresent).length;
  const absentCount = filteredAttendanceList.filter(user => !user.isPresent).length;

  const getAttendanceSummary = (userId, type) => {
    const relevantSlots = attendanceSlots.filter(slot => {
      if (!slot.attendance || slot.attendance.length === 0) return false;
      const normalizedSlotTypeFromData = normalizeSlotType(slot.slotType);
      return (normalizedSlotTypeFromData === type || type === 'all') && slot.attendance.some(a => a.userId === userId);
    });

    const attendedSessions = relevantSlots.filter(slot =>
      slot.attendance.some(a => a.userId === userId && a.isPresent)
    ).length;

    const totalSessions = relevantSlots.length;

    return `${attendedSessions} / ${totalSessions}`;
  };

  const getAttendancePercentage = (userId, type) => {
    const relevantSlots = attendanceSlots.filter(slot => {
      if (!slot.attendance || slot.attendance.length === 0) return false;
      const normalizedSlotTypeFromData = normalizeSlotType(slot.slotType);
      return (normalizedSlotTypeFromData === type || type === 'all') && slot.attendance.some(a => a.userId === userId);
    });

    const attendedSessions = relevantSlots.filter(slot =>
      slot.attendance.some(a => a.userId === userId && a.isPresent)
    ).length;

    const totalSessions = relevantSlots.length;

    if (totalSessions === 0) return '0.0%';
    const percentage = (attendedSessions / totalSessions) * 100;
    return `${percentage.toFixed(1)}%`;
  };

  // Render attendance percentage with conditional red font based on thresholds:
  // - overall (type === 'all'): red if < 75%
  // - per-type (event, coreteammeeting, domainmeeting): red if < 50%
  const renderAttendanceWithColor = (userId, type) => {
    const pctStr = getAttendancePercentage(userId, type);
    const pctNum = parseFloat(pctStr) || 0;
    const isOverall = type === 'all';
    const threshold = isOverall ? 75 : 50;
    const className = pctNum < threshold ? 'text-red-600' : '';
    return <span className={className}>{pctStr}</span>;
  };

  const calculateAverageAttendanceRate = () => {
    const activeUsers = allUsers.filter(user => user.status === 'active');
    if (activeUsers.length === 0 || attendanceSlots.length === 0) {
      return '0.0%';
    }

    const totalPresent = attendanceSlots.reduce((total, slot) => {
      return total + slot.attendance.filter(a => a.isPresent).length;
    }, 0);

    const totalPossibleAttendance = activeUsers.length * attendanceSlots.length;
    if (totalPossibleAttendance === 0) return '0.0%';

    const averageRate = (totalPresent / totalPossibleAttendance) * 100;
    return `${averageRate.toFixed(1)}%`;
  };

  const downloadCSV = () => {
    const activeUsers = allUsers.filter(user => user.status === 'active');
    const header = [
      'Full Name',
      'Domain',
      'Position',
      'Overall Attendance (%)',
      'Events (%)',
      'Core Team (%)',
      'Domain M. (%)'
    ];

    const rows = activeUsers.map(user => {
      const overall = getAttendancePercentage(user.id, 'all');
      const events = getAttendancePercentage(user.id, 'event');
      const coreTeam = getAttendancePercentage(user.id, 'coreteammeeting');
      const domainM = getAttendancePercentage(user.id, 'domainmeeting');
      return [
        user.username,
        user.domain,
        user.position,
        overall,
        events,
        coreTeam,
        domainM
      ].join(',');
    });

    const csvContent = [header.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', 'attendance_report.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadMemberAttendance = (member) => {
    if (!member) return;
    // Use the already-computed memberAttendanceDetails filtered by selectedMember
    const rowsData = attendanceSlots.filter(slot =>
      slot.attendance.some(a => a.userId === member.id) &&
      (dashboardFilterMonth.length === 0 || dashboardFilterMonth.includes(new Date(slot.date).getMonth().toString())) &&
      (dashboardFilterYear.length === 0 || dashboardFilterYear.includes(new Date(slot.date).getFullYear().toString()))
    ).map(slot => {
      const attendanceRecord = slot.attendance.find(a => a.userId === member.id);
      return {
        slotName: slot.slotName,
        slotType: slotTypesMap[normalizeSlotType(slot.slotType)] || slot.slotType,
        date: formatDate(slot.date),
        timings: slot.timings,
        status: attendanceRecord ? (attendanceRecord.isPresent ? 'Present' : 'Absent') : 'Absent'
      };
    }).sort((a, b) => {
      // sort by original date asc using parsed date from dd-mm-yyyy
      const parseDDMMYYYY = (s) => {
        const [d, m, y] = s.split('-'); return new Date(`${y}-${m}-${d}`);
      };
      return parseDDMMYYYY(a.date) - parseDDMMYYYY(b.date);
    });

    const header = ['Slot Name', 'Slot Type', 'Date', 'Timings', 'Status'];
    const rows = rowsData.map(r => [r.slotName, r.slotType, r.date, r.timings, r.status].map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','));
    const csvContent = [header.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${member.username.replace(/\s+/g, '_')}_attendance.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleViewMemberDetails = (member) => {
    setModalMessage('');
    setSelectedMember(member);
    setShowMemberAttendanceDetails(true);
  };

  const memberAttendanceDetails = selectedMember ? attendanceSlots.filter(slot =>
    slot.attendance.some(a => a.userId === selectedMember.id) &&
    (dashboardFilterMonth.length === 0 || dashboardFilterMonth.includes(new Date(slot.date).getMonth().toString())) &&
    (dashboardFilterYear.length === 0 || dashboardFilterYear.includes(new Date(slot.date).getFullYear().toString()))
  ).sort((a, b) => new Date(a.date) - new Date(b.date)).map(slot => {
    const attendanceRecord = slot.attendance.find(a => a.userId === selectedMember.id);
    return {
      ...slot,
      isPresent: attendanceRecord ? attendanceRecord.isPresent : false,
      status: attendanceRecord ? (attendanceRecord.isPresent ? 'Present' : 'Absent') : 'Absent'
    };
  }) : [];

  // User Profile and Password Management
  const handleEditProfile = async (e) => {
    e.preventDefault();
    try {
      const userDocRef = doc(db, `/artifacts/${appId}/public/data/users`, userProfile.id);
      await updateDoc(userDocRef, {
        username: userProfile.username,
        email: userProfile.email,
        contact: userProfile.contact,
        year: userProfile.year,
        regNo: userProfile.regNo,
        program: userProfile.program,
        domain: userProfile.domain,
        position: userProfile.position,
        photo: userProfile.photo,
      });
      setModalMessage("Profile updated successfully!");
      setTimeout(() => {
        setShowEditProfileModal(false);
        setModalMessage('');
      }, 1000);
    } catch (e) {
      console.error("Error updating profile:", e);
      setModalMessage("Failed to update profile.");
    }
  };

  const handlePhotoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onloadend = () => {
        setUserProfile({ ...userProfile, photo: reader.result });
      };
    }
  };

  // User Dashboard Attendance Records
  const userAttendanceRecords = attendanceSlots.filter(slot =>
    slot.attendance.some(a => a.userId === userProfile?.id)
  ).filter(slot => {
    const isCorrectType = userDashboardFilters.slotType.length === 0 || userDashboardFilters.slotType.includes(normalizeSlotType(slot.slotType));
    const isPresentForUser = !!slot.attendance.find(a => a.userId === userProfile.id)?.isPresent;
    const isCorrectStatus = userDashboardFilters.status.length === 0 || userDashboardFilters.status.includes(isPresentForUser ? 'present' : 'absent');

    const slotDate = new Date(slot.date);
    const fromDate = userDashboardFilters.fromDate ? new Date(userDashboardFilters.fromDate) : null;
    const toDate = userDashboardFilters.toDate ? new Date(userDashboardFilters.toDate) : null;
    const isCorrectDate = (!fromDate || slotDate >= fromDate) && (!toDate || slotDate <= toDate);

    return isCorrectType && isCorrectStatus && isCorrectDate;
  }).map(slot => {
    const attendanceRecord = slot.attendance.find(a => a.userId === userProfile.id);
    return {
      ...slot,
      isPresent: attendanceRecord ? attendanceRecord.isPresent : false,
      status: attendanceRecord ? (attendanceRecord.isPresent ? 'Present' : 'Absent') : 'Absent'
    };
  });

  // getSlotTiming was removed because it was defined but never used.

  // Format ISO-ish date strings (YYYY-MM-DD or full ISO) to DD-MM-YYYY for display
  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    // If already in YYYY-MM-DD, split
    if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(dateStr)) {
      const [y, m, d] = dateStr.split('-');
      return `${d.padStart(2, '0')}-${m.padStart(2, '0')}-${y}`;
    }
    // Try parsing other date formats
    const dt = new Date(dateStr);
    if (isNaN(dt)) return dateStr;
    const dd = String(dt.getDate()).padStart(2, '0');
    const mm = String(dt.getMonth() + 1).padStart(2, '0');
    const yyyy = dt.getFullYear();
    return `${dd}-${mm}-${yyyy}`;
  };

  // Memoize violations map for performance (recompute when users or slots change)
  const violationsMap = useMemo(() => {
    const computeConsecutiveAbsenceViolationsForUser = (userId, slots) => {
      if (!userId || !Array.isArray(slots) || slots.length === 0) {
        return { violationCount: 0, violations: [] };
      }

      const relevantSlots = slots
        .slice()
        .sort((a, b) => new Date(a.date) - new Date(b.date))
        .filter(slot => {
          if (!slot) return false;
          const hasEligibleList = Array.isArray(slot.eligibleUserIds) && slot.eligibleUserIds.length > 0;
          if (hasEligibleList) return slot.eligibleUserIds.includes(userId);
          // legacy: include if attendance entry exists for user
          return Array.isArray(slot.attendance) && slot.attendance.some(a => a.userId === userId);
        });

      const statusArr = relevantSlots.map(slot => {
        const rec = Array.isArray(slot.attendance) ? slot.attendance.find(a => a.userId === userId) : null;
        const hasEligibleList = Array.isArray(slot.eligibleUserIds) && slot.eligibleUserIds.length > 0;
        const isPresent = rec ? !!rec.isPresent : (hasEligibleList ? false : false);
        return {
          slotId: slot.id,
          date: slot.date,
          slotName: slot.slotName || '',
          isPresent
        };
      });

      const violations = [];
      for (let i = 0; i <= statusArr.length - 3; i++) {
        const window = statusArr.slice(i, i + 3);
        if (window.every(s => !s.isPresent)) {
          violations.push({
            slotIds: window.map(w => w.slotId),
            dates: window.map(w => formatDate(w.date)),
            slotNames: window.map(w => w.slotName)
          });
        }
      }

      return { violationCount: violations.length, violations };
    };

    const map = {};
    if (!Array.isArray(allUsers) || !Array.isArray(attendanceSlots)) return map;
    allUsers.forEach(user => {
      if (!user || user.status !== 'active') return;
      map[user.id] = computeConsecutiveAbsenceViolationsForUser(user.id, attendanceSlots);
    });
    return map;
  }, [allUsers, attendanceSlots]);


  // Nav bar and main content
  const renderNav = () => (
    <nav className="relative z-40 bg-white/80 backdrop-blur-xl text-mdc-900 px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-3 rounded-3xl shadow-sm border border-mdc-100">
      <div className="flex items-center gap-2 pl-1.5 pr-4 py-1.5 rounded-full bg-mdc-100 border border-mdc-200 flex-shrink-0">
        <img
          src="/mdclogo.png"
          alt="MDC Logo"
          className="w-7 h-7 object-contain flex-shrink-0"
        />
        <span className="hidden sm:inline text-sm font-semibold tracking-tight whitespace-nowrap text-mdc-900">Meta Developer Communities</span>
        <span className="sm:hidden text-sm font-semibold tracking-tight text-mdc-900">MDC</span>
      </div>
      {isAdmin && (
        <div className="flex-1 min-w-0 flex justify-end overflow-x-auto">
          <div className="flex items-center gap-1 p-1 rounded-full bg-mdc-100 border border-mdc-200 flex-shrink-0">
            <button onClick={() => { setAdminView('dashboard'); setShowProfileDropdown(false); }} className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all ${adminView === 'dashboard' ? 'bg-mdc-700 text-white shadow-sm' : 'text-mdc-700 hover:bg-white'}`}>
              Dashboard
            </button>
            <button onClick={() => { setAdminView('manageUsers'); setShowProfileDropdown(false); }} className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all ${adminView === 'manageUsers' ? 'bg-mdc-700 text-white shadow-sm' : 'text-mdc-700 hover:bg-white'}`}>
              Manage Users
            </button>
            <button onClick={() => { setAdminView('attendanceSlots'); setShowProfileDropdown(false); }} className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all ${adminView === 'attendanceSlots' ? 'bg-mdc-700 text-white shadow-sm' : 'text-mdc-700 hover:bg-white'}`}>
              Attendance Slots
            </button>
          </div>
        </div>
      )}
      <div className="relative z-30 flex items-center gap-2 sm:gap-3 flex-shrink-0">
        <div
          className="relative"
          ref={profileDropdownRef}
        >
          {userProfile && !isAdmin ? (
            <button onClick={() => setShowProfileDropdown(prev => !prev)} className="w-10 h-10 rounded-full bg-mdc-100 border border-mdc-200 flex items-center justify-center text-mdc-700 transition-transform transform hover:scale-110">
              {userProfile.photo ? (
                <img src={userProfile.photo} alt="Profile" className="w-full h-full rounded-full object-cover" />
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.982 18.725A7.488 7.488 0 0012 15.75a7.488 7.488 0 00-5.982 2.975m11.963 0a7.5 7.5 0 10-11.963 0m11.963 0A8.966 8.966 0 0112 21a8.966 8.966 0 01-5.982-2.275M15 9.75a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              )}
            </button>
          ) : isAdmin ? (
            <button onClick={() => setShowProfileDropdown(prev => !prev)} className="w-10 h-10 rounded-full bg-mdc-100 border border-mdc-200 flex items-center justify-center text-mdc-700 transition-transform transform hover:scale-110">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.982 18.725A7.488 7.488 0 0012 15.75a7.488 7.488 0 00-5.982 2.975m11.963 0a7.5 7.5 0 10-11.963 0m11.963 0A8.966 8.966 0 0112 21a8.966 8.966 0 01-5.982-2.275M15 9.75a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          ) : null}
          {showProfileDropdown && (
            <div className="animate-dropdown-in origin-top-right absolute right-0 mt-2 w-52 bg-white rounded-2xl shadow-xl shadow-mdc-900/10 border border-mdc-100 p-1.5 z-20">
              {!isAdmin && (
                <button onClick={() => { setModalMessage(''); setShowEditProfileModal(true); setShowProfileDropdown(false); }} className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-mdc-900 hover:bg-mdc-100 w-full text-left transition-colors">
                  Edit Details
                </button>
              )}
              <button onClick={handleLogout} className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 w-full text-left transition-colors">
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );

  const renderContent = () => {
    switch (view) {
      case 'adminDashboard':
        return (
          <div className="text-mdc-900">
            <div>
              {adminView === 'dashboard' && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {[
                      { label: 'Active Users', value: activeUsersCount, dot: 'bg-green-500' },
                      { label: 'Pending Approvals', value: pendingUsersCount, dot: 'bg-yellow-500' },
                      { label: 'Total Slots', value: attendanceSlots.length, dot: 'bg-mdc-500' },
                      { label: 'Avg. Attendance Rate', value: calculateAverageAttendanceRate(), dot: 'bg-mdc-700' },
                    ].map((tile, i) => (
                      <div
                        key={tile.label}
                        className={`bg-white p-4 rounded-2xl shadow-sm border border-mdc-100 text-center text-mdc-900 hover:shadow-md hover:-translate-y-0.5 transition-all animate-fade-in-up${i ? ` stagger-${i}` : ''}`}
                      >
                        <p className="flex items-center justify-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
                          <span className={`w-1.5 h-1.5 rounded-full ${tile.dot}`} />
                          {tile.label}
                        </p>
                        <p className="text-3xl font-bold tracking-tight mt-1">{tile.value}</p>
                      </div>
                    ))}
                  </div>

                  <h3 className="text-lg font-semibold tracking-tight text-mdc-900 mt-12 mb-4">Member Attendance Overview</h3>
                  <div className="animate-fade-in-up relative z-20 bg-white rounded-2xl shadow-sm border border-mdc-100 p-4 flex flex-wrap items-center gap-3">
                    <CustomMultiSelect
                      className="w-full sm:w-44"
                      allLabel="All Attendance %"
                      value={dashboardFilterAttendance}
                      onChange={(val) => setDashboardFilterAttendance(val)}
                      options={[
                        { value: '0-25', label: '0-25%' },
                        { value: '26-50', label: '26-50%' },
                        { value: '51-75', label: '51-75%' },
                        { value: '76-100', label: '76-100%' },
                      ]}
                    />
                    <CustomMultiSelect
                      className="w-full sm:w-40"
                      allLabel="All Domains"
                      value={dashboardFilterDomain}
                      onChange={(val) => setDashboardFilterDomain(val)}
                      options={domains.map(d => ({ value: d, label: d }))}
                    />
                    <CustomMultiSelect
                      className="w-full sm:w-40"
                      allLabel="All Positions"
                      value={dashboardFilterPosition}
                      onChange={(val) => setDashboardFilterPosition(val)}
                      options={positions.map(p => ({ value: p, label: p }))}
                    />
                    <button onClick={downloadCSV} className="w-full sm:w-auto py-2 px-6 bg-gradient-to-r from-mdc-500 to-mdc-700 hover:from-mdc-700 hover:to-mdc-900 text-white font-semibold rounded-full shadow-md shadow-mdc-900/20 hover:shadow-lg active:scale-[0.98] transition-all">
                      Download CSV
                    </button>
                  </div>

                  <div className="animate-fade-in-up overflow-x-auto mt-4 bg-white rounded-2xl shadow-sm border border-mdc-100">
                    <table className="min-w-full divide-y divide-mdc-100">
                      <thead className="bg-mdc-50">
                        <tr>
                          <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Full Name</th>
                          <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Domain</th>
                          <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Position</th>
                          <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Overall (%)</th>
                          <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Events (%)</th>
                          <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Core Team (%)</th>
                          <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Domain M. (%)</th>
                          <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Violation</th>
                          <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Details</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-mdc-100">
                        {allUsers.filter(user => user.status === 'active' &&
                          (dashboardFilterDomain.length === 0 || dashboardFilterDomain.includes(user.domain)) &&
                          (dashboardFilterPosition.length === 0 || dashboardFilterPosition.includes(user.position))
                        ).sort(userSort).map(user => {
                          const overallPercentage = parseFloat(getAttendancePercentage(user.id, 'all'));
                          const matchesAttendanceFilter = dashboardFilterAttendance.length === 0 || dashboardFilterAttendance.some(bucket =>
                            (bucket === '0-25' && overallPercentage >= 0 && overallPercentage <= 25) ||
                            (bucket === '26-50' && overallPercentage > 25 && overallPercentage <= 50) ||
                            (bucket === '51-75' && overallPercentage > 50 && overallPercentage <= 75) ||
                            (bucket === '76-100' && overallPercentage > 75 && overallPercentage <= 100)
                          );

                          if (!matchesAttendanceFilter) return null;

                          return (
                            <tr key={user.id}>
                              <td className="px-6 py-3.5 whitespace-nowrap text-sm text-gray-700">{user.username}</td>
                              <td className="px-6 py-3.5 whitespace-nowrap text-sm text-gray-700">{user.domain}</td>
                              <td className="px-6 py-3.5 whitespace-nowrap text-sm text-gray-700">{user.position}</td>
                              <td className="px-6 py-3.5 whitespace-nowrap text-sm text-gray-700">{renderAttendanceWithColor(user.id, 'all')}</td>
                              <td className="px-6 py-3.5 whitespace-nowrap text-sm text-gray-700">{renderAttendanceWithColor(user.id, 'event')}</td>
                              <td className="px-6 py-3.5 whitespace-nowrap text-sm text-gray-700">{renderAttendanceWithColor(user.id, 'coreteammeeting')}</td>
                              <td className="px-6 py-3.5 whitespace-nowrap text-sm text-gray-700">{renderAttendanceWithColor(user.id, 'domainmeeting')}</td>
                              <td className="px-6 py-3.5 whitespace-nowrap text-sm text-gray-700">
                                {(() => {
                                  const v = violationsMap[user.id] || { violationCount: 0, violations: [] };
                                  if (v.violationCount === 0) {
                                    return (
                                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-50 text-gray-700 ring-1 ring-inset ring-gray-200">
                                        {/* <span className="w-1.5 h-1.5 rounded-full bg-green-500" /> */}
                                        No
                                      </span>
                                    );
                                  }
                                  return (
                                    <div className="flex items-center space-x-2">
                                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-50 text-gray-700 ring-1 ring-inset ring-gray-200">
                                        <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                                        Yes
                                      </span>
                                      <button onClick={() => { setViolationModalMember(user); setShowViolationModal(true); }} className="text-sm font-semibold text-red-600">({v.violationCount})</button>
                                    </div>
                                  );
                                })()}
                              </td>
                              <td className="px-6 py-3.5 whitespace-nowrap text-sm text-gray-700">
                                <button onClick={() => handleViewMemberDetails(user)}>
                                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-gray-600">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.577 3.01 9.964 7.822.13.438.13.921 0 1.359C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.577-3.01-9.964-7.822z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                  </svg>
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
              {adminView === 'manageUsers' && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
                    {[
                      { label: 'Total Users', value: totalUsers, dot: 'bg-mdc-700', text: 'text-mdc-900' },
                      { label: 'Active Users', value: activeUsersCount, dot: 'bg-green-500', text: 'text-green-700' },
                      { label: 'Inactive Users', value: inactiveUsersCount, dot: 'bg-red-500', text: 'text-red-700' },
                      { label: 'Pending Approvals', value: pendingUsersCount, dot: 'bg-yellow-500', text: 'text-yellow-700' },
                    ].map((tile, i) => (
                      <div
                        key={tile.label}
                        className={`bg-white p-4 rounded-2xl shadow-sm border border-mdc-100 text-center hover:shadow-md hover:-translate-y-0.5 transition-all animate-fade-in-up${i ? ` stagger-${i}` : ''}`}
                      >
                        <p className="flex items-center justify-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
                          <span className={`w-1.5 h-1.5 rounded-full ${tile.dot}`} />
                          {tile.label}
                        </p>
                        <p className={`text-3xl font-bold tracking-tight mt-1 ${tile.text}`}>{tile.value}</p>
                      </div>
                    ))}
                  </div>

                  <div className="mt-6 animate-fade-in-up relative z-20 bg-white rounded-2xl shadow-sm border border-mdc-100 p-4 flex flex-wrap items-center gap-3">
                    <input
                      type="text"
                      placeholder="Search users..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full sm:w-auto p-3 rounded-lg bg-white border border-mdc-300 focus:outline-none focus:ring-2 focus:ring-mdc-500 focus:border-transparent transition-colors"
                    />
                    <CustomMultiSelect
                      className="w-full sm:w-44"
                      allLabel="All Statuses"
                      value={filterStatus}
                      onChange={(val) => setFilterStatus(val)}
                      options={[
                        { value: 'active', label: 'Active' },
                        { value: 'inactive', label: 'Inactive' },
                        { value: 'pending', label: 'Pending Approval' },
                      ]}
                    />
                    <CustomMultiSelect
                      className="w-full sm:w-40"
                      allLabel="All Domains"
                      value={filterDomain}
                      onChange={(val) => setFilterDomain(val)}
                      options={domains.map(d => ({ value: d, label: d }))}
                    />
                    <CustomMultiSelect
                      className="w-full sm:w-36"
                      allLabel="All Years"
                      value={filterYear}
                      onChange={(val) => setFilterYear(val)}
                      options={years.map(y => ({ value: y, label: y }))}
                    />
                    <CustomMultiSelect
                      className="w-full sm:w-40"
                      allLabel="All Positions"
                      value={filterPosition}
                      onChange={(val) => setFilterPosition(val)}
                      options={positions.map(p => ({ value: p, label: p }))}
                    />
                    {/* <button onClick={downloadUsersCSV} className="w-full sm:w-auto py-2 px-6 bg-gradient-to-r from-mdc-500 to-mdc-700 hover:from-mdc-700 hover:to-mdc-900 text-white font-semibold rounded-full shadow-md shadow-mdc-900/20 hover:shadow-lg active:scale-[0.98] transition-all">
                      Download CSV
                    </button> */}
                    {/* <button onClick={handleSeedTeam} className="w-full sm:w-auto py-2 px-6 bg-gradient-to-r from-green-600 to-green-800 hover:from-green-700 hover:to-green-900 text-white font-semibold rounded-full shadow-md shadow-green-900/20 hover:shadow-lg active:scale-[0.98] transition-all">
                      Seed 2026-27 Team
                    </button> */}
                    <button onClick={() => setNewUser({ username: '', email: '', contact: '', year: '1st year', regNo: '', program: '', domain: 'EB', position: 'Member' })} className="w-full sm:w-auto py-2 px-6 bg-gradient-to-r from-blue-600 to-blue-800 hover:from-blue-700 hover:to-blue-900 text-white font-semibold rounded-full shadow-md shadow-blue-900/20 hover:shadow-lg active:scale-[0.98] transition-all">
                      Add Member
                    </button>
                  </div>

                  <h3 className="text-lg font-semibold tracking-tight text-mdc-900 mt-12 mb-4">All Members</h3>
                  {filteredUsers.length > 0 ? (
                    <div className="animate-fade-in-up overflow-x-auto bg-white rounded-2xl shadow-sm border border-mdc-100">
                      <table className="min-w-full divide-y divide-mdc-100">
                        <thead className="bg-mdc-50">
                          <tr>
                            <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Photo</th>
                            <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Full Name</th>
                            <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Email</th>
                            <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Contact</th>
                            <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Reg No</th>
                            <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Program</th>
                            <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Year</th>
                            <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Domain</th>
                            <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Position</th>
                            <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                            <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-mdc-100">
                          {filteredUsers.map(user => (
                            <tr key={user.id}>
                              <td className="px-6 py-3.5 whitespace-nowrap text-sm text-gray-700">
                                <img
                                  src={user.photo || `https://placehold.co/48x48/2a7b6a/FFFFFF?text=${user.username.charAt(0).toUpperCase()}`}
                                  alt={`${user.username}`}
                                  className="w-12 h-12 rounded-full object-cover"
                                  onError={(e) => { e.target.onerror = null; e.target.src = `https://placehold.co/48x48/2a7b6a/FFFFFF?text=${user.username.charAt(0).toUpperCase()}`; }}
                                />
                              </td>
                              <td className="px-6 py-3.5 whitespace-nowrap text-sm text-gray-700">{user.username}</td>
                              <td className="px-6 py-3.5 whitespace-nowrap text-sm text-gray-700">{user.email}</td>
                              <td className="px-6 py-3.5 whitespace-nowrap text-sm text-gray-700">{user.contact}</td>
                              <td className="px-6 py-3.5 whitespace-nowrap text-sm text-gray-700">{user.regNo}</td>
                              <td className="px-6 py-3.5 whitespace-nowrap text-sm text-gray-700">{user.program}</td>
                              <td className="px-6 py-3.5 whitespace-nowrap text-sm text-gray-700">{user.year}</td>
                              <td className="px-6 py-3.5 whitespace-nowrap text-sm text-gray-700">{user.domain}</td>
                              <td className="px-6 py-3.5 whitespace-nowrap text-sm text-gray-700">{user.position}</td>
                              <td className="px-6 py-3.5 whitespace-nowrap text-sm text-gray-700">
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-50 text-gray-700 ring-1 ring-inset ring-gray-200">
                                  <span className={`w-1.5 h-1.5 rounded-full ${user.status === 'active' ? 'bg-green-500' : user.status === 'inactive' ? 'bg-red-500' : 'bg-yellow-500'}`} />
                                  {user.status.charAt(0).toUpperCase() + user.status.slice(1)}
                                </span>
                              </td>
                              <td className="px-6 py-3.5 whitespace-nowrap text-right text-sm font-medium">
                                <div className="flex space-x-2 justify-end">
                                  <button
                                    onClick={() => handleToggleStatus(user)}
                                    className={`${user.status === 'active' ? 'text-red-600 hover:text-red-900' : 'text-green-600 hover:text-green-900'} font-semibold`}
                                  >
                                    {user.status === 'active' ? 'Deactivate' : 'Activate'}
                                  </button>
                                  <button
                                    onClick={() => { setModalMessage(''); setEditingUser(user); }}
                                    className="text-mdc-700 hover:text-mdc-900 font-semibold"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    onClick={() => handleDeleteUser(user)}
                                    className="text-gray-600 hover:text-gray-900 font-semibold"
                                  >
                                    Delete
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="bg-white rounded-2xl shadow-sm border border-mdc-100 py-16 flex flex-col items-center justify-center gap-3">
                      <svg className="w-10 h-10 text-mdc-300" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                      </svg>
                      <p className="text-sm font-medium text-gray-500">No users found</p>
                      <p className="text-xs text-gray-400">Try adjusting your search or filters.</p>
                    </div>
                  )}
                </>
              )}
              {adminView === 'attendanceSlots' && (
                <>
                  <div className="animate-fade-in-up relative z-20 bg-white rounded-2xl shadow-sm border border-mdc-100 p-4 flex flex-wrap items-center justify-between gap-3 mt-6">
                    <div className="flex flex-wrap items-center gap-3">
                      <button onClick={() => { setModalMessage(''); setSelectedDomains(domains); setSlotAttendance([]); setShowCreateSlot(true); }} className="py-2 px-6 bg-gradient-to-r from-mdc-300 to-mdc-500 hover:from-mdc-500 hover:to-mdc-700 text-white font-semibold rounded-full shadow-md shadow-mdc-900/10 hover:shadow-lg active:scale-[0.98] transition-all">
                        Post Attendance
                      </button>
                      <CustomMultiSelect
                        className="w-36"
                        allLabel="All Slots"
                        value={slotTypeFilter}
                        onChange={(val) => setSlotTypeFilter(val)}
                        options={slotTypes.map(type => ({ value: type, label: type }))}
                      />
                      <CustomMultiSelect
                        className="w-40"
                        allLabel="All Months"
                        value={slotMonthFilter}
                        onChange={(val) => setSlotMonthFilter(val)}
                        options={Array.from({ length: 12 }, (_, i) => ({ value: String(i), label: new Date(0, i).toLocaleString('default', { month: 'long' }) }))}
                      />
                      <CustomMultiSelect
                        className="w-32"
                        allLabel="All Years"
                        value={slotYearFilter}
                        onChange={(val) => setSlotYearFilter(val)}
                        options={Array.from(new Set(attendanceSlots.map(s => new Date(s.date).getFullYear()))).map(y => ({ value: String(y), label: String(y) }))}
                      />
                    </div>
                  </div>
                  <h3 className="text-lg font-semibold tracking-tight text-mdc-900 mt-12 mb-4">All Attendance Slots</h3>
                  {attendanceSlots.filter(slot =>
                    (slotTypeFilter.length === 0 || slotTypeFilter.includes(slot.slotType)) &&
                    (slotMonthFilter.length === 0 || slotMonthFilter.includes(new Date(slot.date).getMonth().toString())) &&
                    (slotYearFilter.length === 0 || slotYearFilter.includes(new Date(slot.date).getFullYear().toString()))
                  ).length > 0 ? (
                    <div className="animate-fade-in-up overflow-x-auto bg-white rounded-2xl shadow-sm border border-mdc-100">
                      <table className="min-w-full divide-y divide-mdc-100">
                        <thead className="bg-mdc-50">
                          <tr>
                            <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Slot Name</th>
                            <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</th>
                            <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                            <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Venue / Room</th>
                            <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Timings</th>
                            <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-mdc-100">
                          {[...attendanceSlots.filter(slot =>
                            (slotTypeFilter.length === 0 || slotTypeFilter.includes(slot.slotType)) &&
                            (slotMonthFilter.length === 0 || slotMonthFilter.includes(new Date(slot.date).getMonth().toString())) &&
                            (slotYearFilter.length === 0 || slotYearFilter.includes(new Date(slot.date).getFullYear().toString()))
                          )].sort((a, b) => new Date(a.date) - new Date(b.date)).map(slot => (
                            <tr key={slot.id}>
                              <td className="px-6 py-3.5 whitespace-nowrap text-sm text-gray-700 font-semibold">{slot.slotName}</td>
                              <td className="px-6 py-3.5 whitespace-nowrap text-sm text-gray-700">{slot.slotType}</td>
                              <td className="px-6 py-3.5 whitespace-nowrap text-sm text-gray-700">{formatDate(slot.date)}</td>
                              <td className="px-6 py-3.5 whitespace-nowrap text-sm text-gray-700">{slot.venue || 'N/A'}</td>
                              <td className="px-6 py-3.5 whitespace-nowrap text-sm text-gray-700">{slot.timings || 'N/A'}</td>
                              <td className="px-6 py-3.5 whitespace-nowrap text-right text-sm font-medium">
                                <div className="flex space-x-4">
                                  <button onClick={() => handleMarkAttendance(slot)} className="text-mdc-700 hover:text-mdc-900 font-semibold">Mark / Override Attendance</button>
                                  <button onClick={() => handleDeleteSlot(slot)} className="text-red-600 hover:text-red-900 font-semibold">Delete</button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="mt-6 bg-white rounded-2xl shadow-sm border border-mdc-100 py-16 flex flex-col items-center justify-center gap-3">
                      <svg className="w-10 h-10 text-mdc-300" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                      </svg>
                      <p className="text-sm font-medium text-gray-500">No attendance slots found</p>
                      <p className="text-xs text-gray-400">Try adjusting your filters.</p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        );

      case 'userDashboard':
        return (
          <div className="text-mdc-900 max-w-screen-2xl mx-auto">
            {userProfile && (
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">

                {/* Left Panel - Profile Details */}
                <div className="lg:col-span-1 animate-fade-in-up bg-white rounded-3xl shadow-sm border border-mdc-100 p-6 flex flex-col items-center text-center">
                  <div className="relative group mb-4">
                    {userProfile.photo ? (
                      <img src={userProfile.photo} alt="Profile" className="w-28 h-28 rounded-full object-cover ring-4 ring-mdc-100 flex-shrink-0" />
                    ) : (
                      <div className="w-28 h-28 rounded-full bg-gradient-to-br from-mdc-300 to-mdc-500 text-white flex items-center justify-center text-4xl font-bold flex-shrink-0 shadow-inner">
                        {userProfile.username ? userProfile.username.charAt(0).toUpperCase() : '?'}
                      </div>
                    )}
                  </div>

                  <h3 className="text-xl font-bold text-mdc-900 leading-tight">{userProfile.username}</h3>

                  <span className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20">
                    {/* <span className="w-1.5 h-1.5 rounded-full bg-green-500" /> */}
                    Active Member
                  </span>

                  <div className="w-full border-t border-dashed border-mdc-100 my-5" />

                  <div className="w-full space-y-4 text-left">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Position & Domain</p>
                      <p className="text-sm font-medium text-gray-700 mt-0.5">{userProfile.position} • {userProfile.domain}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Registration Number</p>
                      <p className="text-sm font-medium text-gray-700 mt-0.5">{userProfile.regNo}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Email ID</p>
                      <p className="text-sm font-medium text-gray-700 mt-0.5 break-all">{userProfile.email}</p>
                    </div>
                    {userProfile.school && (
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">School & Stream</p>
                        <p className="text-sm font-medium text-gray-700 mt-0.5">{userProfile.school} ({userProfile.stream})</p>
                      </div>
                    )}
                    {userProfile.year && (
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Year of Study</p>
                        <p className="text-sm font-medium text-gray-700 mt-0.5">{userProfile.year}</p>
                      </div>
                    )}
                    {userProfile.contact && (
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Contact Number</p>
                        <p className="text-sm font-medium text-gray-700 mt-0.5">{userProfile.contact}</p>
                      </div>
                    )}
                    {userProfile.stay && (
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Stay Type</p>
                        <p className="text-sm font-medium text-gray-700 mt-0.5">{userProfile.stay}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Panel - Statistics & Attendance Records */}
                <div className="lg:col-span-3 space-y-6">
                  {/* Attendance Violations Alert */}
                  {(() => {
                    const v = violationsMap[userProfile.id] || { violationCount: 0, violations: [] };
                    if (v.violationCount === 0) return null;
                    return (
                      <div className="animate-fade-in-up bg-red-50 border border-red-200 rounded-3xl p-5 flex items-start gap-4 shadow-sm shadow-red-900/5">
                        <svg className="w-6 h-6 text-red-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-8.99 3.75h.008v.008h-.008v-.008z" />
                        </svg>
                        <div>
                          <p className="text-sm font-bold text-red-800">
                            {v.violationCount} Attendance Violation{v.violationCount > 1 ? 's' : ''} on record
                          </p>
                          <p className="text-xs text-red-700 mt-1 leading-relaxed">
                            You've been marked absent for 3 or more consecutive sessions. Most recent violation period: {v.violations[v.violations.length - 1].dates.join(' → ')}. Please contact your EB domain leads immediately.
                          </p>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Statistics Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                    {[
                      { label: 'Overall Attendance', type: 'all', dot: 'bg-mdc-900' },
                      { label: 'Events Attendance', type: 'event', dot: 'bg-mdc-700' },
                      { label: 'Core Team Meetings', type: 'coreteammeeting', dot: 'bg-mdc-500' },
                      { label: 'Domain Meetings', type: 'domainmeeting', dot: 'bg-mdc-300' },
                    ].map((tile, i) => (
                      <div
                        key={tile.type}
                        className={`bg-white p-5 rounded-3xl shadow-sm border border-mdc-100 text-center hover:shadow-md hover:-translate-y-0.5 transition-all animate-fade-in-up${i ? ` stagger-${i}` : ''}`}
                      >
                        <p className="flex items-center justify-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-gray-400">
                          <span className={`w-1.5 h-1.5 rounded-full ${tile.dot}`} />
                          {tile.label}
                        </p>
                        <p className="text-3xl font-extrabold tracking-tight mt-2 text-mdc-900">{getAttendancePercentage(userProfile.id, tile.type)}</p>
                        <p className="text-xs text-gray-500 mt-1 font-medium bg-mdc-50 py-1 px-2.5 rounded-full inline-block">{getAttendanceSummary(userProfile.id, tile.type)} slots</p>
                      </div>
                    ))}
                  </div>

                  {/* Attendance Records */}
                  <div className="space-y-4 bg-white rounded-3xl border border-mdc-100 p-6 shadow-sm">
                    <h3 className="text-lg font-bold tracking-tight text-mdc-900">My Attendance History</h3>

                    <div className="animate-fade-in-up relative z-20 flex flex-wrap items-center gap-3">
                      <CustomMultiSelect
                        className="w-full sm:w-48"
                        allLabel="All Slot Types"
                        value={userDashboardFilters.slotType}
                        onChange={(val) => setUserDashboardFilters({ ...userDashboardFilters, slotType: val })}
                        options={slotTypes.map(t => ({ value: normalizeSlotType(t), label: t }))}
                      />
                      <CustomMultiSelect
                        className="w-full sm:w-40"
                        allLabel="All Statuses"
                        value={userDashboardFilters.status}
                        onChange={(val) => setUserDashboardFilters({ ...userDashboardFilters, status: val })}
                        options={[
                          { value: 'present', label: 'Present' },
                          { value: 'absent', label: 'Absent' },
                        ]}
                      />
                      <CustomDateInput
                        className="w-full sm:w-40"
                        placeholder="From date"
                        value={userDashboardFilters.fromDate}
                        onChange={(val) => setUserDashboardFilters({ ...userDashboardFilters, fromDate: val })}
                      />
                      <span className="text-gray-400 hidden sm:inline">to</span>
                      <CustomDateInput
                        className="w-full sm:w-40"
                        placeholder="To date"
                        value={userDashboardFilters.toDate}
                        onChange={(val) => setUserDashboardFilters({ ...userDashboardFilters, toDate: val })}
                      />
                    </div>

                    <div className="animate-fade-in-up overflow-x-auto rounded-2xl border border-mdc-100">
                      <table className="min-w-full divide-y divide-mdc-100">
                        <thead className="bg-mdc-50">
                          <tr>
                            <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Slot Name</th>
                            <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Slot Type</th>
                            <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                            <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Venue / Room</th>
                            <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-mdc-100">
                          {userAttendanceRecords.length > 0 ? (
                            userAttendanceRecords.map(slot => (
                              <tr key={slot.id} className="hover:bg-mdc-50/50 transition-colors">
                                <td className="px-6 py-3.5 text-sm font-semibold text-gray-700">{slot.slotName}</td>
                                <td className="px-6 py-3.5 text-sm text-gray-500">{slotTypesMap[normalizeSlotType(slot.slotType)] || slot.slotType}</td>
                                <td className="px-6 py-3.5 text-sm text-gray-500">{formatDate(slot.date)}</td>
                                <td className="px-6 py-3.5 text-sm text-gray-500">{slot.venue || 'N/A'}</td>
                                <td className="px-6 py-3.5 whitespace-nowrap text-sm text-gray-700">
                                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold ${slot.isPresent
                                    ? 'bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20'
                                    : 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20'
                                    }`}>
                                    <span className={`w-1.5 h-1.5 rounded-full ${slot.isPresent ? 'bg-green-500' : 'bg-red-500'}`} />
                                    {slot.isPresent ? 'Present' : 'Absent'}
                                  </span>
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan="5" className="px-6 py-12 text-center text-sm text-gray-400 bg-white">
                                No attendance records found matching filters.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

              </div>
            )}
          </div>
        );

      case 'login':
      default:
        return (
          <div className="w-full flex items-center justify-center">
            {!isAuthReady ? (
              <div className="flex flex-col items-center gap-3 text-white">
                <svg className="animate-spin h-8 w-8" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span className="text-sm font-medium text-mdc-100">Loading…</span>
              </div>
            ) : (
              <div className="animate-fade-in-up w-full max-w-md bg-white/90 backdrop-blur-xl rounded-3xl shadow-2xl shadow-mdc-900/30 border border-white/60 p-8 space-y-6">
                <div className="text-center">
                  <h2 className="text-3xl font-extrabold tracking-tight text-mdc-900">MDC Portal</h2>
                  <p className="mt-1.5 text-sm text-gray-500 font-medium">Log in to check and mark attendance</p>
                </div>

                {message && (
                  <div className="text-center text-sm font-semibold text-red-600 bg-red-50 border border-red-200 rounded-xl p-3">
                    {message}
                  </div>
                )}

                <form onSubmit={handleCredentialsLogin} className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-mdc-900 mb-1">Roll Number (User ID)</label>
                    <input
                      type="text"
                      placeholder="Enter Roll Number"
                      value={loginRegNo}
                      onChange={(e) => setLoginRegNo(e.target.value)}
                      className="w-full p-3 rounded-xl bg-white border border-mdc-300 focus:outline-none focus:ring-2 focus:ring-mdc-500 focus:border-transparent transition-all shadow-sm text-sm"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-mdc-900 mb-1">GITAM Email (Password)</label>
                    <input
                      type="password"
                      placeholder="Enter GITAM Email Address"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      className="w-full p-3 rounded-xl bg-white border border-mdc-300 focus:outline-none focus:ring-2 focus:ring-mdc-500 focus:border-transparent transition-all shadow-sm text-sm"
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3 px-6 bg-gradient-to-r from-mdc-700 to-mdc-900 hover:from-mdc-900 hover:to-mdc-900 text-white font-bold rounded-xl shadow-lg hover:shadow-xl active:scale-[0.99] transition-all text-sm tracking-wide"
                  >
                    Log In
                  </button>
                </form>

                {process.env.NODE_ENV === 'development' && (
                  <div className="pt-4 border-t border-dashed border-mdc-300 space-y-2">
                    <p className="text-center text-xs font-bold uppercase tracking-wide text-mdc-500">Dev bypass (not shown in production)</p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleDevBypass(false)}
                        className="flex-1 py-2.5 px-3 text-xs bg-mdc-100 hover:bg-mdc-200 text-mdc-900 font-bold rounded-xl active:scale-[0.98] transition-all"
                      >
                        Member Bypass
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDevBypass(true)}
                        className="flex-1 py-2.5 px-3 text-xs bg-mdc-100 hover:bg-mdc-200 text-mdc-900 font-bold rounded-xl active:scale-[0.98] transition-all"
                      >
                        Admin Bypass
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-mdc-100">
      {view === 'login' ? (
        <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-mdc-900 via-mdc-700 to-mdc-500 animate-gradient-slow">
          {/* Ambient glow orbs - shared across the whole canvas so left/right never reads as two flat blocks */}
          <div className="pointer-events-none absolute -top-24 -left-24 w-[28rem] h-[28rem] bg-mdc-300/30 rounded-full blur-3xl animate-float-a" />
          <div className="pointer-events-none absolute top-1/3 -right-32 w-[32rem] h-[32rem] bg-mdc-500/30 rounded-full blur-3xl animate-float-b" />
          <div className="pointer-events-none absolute bottom-0 left-1/4 w-96 h-96 bg-white/10 rounded-full blur-3xl animate-float-a" />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.15)_1px,transparent_0)] bg-[length:28px_28px] opacity-40" />

          <div className="relative min-h-screen grid grid-cols-1 md:grid-cols-2">
            <div className="hidden md:flex flex-col items-center justify-center text-white p-12">
              <div className="animate-fade-in-up max-w-md">
                <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wide bg-white/10 border border-white/20 backdrop-blur-sm">
                  {/* <span className="w-1.5 h-1.5 rounded-full bg-mdc-300" /> */}
                  Meta Developer Communities
                </span>
                <h1 className="mt-6 text-4xl sm:text-5xl font-extrabold tracking-tight leading-[1.1] bg-clip-text text-transparent bg-gradient-to-br from-white to-mdc-200">
                  One home for every meeting, member, and moment.
                </h1>
                <p className="mt-5 text-mdc-100/80 text-lg leading-relaxed">
                  MDC Attendance keeps meetings, members, and turnout in sync so you can spend less time tracking and more time building.
                </p>

                <div className="relative mt-10 group">
                  <div className="absolute -inset-3 bg-gradient-to-br from-white/30 to-mdc-300/30 rounded-[2rem] blur-2xl opacity-70 transition-opacity duration-500 group-hover:opacity-100" />
                  <img
                    src="/MDCteamphoto.jpg"
                    alt="MDCteamphoto.jpg"
                    className="relative w-full h-auto rounded-2xl shadow-2xl object-cover ring-1 ring-white/30 -rotate-1 transition-transform duration-500 group-hover:rotate-0 group-hover:scale-[1.02]"
                    onError={(e) => { e.target.onerror = null; e.target.src = '/MDCteamphoto.jpg'; }}
                  />
                </div>
              </div>
            </div>
            <div className="flex items-center justify-center p-4">
              {renderContent()}
            </div>
          </div>
        </div>
      ) : (
        <div className="min-h-screen bg-gradient-to-br from-mdc-300 via-mdc-200 to-mdc-300">
          <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6">
            {renderNav()}
          </div>
          {message && (
            <div className="max-w-screen-2xl mx-auto mt-4 px-4 sm:px-6 lg:px-8">
              <div className="animate-toast-in p-3 text-center text-sm font-medium text-white bg-gradient-to-r from-mdc-500 to-mdc-700 rounded-xl shadow-md shadow-mdc-900/10">
                {message}
              </div>
            </div>
          )}
          <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-8">
            {renderContent()}
          </div>
        </div>
      )}

      {(showCreateSlot || editingSlot) && (
        <div className="fixed inset-0 bg-mdc-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-overlay-in">
          <div className="bg-white rounded-3xl shadow-2xl border border-mdc-100 animate-modal-in p-6 w-full max-w-2xl max-h-[90vh] flex flex-col">
            <h3 className="text-xl font-bold text-center mb-4">
              {editingSlot ? `Mark / Override Attendance: ${editingSlot.slotName}` : "Create & Post Attendance"}
            </h3>
            {modalMessage && (
              <div className={`text-center text-sm font-semibold mb-4 ${modalMessage.includes('successfully') ? 'text-green-600 bg-green-50 border border-green-200 rounded-xl p-2' : 'text-red-600 bg-red-50 border border-red-200 rounded-xl p-2'}`}>
                {modalMessage}
              </div>
            )}
            <form onSubmit={editingSlot ? handleEditSlot : handleCreateSlot} className="flex-grow overflow-y-auto pr-2 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Meeting / Slot Type <span className="text-red-500">*</span></label>
                  <CustomSelect
                    value={editingSlot ? editingSlot.slotType : newSlotForm.slotType}
                    onChange={(val) => {
                      if (editingSlot) {
                        setEditingSlot({ ...editingSlot, slotType: val });
                      } else {
                        setNewSlotForm({ ...newSlotForm, slotType: val });
                      }
                    }}
                    options={[
                      { value: 'Event', label: 'EVENT' },
                      { value: 'Domain Meeting', label: 'DOMAIN MEET' },
                      { value: 'Core Team Meeting', label: 'CORE TEAM MEET' }
                    ]}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Name <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    placeholder="Event or Meet Name"
                    value={editingSlot ? editingSlot.slotName : newSlotForm.slotName}
                    onChange={(e) => {
                      if (editingSlot) {
                        setEditingSlot({ ...editingSlot, slotName: e.target.value });
                      } else {
                        setNewSlotForm({ ...newSlotForm, slotName: e.target.value });
                      }
                    }}
                    className="w-full p-3 rounded-xl bg-white border border-mdc-300 focus:outline-none focus:ring-2 focus:ring-mdc-500 focus:border-transparent transition-colors text-sm shadow-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Date <span className="text-red-500">*</span></label>
                  <input
                    type="date"
                    value={editingSlot ? editingSlot.date : newSlotForm.date}
                    onChange={(e) => {
                      if (editingSlot) {
                        setEditingSlot({ ...editingSlot, date: e.target.value });
                      } else {
                        setNewSlotForm({ ...newSlotForm, date: e.target.value });
                      }
                    }}
                    className="w-full p-3 rounded-xl bg-white border border-mdc-300 focus:outline-none focus:ring-2 focus:ring-mdc-500 focus:border-transparent transition-colors text-sm shadow-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Room Number / Venue <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    placeholder="e.g. Room 204 or Auditorium"
                    value={editingSlot ? editingSlot.venue : newSlotForm.venue}
                    onChange={(e) => {
                      if (editingSlot) {
                        setEditingSlot({ ...editingSlot, venue: e.target.value });
                      } else {
                        setNewSlotForm({ ...newSlotForm, venue: e.target.value });
                      }
                    }}
                    className="w-full p-3 rounded-xl bg-white border border-mdc-300 focus:outline-none focus:ring-2 focus:ring-mdc-500 focus:border-transparent transition-colors text-sm shadow-sm"
                    required
                  />
                </div>
              </div>

              {/* Domain Selection */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  {(editingSlot ? editingSlot.slotType : newSlotForm.slotType) === 'Domain Meeting'
                    ? 'Select Domain'
                    : 'Participating Domains'
                  }
                </label>
                {(editingSlot ? editingSlot.slotType : newSlotForm.slotType) === 'Domain Meeting' ? (
                  <CustomSelect
                    value={selectedDomains[0] || ''}
                    onChange={(val) => setSelectedDomains(val ? [val] : [])}
                    options={[
                      { value: '', label: 'Select Domain' },
                      ...domains.map(d => ({ value: d, label: d }))
                    ]}
                  />
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-mdc-50 p-3 rounded-2xl border border-mdc-100">
                    {domains.map(d => (
                      <label key={d} className="inline-flex items-center space-x-2 cursor-pointer p-1">
                        <input
                          type="checkbox"
                          checked={selectedDomains.includes(d)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedDomains(prev => [...prev, d]);
                            } else {
                              setSelectedDomains(prev => prev.filter(item => item !== d));
                            }
                          }}
                          className="h-4 w-4 text-mdc-700 border-mdc-300 rounded"
                        />
                        <span className="text-sm text-gray-700 font-medium">{d}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {/* Attendance Table */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <h4 className="text-sm font-bold text-mdc-900">Mark Attendance for Selected Members</h4>
                  <div className="flex space-x-2 text-xs font-semibold">
                    <button
                      type="button"
                      onClick={() => setSlotAttendance(prev => prev.map(u => ({ ...u, isPresent: true })))}
                      className="text-green-600 hover:text-green-700"
                    >
                      All Present
                    </button>
                    <span className="text-gray-300">|</span>
                    <button
                      type="button"
                      onClick={() => setSlotAttendance(prev => prev.map(u => ({ ...u, isPresent: false })))}
                      className="text-red-600 hover:text-red-700"
                    >
                      All Absent
                    </button>
                    {editingSlot && (
                      <>
                        <span className="text-gray-300">|</span>
                        <button
                          type="button"
                          onClick={handleExportAttendance}
                          className="text-mdc-700 hover:text-mdc-900"
                        >
                          Export
                        </button>
                        <span className="text-gray-300">|</span>
                        <label className="text-mdc-700 hover:text-mdc-900 cursor-pointer">
                          Import
                          <input
                            type="file"
                            accept=".csv"
                            onChange={handleImportCSV}
                            className="hidden"
                          />
                        </label>
                      </>
                    )}
                  </div>
                </div>

                <div className="max-h-60 overflow-y-auto border border-mdc-200 rounded-2xl divide-y divide-mdc-100 bg-white">
                  {slotAttendance.length > 0 ? (
                    slotAttendance.map(user => (
                      <div key={user.id} className="flex items-center justify-between p-3 hover:bg-mdc-50/50 transition-colors">
                        <div className="flex flex-col">
                          <span className="text-sm font-semibold text-gray-800">{user.username}</span>
                          <span className="text-xs text-gray-500 font-medium">{user.domain} • {user.position}</span>
                        </div>
                        <div className="flex items-center space-x-4">
                          <label className="inline-flex items-center space-x-1.5 cursor-pointer">
                            <input
                              type="radio"
                              name={`modal-status-${user.id}`}
                              checked={user.isPresent}
                              onChange={() => setSlotAttendance(prev => prev.map(u => u.id === user.id ? { ...u, isPresent: true } : u))}
                              className="custom-radio custom-radio-green"
                            />
                            <span className="text-xs font-bold text-gray-600">Present</span>
                          </label>
                          <label className="inline-flex items-center space-x-1.5 cursor-pointer">
                            <input
                              type="radio"
                              name={`modal-status-${user.id}`}
                              checked={!user.isPresent}
                              onChange={() => setSlotAttendance(prev => prev.map(u => u.id === user.id ? { ...u, isPresent: false } : u))}
                              className="custom-radio custom-radio-red"
                            />
                            <span className="text-xs font-bold text-gray-600">Absent</span>
                          </label>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-8 text-center text-sm font-medium text-gray-400 bg-gray-50">
                      No members selected. Please choose participating domains above.
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t border-mdc-100">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateSlot(false);
                    setEditingSlot(null);
                    setSelectedDomains([]);
                    setSlotAttendance([]);
                    setModalMessage('');
                  }}
                  className="py-2.5 px-5 bg-mdc-100 hover:bg-mdc-200 text-mdc-900 font-bold rounded-xl active:scale-[0.98] transition-all text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="py-2.5 px-6 bg-gradient-to-r from-mdc-700 to-mdc-900 hover:from-mdc-900 hover:to-mdc-900 text-white font-bold rounded-xl shadow-md hover:shadow-lg active:scale-[0.98] transition-all text-sm"
                >
                  {editingSlot ? 'Save Overrides' : 'Post Attendance'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}



      {editingUser && (
        <div className="fixed inset-0 bg-mdc-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-overlay-in">
          <div className="bg-white rounded-3xl shadow-2xl shadow-mdc-900/10 border border-mdc-100 animate-modal-in p-6 w-full max-w-md">
            <h3 className="text-xl font-bold text-center mb-4">Edit User: {editingUser.username}</h3>
            {modalMessage && (
              <div className={`text-center text-sm font-medium mb-4 ${modalMessage.includes('successfully') ? 'text-green-500' : 'text-red-500'}`}>
                {modalMessage}
              </div>
            )}
            <form onSubmit={handleSaveEdit} className="space-y-4">
              <input type="text" placeholder="Full Name" value={editingUser.username || ''} onChange={(e) => setEditingUser({ ...editingUser, username: e.target.value })} className="w-full p-3 rounded-lg bg-white border border-mdc-300 focus:outline-none focus:ring-2 focus:ring-mdc-500 focus:border-transparent transition-colors" />
              <input type="email" placeholder="Email" value={editingUser.email || ''} onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })} className="w-full p-3 rounded-lg bg-white border border-mdc-300 focus:outline-none focus:ring-2 focus:ring-mdc-500 focus:border-transparent transition-colors" />
              <input type="tel" placeholder="Contact Number" value={editingUser.contact || ''} onChange={(e) => setEditingUser({ ...editingUser, contact: e.target.value })} className="w-full p-3 rounded-lg bg-white border border-mdc-300 focus:outline-none focus:ring-2 focus:ring-mdc-500 focus:border-transparent transition-colors" />
              <CustomSelect
                value={editingUser.year || ''}
                onChange={(val) => setEditingUser({ ...editingUser, year: val })}
                options={[{ value: '', label: 'Year of Study' }, ...years.map(y => ({ value: y, label: y }))]}
              />
              <input type="text" placeholder="Registration Number" value={editingUser.regNo || ''} onChange={(e) => setEditingUser({ ...editingUser, regNo: e.target.value })} className="w-full p-3 rounded-lg bg-white border border-mdc-300 focus:outline-none focus:ring-2 focus:ring-mdc-500 focus:border-transparent transition-colors" />
              <input type="text" placeholder="Program" value={editingUser.program || ''} onChange={(e) => setEditingUser({ ...editingUser, program: e.target.value })} className="w-full p-3 rounded-lg bg-white border border-mdc-300 focus:outline-none focus:ring-2 focus:ring-mdc-500 focus:border-transparent transition-colors" />
              <CustomSelect
                value={editingUser.domain || ''}
                onChange={(val) => setEditingUser({ ...editingUser, domain: val })}
                options={[{ value: '', label: 'Select Domain' }, ...domains.map(d => ({ value: d, label: d }))]}
              />
              <CustomSelect
                value={editingUser.position || ''}
                onChange={(val) => setEditingUser({ ...editingUser, position: val })}
                options={[{ value: '', label: 'Select Position' }, ...positions.map(p => ({ value: p, label: p }))]}
              />
              <div className="flex justify-end space-x-4 mt-4">
                <button type="button" onClick={() => setEditingUser(null)} className="py-2 px-4 bg-mdc-200 hover:bg-mdc-300 text-mdc-900 font-semibold rounded-full active:scale-[0.98] transition-all">Cancel</button>
                <button type="submit" className="py-2 px-4 bg-gradient-to-r from-mdc-500 to-mdc-700 hover:from-mdc-700 hover:to-mdc-900 text-white font-semibold rounded-full shadow-md shadow-mdc-900/20 hover:shadow-lg active:scale-[0.98] transition-all">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {newUser && (
        <div className="fixed inset-0 bg-mdc-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-overlay-in">
          <div className="bg-white rounded-3xl shadow-2xl shadow-mdc-900/10 border border-mdc-100 animate-modal-in p-6 w-full max-w-md">
            <h3 className="text-xl font-bold text-center mb-4">Add New Member</h3>
            {modalMessage && (
              <div className={`text-center text-sm font-medium mb-4 ${modalMessage.includes('successfully') ? 'text-green-500' : 'text-red-500'}`}>
                {modalMessage}
              </div>
            )}
            <form onSubmit={handleCreateUser} className="space-y-4">
              <input type="text" placeholder="Full Name" value={newUser.username || ''} onChange={(e) => setNewUser({ ...newUser, username: e.target.value })} className="w-full p-3 rounded-lg bg-white border border-mdc-300 focus:outline-none focus:ring-2 focus:ring-mdc-500 focus:border-transparent transition-colors" required />
              <input type="email" placeholder="GITAM Email (Password)" value={newUser.email || ''} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} className="w-full p-3 rounded-lg bg-white border border-mdc-300 focus:outline-none focus:ring-2 focus:ring-mdc-500 focus:border-transparent transition-colors" required />
              <input type="tel" placeholder="Contact Number" value={newUser.contact || ''} onChange={(e) => setNewUser({ ...newUser, contact: e.target.value })} className="w-full p-3 rounded-lg bg-white border border-mdc-300 focus:outline-none focus:ring-2 focus:ring-mdc-500 focus:border-transparent transition-colors" />
              <CustomSelect
                value={newUser.year || ''}
                onChange={(val) => setNewUser({ ...newUser, year: val })}
                options={[{ value: '', label: 'Year of Study' }, ...years.map(y => ({ value: y, label: y }))]}
              />
              <input type="text" placeholder="Roll Number (User ID)" value={newUser.regNo || ''} onChange={(e) => setNewUser({ ...newUser, regNo: e.target.value })} className="w-full p-3 rounded-lg bg-white border border-mdc-300 focus:outline-none focus:ring-2 focus:ring-mdc-500 focus:border-transparent transition-colors" required />
              <input type="text" placeholder="Program" value={newUser.program || ''} onChange={(e) => setNewUser({ ...newUser, program: e.target.value })} className="w-full p-3 rounded-lg bg-white border border-mdc-300 focus:outline-none focus:ring-2 focus:ring-mdc-500 focus:border-transparent transition-colors" />
              <CustomSelect
                value={newUser.domain || ''}
                onChange={(val) => setNewUser({ ...newUser, domain: val })}
                options={[{ value: '', label: 'Select Domain' }, ...domains.map(d => ({ value: d, label: d }))]}
              />
              <CustomSelect
                value={newUser.position || ''}
                onChange={(val) => setNewUser({ ...newUser, position: val })}
                options={[{ value: '', label: 'Select Position' }, ...positions.map(p => ({ value: p, label: p }))]}
              />
              <div className="flex justify-end space-x-4 mt-4">
                <button type="button" onClick={() => { setNewUser(null); setModalMessage(''); }} className="py-2 px-4 bg-mdc-200 hover:bg-mdc-300 text-mdc-900 font-semibold rounded-full active:scale-[0.98] transition-all">Cancel</button>
                <button type="submit" className="py-2 px-4 bg-gradient-to-r from-mdc-500 to-mdc-700 hover:from-mdc-700 hover:to-mdc-900 text-white font-semibold rounded-full shadow-md shadow-mdc-900/20 hover:shadow-lg active:scale-[0.98] transition-all">Add Member</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deletingUser && (
        <div className="fixed inset-0 bg-mdc-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-overlay-in">
          <div className="bg-white rounded-3xl shadow-2xl shadow-mdc-900/10 border border-mdc-100 animate-modal-in p-6 w-full max-w-sm text-center">
            <h3 className="text-xl font-bold mb-4">Confirm Deletion</h3>
            <p className="mb-4">Are you sure you want to delete user "{deletingUser.username}"? This action cannot be undone.</p>
            <div className="flex justify-center space-x-4">
              <button onClick={() => setDeletingUser(null)} className="py-2 px-4 bg-mdc-200 hover:bg-mdc-300 text-mdc-900 font-semibold rounded-full active:scale-[0.98] transition-all">Cancel</button>
              <button onClick={confirmDelete} className="py-2 px-4 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-full shadow-lg transition-colors">Delete</button>
            </div>
          </div>
        </div>
      )}

      {deletingSlot && (
        <div className="fixed inset-0 bg-mdc-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-overlay-in">
          <div className="bg-white rounded-3xl shadow-2xl shadow-mdc-900/10 border border-mdc-100 animate-modal-in p-6 w-full max-w-sm text-center">
            <h3 className="text-xl font-bold mb-4">Confirm Deletion</h3>
            <p className="mb-4">Are you sure you want to delete the slot "{deletingSlot.slotName}"? This action cannot be undone.</p>
            <div className="flex justify-center space-x-4">
              <button onClick={() => setDeletingSlot(null)} className="py-2 px-4 bg-mdc-200 hover:bg-mdc-300 text-mdc-900 font-semibold rounded-full active:scale-[0.98] transition-all">Cancel</button>
              <button onClick={confirmDeleteSlot} className="py-2 px-4 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-full shadow-lg transition-colors">Delete</button>
            </div>
          </div>
        </div>
      )}

      {showMemberAttendanceDetails && selectedMember && (
        <div className="fixed inset-0 bg-mdc-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-overlay-in">
          <div className="bg-white rounded-3xl shadow-2xl shadow-mdc-900/10 border border-mdc-100 animate-modal-in p-6 w-full max-w-3xl max-h-screen overflow-y-auto space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-bold">
                {selectedMember.username}'s Attendance Details
              </h3>
              <div className="flex items-center space-x-2">
                <button onClick={() => handleDownloadMemberAttendance(selectedMember)} className="py-1 px-3 bg-mdc-100 hover:bg-mdc-200 text-mdc-900 rounded-md text-sm border border-mdc-300">
                  Download CSV
                </button>
                <button onClick={() => setShowMemberAttendanceDetails(false)} className="text-gray-500 hover:text-gray-700">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { label: 'Events Attended', type: 'event', dot: 'bg-mdc-700' },
                { label: 'Core Team Meetings', type: 'coreteammeeting', dot: 'bg-mdc-500' },
                { label: 'Domain Meetings', type: 'domainmeeting', dot: 'bg-mdc-300' },
              ].map((tile, i) => (
                <div
                  key={tile.type}
                  className={`bg-white p-4 rounded-2xl shadow-sm border border-mdc-100 text-center text-mdc-900 hover:shadow-md hover:-translate-y-0.5 transition-all animate-fade-in-up${i ? ` stagger-${i}` : ''}`}
                >
                  <p className="flex items-center justify-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
                    <span className={`w-1.5 h-1.5 rounded-full ${tile.dot}`} />
                    {tile.label}
                  </p>
                  <p className="text-3xl font-bold tracking-tight mt-1">{getAttendanceSummary(selectedMember.id, tile.type)}</p>
                </div>
              ))}
            </div>

            <div className="flex space-x-4 mt-4">
              <CustomMultiSelect
                className="w-full"
                allLabel="All Months"
                value={dashboardFilterMonth}
                onChange={(val) => setDashboardFilterMonth(val)}
                options={Array.from({ length: 12 }, (_, i) => ({ value: String(i), label: new Date(0, i).toLocaleString('default', { month: 'long' }) }))}
              />
              <CustomMultiSelect
                className="w-full"
                allLabel="All Years"
                value={dashboardFilterYear}
                onChange={(val) => setDashboardFilterYear(val)}
                options={Array.from(new Set(attendanceSlots.map(s => new Date(s.date).getFullYear()))).map(y => ({ value: String(y), label: String(y) }))}
              />
            </div>

            <div className="overflow-x-auto max-h-64">
              <table className="min-w-full bg-white rounded-xl overflow-hidden">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="py-3 px-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Slot Name</th>
                    <th className="py-3 px-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                    <th className="py-3 px-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {memberAttendanceDetails.map(slot => (
                    <tr key={slot.id}>
                      <td className="px-6 py-3.5 whitespace-nowrap text-sm text-gray-700">{slot.slotName}</td>
                      <td className="px-6 py-3.5 whitespace-nowrap text-sm text-gray-700">{formatDate(slot.date)}</td>
                      <td className="px-6 py-3.5 whitespace-nowrap text-sm text-gray-700">
                        {isAdmin ? (
                          <div className="flex items-center space-x-3">
                            <label className="inline-flex items-center space-x-1 cursor-pointer">
                              <input
                                type="radio"
                                name={`details-status-${slot.id}`}
                                checked={slot.isPresent}
                                onChange={() => handleOverrideUserAttendance(selectedMember.id, slot.id, true)}
                                className="custom-radio custom-radio-green w-3.5 h-3.5"
                              />
                              <span className="text-xs font-semibold text-gray-600">Present</span>
                            </label>
                            <label className="inline-flex items-center space-x-1 cursor-pointer">
                              <input
                                type="radio"
                                name={`details-status-${slot.id}`}
                                checked={!slot.isPresent}
                                onChange={() => handleOverrideUserAttendance(selectedMember.id, slot.id, false)}
                                className="custom-radio custom-radio-red w-3.5 h-3.5"
                              />
                              <span className="text-xs font-semibold text-gray-600">Absent</span>
                            </label>
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-50 text-gray-700 ring-1 ring-inset ring-gray-200">
                            <span className={`w-1.5 h-1.5 rounded-full ${slot.isPresent ? 'bg-green-500' : 'bg-red-500'}`} />
                            {slot.isPresent ? 'Present' : 'Absent'}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

          </div>
        </div>
      )}

      {showViolationModal && violationModalMember && (
        <div className="fixed inset-0 bg-mdc-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-overlay-in">
          <div className="bg-white rounded-3xl shadow-2xl shadow-mdc-900/10 border border-mdc-100 animate-modal-in p-6 w-full max-w-3xl max-h-screen overflow-y-auto space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-bold">
                {violationModalMember.username}'s Violation Details
              </h3>
              <button onClick={() => { setShowViolationModal(false); setViolationModalMember(null); }} className="text-gray-500 hover:text-gray-700">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-2">
              {(() => {
                const v = violationsMap[violationModalMember.id] || { violationCount: 0, violations: [] };
                if (v.violationCount === 0) return <p className="text-gray-600">No violations found for this member.</p>;
                return (
                  <div className="space-y-3">
                    <p className="text-sm text-gray-600">Total violations: <span className="font-semibold text-red-600">{v.violationCount}</span></p>
                    <div className="space-y-2">
                      {v.violations.map((grp, idx) => (
                        <div key={idx} className="p-3 border rounded-lg bg-red-50">
                          <p className="text-sm font-semibold">Violation #{idx + 1}</p>
                          <p className="text-sm">Slots: {grp.slotNames.join(' • ')}</p>
                          <p className="text-sm text-gray-600">Dates: {grp.dates.join(' → ')}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {showEditProfileModal && userProfile && (
        <div className="fixed inset-0 bg-mdc-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-overlay-in">
          <div className="bg-white rounded-3xl shadow-2xl shadow-mdc-900/10 border border-mdc-100 animate-modal-in p-6 w-full max-w-md max-h-screen overflow-y-auto">
            <div className="text-center mb-5">
              <h3 className="text-xl font-bold tracking-tight text-mdc-900">Edit Your Profile</h3>
              <p className="mt-1 text-sm text-gray-500">Keep your details up to date for accurate attendance tracking.</p>
            </div>
            {modalMessage && (
              <div className={`text-center text-sm font-medium mb-4 ${modalMessage.includes('successfully') ? 'text-green-500' : 'text-red-500'}`}>
                {modalMessage}
              </div>
            )}
            <form onSubmit={handleEditProfile} className="space-y-4">
              <div className="flex justify-center mb-4">
                {userProfile.photo ? (
                  <img src={userProfile.photo} alt="Profile" className="w-24 h-24 rounded-full object-cover" />
                ) : (
                  <div className="w-24 h-24 rounded-full bg-mdc-300 text-mdc-900 flex items-center justify-center text-4xl font-bold">{userProfile.username.charAt(0).toUpperCase()}</div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Full Name</label>
                <input type="text" value={userProfile.username || ''} onChange={(e) => setUserProfile({ ...userProfile, username: e.target.value })} className="w-full p-3 rounded-lg bg-white border border-mdc-300 focus:outline-none focus:ring-2 focus:ring-mdc-500 focus:border-transparent transition-colors" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
                <input type="email" value={userProfile.email || ''} onChange={(e) => setUserProfile({ ...userProfile, email: e.target.value })} className="w-full p-3 rounded-lg bg-white border border-mdc-300 focus:outline-none focus:ring-2 focus:ring-mdc-500 focus:border-transparent transition-colors" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Contact Number</label>
                <input type="tel" value={userProfile.contact || ''} onChange={(e) => setUserProfile({ ...userProfile, contact: e.target.value })} className="w-full p-3 rounded-lg bg-white border border-mdc-300 focus:outline-none focus:ring-2 focus:ring-mdc-500 focus:border-transparent transition-colors" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Year of Study</label>
                <CustomSelect
                  value={userProfile.year || ''}
                  onChange={(val) => setUserProfile({ ...userProfile, year: val })}
                  options={years.map(y => ({ value: y, label: y }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Registration Number</label>
                <input type="text" value={userProfile.regNo || ''} onChange={(e) => setUserProfile({ ...userProfile, regNo: e.target.value })} className="w-full p-3 rounded-lg bg-white border border-mdc-300 focus:outline-none focus:ring-2 focus:ring-mdc-500 focus:border-transparent transition-colors" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Program</label>
                <input type="text" placeholder="Enter your program" value={userProfile.program} onChange={(e) => setUserProfile({ ...userProfile, program: e.target.value })} className="w-full p-3 rounded-lg bg-white border border-mdc-300 focus:outline-none focus:ring-2 focus:ring-mdc-500 focus:border-transparent transition-colors" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Domain</label>
                <CustomSelect
                  value={userProfile.domain || ''}
                  onChange={(val) => setUserProfile({ ...userProfile, domain: val })}
                  options={domains.map(d => ({ value: d, label: d }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Position</label>
                <CustomSelect
                  value={userProfile.position || ''}
                  onChange={(val) => setUserProfile({ ...userProfile, position: val })}
                  options={positions.map(p => ({ value: p, label: p }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Change Photo</label>
                <input type="file" onChange={handlePhotoUpload} className="mt-1 block w-full text-gray-900 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-mdc-100 file:text-mdc-900 hover:file:bg-mdc-200" />
              </div>
              <div className="flex justify-end space-x-4 mt-4">
                <button type="button" onClick={() => setShowEditProfileModal(false)} className="py-2 px-4 bg-mdc-200 hover:bg-mdc-300 text-mdc-900 font-semibold rounded-full active:scale-[0.98] transition-all">Cancel</button>
                <button type="submit" className="py-2 px-4 bg-gradient-to-r from-mdc-500 to-mdc-700 hover:from-mdc-700 hover:to-mdc-900 text-white font-semibold rounded-full shadow-md shadow-mdc-900/20 hover:shadow-lg active:scale-[0.98] transition-all">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default App;

