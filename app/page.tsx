"use client";

import { useState } from "react";

interface RawEvent {
  "שם / שמות": string;
  "יום בחודש (מספר)"?: string;
  "יום בחודש (אותיות)"?: string;
  "חודש לועזי"?: string;
  "חודש עברי"?: string;
  "סוג האירוע": string;
}

interface ProcessedCircle {
  id: string;
  name: string;
  date: string;
  type: "birthday" | "anniversary";
  color: string;
  requiresCheck: boolean;
}

const GREGORIAN_MONTHS = [
  "ינואר",
  "פברואר",
  "מרץ",
  "אפריל",
  "מאי",
  "יוני",
  "יולי",
  "אוגוסט",
  "ספטמבר",
  "אוקטובר",
  "נובמבר",
  "דצמבר",
];
const HEBREW_MONTHS = [
  "תשרי",
  "חשוון",
  "כסלו",
  "טבת",
  "שבט",
  "אדר",
  "ניסן",
  "אייר",
  "סיון",
  "תמוז",
  "אב",
  "אלול",
];

const AVAILABLE_FONTS = [
  { name: "עוזרי (ברירת מחדל)", value: "system-ui, sans-serif" },
  { name: "אלף (Alef)", value: '"Alef", sans-serif' },
  { name: "היבו (Heebo)", value: '"Heebo", sans-serif' },
  { name: "רוביק (Rubik)", value: '"Rubik", sans-serif' },
  {
    name: "נוטו סנס (Noto Sans Hebrew)",
    value: '"Noto Sans Hebrew", sans-serif',
  },
];

function hebrewToNumber(str: string): number {
  const cleanStr = str.replace(/["']/g, "").trim();
  const gimatriaMap: Record<string, number> = {
    'א': 1, 'ב': 2, 'ג': 3, 'ד': 4, 'ה': 5, 'ו': 6, 'ז': 7, 'ח': 8, 'ט': 9,
    'י': 10, 'כ': 20, 'ל': 30, 'מ': 40, 'נ': 50, 'ס': 60, 'ע': 70, 'פ': 80, 'צ': 90,
    'ק': 100, 'ר': 200, 'ש': 300, 'ת': 400
  };
  
  if (cleanStr === "טו") return 15;
  if (cleanStr === "טז") return 16;
  
  let sum = 0;
  for (let i = 0; i < cleanStr.length; i++) {
    const char = cleanStr[i];
    if (gimatriaMap[char]) sum += gimatriaMap[char];
  }
  return sum > 0 ? sum : 99;
}

export default function CalendarBuilder() {
  const [sheetUrl, setSheetUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [calendarType, setCalendarType] = useState<"gregorian" | "hebrew">(
    "gregorian",
  );
  const [rawData, setRawData] = useState<RawEvent[]>([]);
  const [processedCalendar, setProcessedCalendar] = useState<
    Record<string, ProcessedCircle[]>
  >({});

  const [birthdayColors, setBirthdayColors] = useState<string[]>([
    "#FFFFFF",
    "#ADD8E6",
    "#FFD700",
    "#98FB98", 
  ]); 
  const [useFourthColor, setUseFourthColor] = useState<boolean>(false);

  const [anniversaryColor, setAnniversaryColor] = useState<string>("#FFC0CB"); 
  const [selectedFont, setSelectedFont] = useState<string>(
    "system-ui, sans-serif",
  );

  const [showModal, setShowModal] = useState(false);
  const [tableDataString, setTableDataString] = useState("");

  const [circleSize, setCircleSize] = useState<number>(96);

  const processData = (
    dataToProcess: RawEvent[],
    type: "gregorian" | "hebrew",
    currentColors: string[],
    currentAnniversaryColor: string,
    enableFourth: boolean
  ) => {
    const monthsList = type === "gregorian" ? GREGORIAN_MONTHS : HEBREW_MONTHS;
    const sortedCalendar: Record<string, ProcessedCircle[]> = {};

    monthsList.forEach((m) => (sortedCalendar[m] = []));

    // 1. מיון ואיסוף ראשוני לחודשים
    dataToProcess.forEach((row, rowIndex) => {
      const name = row["שם / שמות"];
      const date =
        type === "gregorian"
          ? row["יום בחודש (מספר)"]
          : row["יום בחודש (אותיות)"];
      const month = type === "gregorian" ? row["חודש לועזי"] : row["חודש עברי"];
      const isAnniversary = row["סוג האירוע"] === "יום נישואין";

      if (!name || !date || !month || !sortedCalendar[month]) return;

      sortedCalendar[month].push({
        id: `${month}-${rowIndex}`,
        name: name,
        date: date,
        type: isAnniversary ? "anniversary" : "birthday",
        color: "", 
        requiresCheck: name.length > 10,
      });
    });

    // 2. מיון פנימי של כל חודש לפי ימים
    monthsList.forEach((month) => {
      sortedCalendar[month].sort((a, b) => {
        const numA = type === "gregorian" ? parseInt(a.date, 10) : hebrewToNumber(a.date);
        const numB = type === "gregorian" ? parseInt(b.date, 10) : hebrewToNumber(b.date);
        return numA - numB;
      });
    });

    const activeBirthdayColors = enableFourth ? currentColors : currentColors.slice(0, 3);

    // 3. אלגוריתם צבעים משודרג
    monthsList.forEach((month, monthIdx) => {
      const currentMonthEvents = sortedCalendar[month];

      currentMonthEvents.forEach((event, idx) => {
        if (event.type === "anniversary") {
          event.color = currentAnniversaryColor;
          return;
        }

        const sameMonthPrevColor = idx > 0 ? currentMonthEvents[idx - 1].color : null;

        let neighborMonthPrevColor: string | null = null;
        if (monthIdx > 0) {
          const prevMonthName = monthsList[monthIdx - 1];
          const prevMonthEvents = sortedCalendar[prevMonthName];
          
          if (prevMonthEvents && prevMonthEvents.length > 0) {
            const targetIdx = Math.min(idx, prevMonthEvents.length - 1);
            neighborMonthPrevColor = prevMonthEvents[targetIdx].color;
          }
        }

        const allowedColors = activeBirthdayColors.filter(
          (c) => c !== sameMonthPrevColor && c !== neighborMonthPrevColor
        );

        const finalOptions = allowedColors.length > 0 ? allowedColors : activeBirthdayColors;
        event.color = finalOptions[Math.floor(Math.random() * finalOptions.length)];
      });
    });

    setProcessedCalendar(sortedCalendar);
  };

  const handleFetchData = async () => {
    if (!sheetUrl) return alert("נא להזין קישור");
    setLoading(true);
    setProcessedCalendar({});

    try {
      const res = await fetch("/api/fetch-sheets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sheetUrl }),
      });
      const result = await res.json();

      if (result.error) {
        alert(result.error);
      } else {
        const selectedData =
          calendarType === "gregorian" ? result.gregorian : result.hebrew;
        setRawData(selectedData);
        processData(
          selectedData,
          calendarType,
          birthdayColors,
          anniversaryColor,
          useFourthColor
        );
      }
    } catch (err) {
      alert("שגיאה בתקשורת עם השרת");
    } finally {
      setLoading(false);
    }
  };

  const handleBirthdayColorChange = (index: number, newColor: string) => {
    const updatedColors = [...birthdayColors];
    updatedColors[index] = newColor;
    setBirthdayColors(updatedColors);

    if (rawData.length > 0) {
      processData(rawData, calendarType, updatedColors, anniversaryColor, useFourthColor);
    }
  };

  const handleAnniversaryColorChange = (newColor: string) => {
    setAnniversaryColor(newColor);
    if (rawData.length > 0) {
      processData(rawData, calendarType, birthdayColors, newColor, useFourthColor);
    }
  };

  const handleToggleFourthColor = (checked: boolean) => {
    setUseFourthColor(checked);
    if (rawData.length > 0) {
      processData(rawData, calendarType, birthdayColors, anniversaryColor, checked);
    }
  };

  const handleSingleCircleColorChange = (month: string, id: string) => {
    const updated = { ...processedCalendar };
    const circle = updated[month].find((c) => c.id === id);
    if (!circle || circle.type === "anniversary") return;

    const activeColors = useFourthColor ? birthdayColors : birthdayColors.slice(0, 3);
    const currentColorIndex = activeColors.indexOf(circle.color);
    const nextColorIndex = (currentColorIndex + 1) % activeColors.length;
    circle.color = activeColors[nextColorIndex];
    setProcessedCalendar(updated);
  };

  const handlePrepareDataForCanva = () => {
    const rows: string[] = [];
    
    Object.keys(processedCalendar).forEach((month) => {
      processedCalendar[month].forEach((event) => {
        rows.push(`${event.name}\t${event.date}\t${event.color}`);
      });
    });

    if (rows.length === 0) return alert("אין נתונים לייצוא");

    setTableDataString(rows.join("\n"));
    setShowModal(true);
  };

  const handleCopyToClipboard = () => {
    navigator.clipboard.writeText(tableDataString);
    alert("הנתונים הועתקו! כעת עבור לקנבה ובצע הדבקה");
  };

  const handleSizeIn = () => {
    setCircleSize((prev) => Math.min(prev + 8, 96)); 
  };

  const handleSizeOut = () => {
    setCircleSize((prev) => Math.max(prev - 8, 64)); 
  };

  const activeMonths =
    calendarType === "gregorian" ? GREGORIAN_MONTHS : HEBREW_MONTHS;

  return (
    // ✨ עדכון: שינוי ל-max-w-full כדי שהמיכל ינצל 100% מרוחב המסך הזמין שלך בדפדפן
    <div
      className="p-4 max-w-full mx-auto text-right"
      style={{ direction: "rtl", fontFamily: selectedFont }}
    >
      <h1 className="text-3xl font-bold mb-6 text-slate-800 px-4">
        מחולל לוח תאריכים משפחתי
      </h1>

      <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 mb-6 flex flex-wrap gap-4 items-end mx-4">
        <div className="flex-1 min-w-[300px]">
          <label className="block text-sm font-semibold mb-2 text-slate-700">
            קישור ל-Google Sheet (צפייה פתוחה):
          </label>
          <input
            type="text"
            className="w-full p-2.5 border border-slate-300 rounded-lg text-left"
            placeholder="https://docs.google.com/spreadsheets/d/..."
            value={sheetUrl}
            onChange={(e) => setSheetUrl(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm font-semibold mb-2 text-slate-700">
            סוג לוח שנה:
          </label>
          <select
            className="p-2.5 border border-slate-300 rounded-lg bg-white"
            value={calendarType}
            onChange={(e) => {
              setCalendarType(e.target.value as any);
              setProcessedCalendar({});
              setRawData([]);
            }}
          >
            <option value="gregorian">לוח שנה לועזי</option>
            <option value="hebrew">לוח שנה עברי</option>
          </select>
        </div>

        <button
          onClick={handleFetchData}
          disabled={loading}
          className="bg-indigo-600 text-white font-semibold py-2.5 px-6 rounded-lg hover:bg-indigo-700 disabled:bg-slate-400 transition"
        >
          {loading ? "טוען נתונים..." : "טען מהגיליון"}
        </button>
      </div>

      {rawData.length > 0 && (
        <div className="bg-white p-6 rounded-xl border border-indigo-100 shadow-sm mb-8 grid grid-cols-1 md:grid-cols-2 gap-6 items-center mx-4">
          <div className="flex flex-wrap gap-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <label className="block text-xs font-bold text-slate-500">
                  צבעי ימי הולדת:
                </label>
                <label className="flex items-center gap-1.5 text-xs text-indigo-600 font-semibold cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={useFourthColor}
                    onChange={(e) => handleToggleFourthColor(e.target.checked)}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5"
                  />
                  אפשר צבע רביעי 🎨
                </label>
              </div>
              <div className="flex gap-2">
                {birthdayColors.map((color, idx) => {
                  if (idx === 3 && !useFourthColor) return null;
                  return (
                    <div key={idx} className="flex flex-col items-center gap-1">
                      <input
                        type="color"
                        value={color}
                        onChange={(e) =>
                          handleBirthdayColorChange(idx, e.target.value)
                        }
                        className="w-10 h-10 rounded cursor-pointer border border-slate-300"
                      />
                      <span className="text-[10px] text-slate-400">
                        צבע {idx + 1}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="border-r pr-6 border-slate-200">
              <label className="block text-xs font-bold text-slate-500 mb-2">
                צבע ימי נישואין:
              </label>
              <input
                type="color"
                value={anniversaryColor}
                onChange={(e) => handleAnniversaryColorChange(e.target.value)}
                className="w-10 h-10 rounded cursor-pointer border border-slate-300"
              />
            </div>
          </div>

          <div className="md:mr-auto w-full md:w-64">
            <label className="block text-sm font-semibold mb-2 text-slate-700">
              פונט הלוח:
            </label>
            <select
              className="w-full p-2.5 border border-slate-300 rounded-lg bg-white font-sans"
              value={selectedFont}
              onChange={(e) => setSelectedFont(e.target.value)}
            >
              {AVAILABLE_FONTS.map((font) => (
                <option key={font.value} value={font.value}>
                  {font.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {Object.keys(processedCalendar).length > 0 && (
        <div className="px-4">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-slate-700">
                תצוגה מקדימה של הלוח
              </h2>
              <div className="flex gap-1.5" style={{ direction: "ltr" }}>
                <button
                  onClick={handleSizeOut}
                  disabled={circleSize <= 64}
                  className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center font-bold border border-slate-300 transition text-sm disabled:opacity-40"
                  title="צמצם רוחב עמודות"
                >
                  —
                </button>
                <button
                  onClick={handleSizeIn}
                  disabled={circleSize >= 96}
                  className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center font-bold border border-slate-300 transition text-sm disabled:opacity-40"
                  title="הרחב לגודל מקורי"
                >
                  +
                </button>
              </div>
            </div>
            
            <button
              onClick={handlePrepareDataForCanva}
              className="bg-emerald-600 text-white font-bold py-3 px-8 rounded-lg hover:bg-emerald-700 shadow transition text-lg"
            >
              הכן נתונים להעתקה לקנבה ✨
            </button>
          </div>

          {/* ✨ עדכון: שינוי ה-gap בין העמודות מ-gap-4 ל-gap-1.5 כדי לצמצם מרווחים ריקים */}
          <div className="flex gap-1.5 bg-white p-3 rounded-xl border border-slate-200 shadow-inner overflow-x-auto scrollbar-thin pb-6 justify-start">
            {activeMonths.map((month) => (
              <div
                key={month}
                style={{ 
                  // ✨ עדכון: צמצום הריפוד של העמודה מ-+16 ל-+8 פיקסלים בלבד מסביב לעיגול
                  minWidth: `${circleSize + 8}px`, 
                  width: `${circleSize + 8}px` 
                }}
                className="bg-slate-50 p-1 rounded-lg border border-slate-200 flex flex-col items-center min-h-[300px] shrink-0 transition-all duration-150"
              >
                <div className="font-bold text-xs text-indigo-900 border-b border-indigo-200 w-full text-center pb-0.5 mb-2.5 truncate">
                  {month}
                </div>

                <div className="flex flex-col gap-2 w-full items-center">
                  {processedCalendar[month]?.map((circle) => (
                    <div
                      key={circle.id}
                      onClick={() =>
                        handleSingleCircleColorChange(month, circle.id)
                      }
                      style={{ 
                        backgroundColor: circle.color,
                        width: `${circleSize}px`,
                        height: `${circleSize}px`,
                      }}
                      className="rounded-full flex flex-col justify-center items-center text-center p-1 cursor-pointer shadow border transition-all hover:scale-105 select-none border-slate-300 shrink-0"
                    >
                      <span className="text-[11px] font-bold text-slate-800 whitespace-nowrap overflow-hidden text-ellipsis max-w-full px-0.5 leading-tight">
                        {circle.name}
                      </span>
                      <span className="text-xs font-extrabold text-slate-900 mt-0.5">
                        {circle.date}
                      </span>
                    </div>
                  ))}
                  {processedCalendar[month]?.length === 0 && (
                    <span className="text-[10px] text-slate-400 italic mt-4">
                      אין אירועים
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white p-6 rounded-2xl max-w-lg w-full shadow-2xl border border-slate-100">
            <h3 className="text-xl font-bold mb-3 text-slate-800">העתקת הנתונים לקנבה</h3>
            <p className="text-sm text-slate-600 mb-4 leading-relaxed">
              לחץ על הכפתור מטה כדי להעתיק את רשימת השמות, התאריכים והצבעים. לאחר מכן נעבור לקנבה ונזין אותם ידנית ברגע.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={handleCopyToClipboard}
                className="bg-indigo-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-indigo-700 transition"
              >
                📋 העתק נתונים
              </button>
              <button
                onClick={() => setShowModal(false)}
                className="bg-slate-200 text-slate-700 font-semibold py-2 px-4 rounded-lg hover:bg-slate-300 transition"
              >
                סגור
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}