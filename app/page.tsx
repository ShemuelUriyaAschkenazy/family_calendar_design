"use client";

import { useState } from "react";
import html2canvas from "html2canvas-pro";

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

interface ColorGroupInstruction {
  color: string;
  colorName: string;
  startIdx: number;
  endIdx: number;
  count: number;
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

const AVAILABLE_DESIGNS = [
  {
    id: "design_1",
    name: "עיצוב 1 (3 צבעים)",
    imagePath: "/designs/design_1.jpeg",
    colors: ["#ebcdbb", "#b9dfd3", "#FFFFFF", "#FFFFFF"], // שומרים 4 צבעים במערך, אך משתמשים ב-3
    useFourth: false,
  },
  {
    id: "design_2",
    name: "עיצוב 2 (4 צבעים)",
    imagePath: "/designs/design_2.jpeg",
    colors: ["#bfafa5", "#f1dd99", "#f8bd8d", "#FFFFFF"],
    useFourth: true,
  },
];

function hebrewToNumber(str: string): number {
  const cleanStr = str
    .replace(/[\u201D\u201C\u2018\u2019`”]/g, '"')
    .replace(/["']/g, "")
    .trim();
  const gimatriaMap: Record<string, number> = {
    א: 1,
    ב: 2,
    ג: 3,
    ד: 4,
    ה: 5,
    ו: 6,
    ז: 7,
    ח: 8,
    ט: 9,
    י: 10,
    כ: 20,
    ל: 30,
    מ: 40,
    נ: 50,
    ס: 60,
    ע: 70,
    פ: 80,
    צ: 90,
    ק: 100,
    ר: 200,
    ש: 300,
    ת: 400,
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
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [emailInput, setEmailInput] = useState("herut.photo@gmail.com");
  const [isEditingEmail, setIsEditingEmail] = useState(false);

  const [birthdayColors, setBirthdayColors] = useState<string[]>([
    "#FFFFFF",
    "#ADD8E6",
    "#FFD700",
    "#98FB98",
  ]);
  const [useFourthColor, setUseFourthColor] = useState<boolean>(false);
  const [anniversaryColor, setAnniversaryColor] = useState<string>("#e8b6c7");
  const [selectedFont, setSelectedFont] = useState<string>(
    "system-ui, sans-serif",
  );
  const [selectedDesign, setSelectedDesign] = useState<string>("");

  const [showModal, setShowModal] = useState(false);
  const [tableDataString, setTableDataString] = useState("");
  const [colorInstructions, setColorInstructions] = useState<
    ColorGroupInstruction[]
  >([]);

  const circleSize = 96;

  const processData = (
    dataToProcess: RawEvent[],
    type: "gregorian" | "hebrew",
    currentColors: string[],
    currentAnniversaryColor: string,
    enableFourth: boolean,
  ) => {
    const monthsList = type === "gregorian" ? GREGORIAN_MONTHS : HEBREW_MONTHS;
    const sortedCalendar: Record<string, ProcessedCircle[]> = {};

    monthsList.forEach((m) => (sortedCalendar[m] = []));

    dataToProcess.forEach((row, rowIndex) => {
      const name = row["שם / שמות"];
      let date =
        type === "gregorian"
          ? row["יום בחודש (מספר)"]
          : row["יום בחודש (אותיות)"];
      const month = type === "gregorian" ? row["חודש לועזי"] : row["חודש עברי"];
      const isAnniversary = row["סוג האירוע"] === "יום נישואין";

      if (!name || !date || !month || !sortedCalendar[month]) return;

      date = date
        .replace(/[\u201D\u201C\u2013\u2014”„“]/g, '"')
        .replace(/[\u2018\u2019’]/g, "'")
        .trim();

      // 1. נקה סימנים מוזרים ונקה רווחים
      date = date.trim();

      // 2. במקום תווים נסתרים - נחליף לגרש ומירכאות תקניים של המקלדת העברית שמסתדרים עם כל הפונטים
      if (type === "hebrew") {
        date = date
          .replace(/'/g, "׳") // החלפת גרש רגיל בגרש עברי תקני
          .replace(/"/g, "״"); // החלפת מירכאות רגילות במירכאות עבריות תקניות
      }

      sortedCalendar[month].push({
        id: `${month}-${rowIndex}`,
        name: name,
        date: date,
        type: isAnniversary ? "anniversary" : "birthday",
        color: "",
        requiresCheck: name.length > 10,
      });
    });

    monthsList.forEach((month) => {
      sortedCalendar[month].sort((a, b) => {
        const numA =
          type === "gregorian" ? parseInt(a.date, 10) : hebrewToNumber(a.date);
        const numB =
          type === "gregorian" ? parseInt(b.date, 10) : hebrewToNumber(b.date);
        return numA - numB;
      });
    });

    const activeBirthdayColors = enableFourth
      ? currentColors
      : currentColors.slice(0, 3);

    monthsList.forEach((month, monthIdx) => {
      const currentMonthEvents = sortedCalendar[month];

      // ✨ שיפור: החזקת מונה תדירויות עבור צבעי ימי ההולדת בחודש הנוכחי
      const colorUsageInMonth: Record<string, number> = {};
      activeBirthdayColors.forEach((c) => {
        colorUsageInMonth[c] = 0;
      });

      currentMonthEvents.forEach((event, idx) => {
        if (event.type === "anniversary") {
          event.color = currentAnniversaryColor;
          return;
        }

        // הגדרת השכן הקודם באותו החודש (מלמעלה)
        const sameMonthPrevColor =
          idx > 0 ? currentMonthEvents[idx - 1].color : null;

        // הגדרת השכן באותו אינדקס בחודש הקודם (מימין)
  // הגדרת השכן באותו אינדקס בחודש הקודם (מימין)
        let neighborMonthPrevColor: string | null = null;
        if (monthIdx > 0) {
          const prevMonthName = monthsList[monthIdx - 1];
          const prevMonthEvents = sortedCalendar[prevMonthName];

          // ✨ התיקון: בודקים אם יש אירוע מקביל באותו אינדקס בדיוק בחודש הקודם
          if (prevMonthEvents && prevMonthEvents[idx]) {
            neighborMonthPrevColor = prevMonthEvents[idx].color;
          }
          // אם idx גדול יותר מכמות האירועים שם, neighborMonthPrevColor יישאר null (הצבע משוחרר!)
        }

        // 1. סינון ראשוני: מציאת הצבעים שלא יגרמו לכפילות עם השכנים
        let allowedColors = activeBirthdayColors.filter(
          (c) => c !== sameMonthPrevColor && c !== neighborMonthPrevColor,
        );

        // הגנה: אם כולם חסומים, נתפשר ונאפשר את כל הצבעים הפעילים
        if (allowedColors.length === 0) {
          allowedColors = activeBirthdayColors;
        }

        // 2. מיון חכם: מוצאים מהו רף השימוש המינימלי מבין הצבעים המותרים
        const minUsage = Math.min(
          ...allowedColors.map((c) => colorUsageInMonth[c] || 0),
        );

        // 3. סינון לצבעים שהשתמשו בהם הכי פחות (העדיפות העליונה)
        const bestColorOptions = allowedColors.filter(
          (c) => (colorUsageInMonth[c] || 0) === minUsage,
        );

        // 4. בחירה אקראית מתוך קבוצת הצבעים המגוונת ביותר הזמינה
        const chosenColor =
          bestColorOptions[Math.floor(Math.random() * bestColorOptions.length)];

        // השמת הצבע ועדכון המונה לחודש זה
        event.color = chosenColor;
        colorUsageInMonth[chosenColor] =
          (colorUsageInMonth[chosenColor] || 0) + 1;
      });
    });

    setProcessedCalendar(sortedCalendar);
  };

  const handleDesignChange = (designId: string) => {
    setSelectedDesign(designId);
    if (!designId) return;

    const design = AVAILABLE_DESIGNS.find((d) => d.id === designId);
    if (!design) return;

    // 1. שמירת מערך הצבעים הישן לצורך החלפה חלקה בלוח הקיים
    const oldColors = [...birthdayColors];
    const newColors = design.colors;

    // 2. עדכון ה-States של הצבעים ומצב הצבע הרביעי
    setBirthdayColors(newColors);
    setUseFourthColor(design.useFourth);

    // 3. עדכון הלוח הקיים בצבעים החדשים (לפי אינדקסים) בלי להגריל מחדש
    const updatedCalendar = { ...processedCalendar };
    Object.keys(updatedCalendar).forEach((month) => {
      updatedCalendar[month] = updatedCalendar[month].map((event) => {
        if (event.type === "birthday") {
          const colorIdx = oldColors.indexOf(event.color);
          // אם מצאנו את האינדקס של הצבע הישן, נחליף אותו בחדש לפי אותו מיקום
          if (colorIdx !== -1) {
            return { ...event, color: newColors[colorIdx] };
          }
          // הגנה למקרה שהצבע הרביעי לא היה קיים מקודם
          return { ...event, color: newColors[0] };
        }
        return event;
      });
    });
    setProcessedCalendar(updatedCalendar);
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
          useFourthColor,
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

    const oldColor = birthdayColors[index];
    const updatedCalendar = { ...processedCalendar };
    Object.keys(updatedCalendar).forEach((month) => {
      updatedCalendar[month] = updatedCalendar[month].map((event) => {
        if (event.type === "birthday" && event.color === oldColor) {
          return { ...event, color: newColor };
        }
        return event;
      });
    });
    setProcessedCalendar(updatedCalendar);
  };

  const handleAnniversaryColorChange = (newColor: string) => {
    setAnniversaryColor(newColor);

    // מעדכן ישירות את כל ימי הנישואין לצבע החדש בלי להגריל מחדש
    const updatedCalendar = { ...processedCalendar };
    Object.keys(updatedCalendar).forEach((month) => {
      updatedCalendar[month] = updatedCalendar[month].map((event) => {
        if (event.type === "anniversary") {
          return { ...event, color: newColor };
        }
        return event;
      });
    });
    setProcessedCalendar(updatedCalendar);
  };

  const handleToggleFourthColor = (checked: boolean) => {
    setUseFourthColor(checked);
  };

  const handleRegenerateColors = () => {
    if (rawData.length === 0) return alert("נא לטעון נתונים מהגיליון תחילה");
    processData(
      rawData,
      calendarType,
      birthdayColors,
      anniversaryColor,
      useFourthColor,
    );
  };

  const handleSingleCircleColorChange = (month: string, id: string) => {
    const updated = { ...processedCalendar };
    const circle = updated[month].find((c) => c.id === id);
    if (!circle || circle.type === "anniversary") return;

    const activeColors = useFourthColor
      ? birthdayColors
      : birthdayColors.slice(0, 3);
    const currentColorIndex = activeColors.indexOf(circle.color);
    const nextColorIndex = (currentColorIndex + 1) % activeColors.length;
    circle.color = activeColors[nextColorIndex];
    setProcessedCalendar(updated);
  };

  const handlePrepareDataForCanva = () => {
    // ✨ תזכורת חדשה: שואלת את המשתמש ומאפשרת לו לעצור אם הוא שכח לשלוח מייל
    const confirmEmail = confirm(
      "📢 תזכורת חשובה!\nהאם שלחת לעצמך צילום מסך של הלוח והצבעים הנוכחיים למייל?\n\nלחץ 'אישור' כדי להמשיך להעתקה לקנבה, או 'ביטול' כדי לשלוח מייל קודם.",
    );

    // אם המשתמש לחץ ביטול (Cancel), אנחנו עוצרים את הפונקציה ולא פותחים את המודאל
    if (!confirmEmail) return;
    const allEvents: ProcessedCircle[] = [];

    Object.keys(processedCalendar).forEach((month) => {
      processedCalendar[month].forEach((event) => {
        allEvents.push(event);
      });
    });

    if (allEvents.length === 0) return alert("אין נתונים לייצוא");

    const targetColorOrder = [
      ...(useFourthColor ? birthdayColors : birthdayColors.slice(0, 3)),
      anniversaryColor,
    ];

    allEvents.sort((a, b) => {
      return (
        targetColorOrder.indexOf(a.color) - targetColorOrder.indexOf(b.color)
      );
    });

    const rows = allEvents.map((event) => {
      return `${event.name}\t${event.date}`;
    });

    const instructions: ColorGroupInstruction[] = [];
    let currentLineCounter = 1;

    targetColorOrder.forEach((color, idx) => {
      const eventsInColor = allEvents.filter((e) => e.color === color);
      if (eventsInColor.length === 0) return;

      const isAnniversary = color === anniversaryColor;
      const colorName = isAnniversary ? "יום נישואין" : `צבע ${idx + 1}`;

      instructions.push({
        color,
        colorName,
        startIdx: currentLineCounter,
        endIdx: currentLineCounter + eventsInColor.length - 1,
        count: eventsInColor.length,
      });

      currentLineCounter += eventsInColor.length;
    });

    setTableDataString(rows.join("\n"));
    setColorInstructions(instructions);
    setShowModal(true);
  };

  const handleCopyToClipboard = () => {
    navigator.clipboard.writeText(tableDataString);
    alert(
      "השמות והתאריכים הועתקו כשהם ממוינים לפי צבעים! כעת בצע הדבקה בקנבה.",
    );
  };

  const activeMonths =
    calendarType === "gregorian" ? GREGORIAN_MONTHS : HEBREW_MONTHS;

  const handleSendEmail = async () => {
    if (!emailInput) return alert("נא להזין כתובת אימייל תקנית");

    // מוצאים את האלמנט שעוטף את כל חודשי הלוח שנה כדי לצלם רק אותו
    // נשתמש ב-ID ייעודי שנוסיף מיד בדילוג הבא (למשל 'calendar-preview-area')
    const calendarElement = document.getElementById("calendar-preview-area");
    if (!calendarElement) return alert("לא ניתן היה למצוא את אזור הלוח לצילום");

    setIsSendingEmail(true);

    try {
      // 1. יצירת צילום מסך של הלוח ישירות בדפדפן
      const canvas = await html2canvas(calendarElement, {
        useCORS: true, // תמיכה בטעינת תמונות ממקורות חיצוניים כמו הבאנר
        scale: 2, // הגדלת האיכות של צילום המסך (רזולוציה כפולה)
        backgroundColor: "#ffffff", // ✨ הכרחי: מכריח צבע רקע לבן נקי במקום לרשת הגדרות צבע בעייתיות מה-CSS של האב
      });

      const imageBase64 = canvas.toDataURL("image/png");

      // 2. שליחת הנתונים ל-API שרת שלנו שרץ ב-Vercel
      const response = await fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64,
          userEmail: emailInput,
        }),
      });

      const result = await response.json();

      if (response.ok) {
        alert("📧 המייל נשלח בהצלחה יחד עם צילום הלוח הנוכחי!");
      } else {
        alert(`שגיאה בשליחת המייל: ${result.error}`);
      }
    } catch (error) {
      console.error(error);
      alert("התרחשה שגיאה במהלך יצירת הלוח או שליחת המייל");
    } finally {
      setIsSendingEmail(false);
    }
  };

  return (
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

      {/* מקטע בחירת עיצוב ותצוגה מקדימה של הבאנר */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 mb-6 mx-4">
        <div className="max-w-md mb-4">
          <label className="block text-sm font-semibold mb-2 text-slate-700">
            בחר עיצוב באנר (ישנה את צבעי ברירת המחדל):
          </label>
          <select
            className="w-full p-2.5 border border-slate-300 rounded-lg bg-white"
            value={selectedDesign}
            onChange={(e) => handleDesignChange(e.target.value)}
          >
            <option value="">-- ללא עיצוב / התאמה אישית --</option>
            {AVAILABLE_DESIGNS.map((design) => (
              <option key={design.id} value={design.id}>
                {design.name}
              </option>
            ))}
          </select>
        </div>

        {/* הצגת הבאנר הנבחר כתצוגה מקדימה מעל שורות הלוח */}
        {selectedDesign && (
          <div className="mt-4 border border-slate-300 rounded-xl overflow-hidden shadow-sm max-w-4xl mx-auto">
            <div className="bg-slate-100 text-xs font-bold text-slate-500 p-1.5 text-center border-b border-slate-200">
              תצוגה מקדימה של הבאנר העליון המתוכנן
            </div>
            <img
              src={
                AVAILABLE_DESIGNS.find((d) => d.id === selectedDesign)
                  ?.imagePath
              }
              alt="Design Preview"
              className="w-full h-40 object-cover"
            />
          </div>
        )}
      </div>

      {rawData.length > 0 && (
        <div className="bg-white p-6 rounded-xl border border-indigo-100 shadow-sm mb-8 flex flex-col md:flex-row gap-6 items-center justify-between mx-4">
          <div className="flex flex-wrap gap-6 items-center w-full md:w-auto">
            {/* 1. מקטע צבעי ימי הולדת */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-3">
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
                        className="w-10 h-10 rounded cursor-pointer border border-slate-300 shadow-sm"
                      />
                      <span className="text-[10px] text-slate-400">
                        צבע {idx + 1}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* קו מפריד אנכי עדין */}
            <div className="hidden sm:block h-12 w-px bg-slate-200 self-end mb-4" />

            {/* 2. מקטע צבע ימי נישואין */}
            <div className="flex flex-col gap-2">
              <label className="block text-xs font-bold text-slate-500">
                צבע ימי נישואין:
              </label>
              <div className="flex flex-col items-center gap-1">
                <input
                  type="color"
                  value={anniversaryColor}
                  onChange={(e) => handleAnniversaryColorChange(e.target.value)}
                  className="w-10 h-10 rounded cursor-pointer border border-slate-300 shadow-sm"
                />
                <span className="text-[10px] text-slate-400">לב 💖</span>
              </div>
            </div>

            {/* קו מפריד אנכי עדין */}
            <div className="hidden sm:block h-12 w-px bg-slate-200 self-end mb-4" />

            {/* 3. כפתור הגרלה מחדש */}
            <div className="flex flex-col justify-end h-full self-center pt-4">
              <button
                onClick={handleRegenerateColors}
                className="bg-indigo-50 text-indigo-700 font-bold py-2 px-4 rounded-lg hover:bg-indigo-100 border border-indigo-200 transition text-sm h-10 flex items-center justify-center gap-1.5 shadow-sm"
              >
                🎲 הגרל צבעים מחדש
              </button>
            </div>
            {/* רכיב שליחת המייל המשודרג ב-UI */}
            <div className="flex flex-col gap-2 border-r pr-6 border-slate-200">
              <label className="block text-xs font-bold text-slate-500">
                שלח עותק למייל:
              </label>
              <div className="flex gap-2 items-center h-10">
                <div className="relative flex items-center h-full">
                  <input
                    type="email"
                    placeholder="your-email@example.com"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    disabled={!isEditingEmail} // ✨ חסום כל עוד לא במצב עריכה
                    className={`p-2 pl-12 border rounded-lg text-sm h-full w-52 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 transition-colors ${
                      !isEditingEmail
                        ? "bg-slate-50 text-slate-500 border-slate-200 cursor-not-allowed"
                        : "bg-white text-slate-900 border-slate-300"
                    }`}
                  />
                  {/* כפתור עריכה/שמירה קטן בתוך תיבת האינפוט בצד שמאל */}
                  <button
                    type="button"
                    onClick={() => setIsEditingEmail(!isEditingEmail)}
                    className="absolute left-2 text-xs font-semibold px-1.5 py-0.5 rounded text-indigo-600 hover:bg-indigo-50 transition"
                  >
                    {isEditingEmail ? "💾 שמור" : "✏️ ערוך"}
                  </button>
                </div>

                <button
                  onClick={handleSendEmail}
                  disabled={isSendingEmail || isEditingEmail} // חסום את השליחה אם המשתמש באמצע עריכה ולא שמר
                  className="bg-emerald-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-emerald-700 transition text-sm h-full flex items-center justify-center gap-1 shadow-sm disabled:opacity-50"
                >
                  {isSendingEmail ? "⏳ שולח..." : "📧 שלח צילום מסך"}
                </button>
              </div>
              {isEditingEmail && (
                <span className="text-[10px] text-amber-600 font-medium animate-pulse">
                  לחץ על "שמור" לפני השליחה המייל
                </span>
              )}
            </div>
          </div>

          {/* 4. מקטע בחירת הפונט (מיושר לשמאל ב-Desktop) */}
          <div className="w-full md:w-64 flex flex-col gap-2">
            <label className="block text-sm font-semibold text-slate-700">
              פונט הלוח:
            </label>
            <select
              className="w-full p-2.5 border border-slate-300 rounded-lg bg-white font-sans text-sm shadow-sm"
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
            <h2 className="text-xl font-bold text-slate-700">
              תצוגה מקדימה של הלוח
            </h2>
            <button
              onClick={handlePrepareDataForCanva}
              className="bg-emerald-600 text-white font-bold py-3 px-8 rounded-lg hover:bg-emerald-700 shadow transition text-lg"
            >
              הכן נתונים להעתקה לקנבה ✨
            </button>
          </div>

          <div
            id="calendar-preview-area"
            className="flex gap-1.5 bg-white p-3 rounded-xl border border-slate-200 shadow-inner overflow-x-auto scrollbar-thin pb-6 justify-start"
          >
            {activeMonths.map((month) => (
              <div
                key={month}
                style={{
                  minWidth: `${circleSize + 8}px`,
                  width: `${circleSize + 8}px`,
                }}
                className="bg-slate-50 p-1 rounded-lg border border-slate-200 flex flex-col items-center min-h-[300px] shrink-0"
              >
                <div className="font-bold text-xs text-indigo-900 border-b border-indigo-200 w-full text-center pb-0.5 mb-2.5 truncate">
                  {month}
                </div>

                <div className="flex flex-col gap-2 w-full items-center">
                  {processedCalendar[month]?.map((circle) => {
                    const isAnniversary = circle.type === "anniversary";

                    return (
                      <div
                        key={circle.id}
                        onClick={() =>
                          handleSingleCircleColorChange(month, circle.id)
                        }
                        style={{
                          width: `${circleSize}px`,
                          height: `${circleSize}px`,
                          backgroundColor: isAnniversary
                            ? "transparent"
                            : circle.color,
                        }}
                        className={`relative flex flex-col justify-center items-center text-center cursor-pointer select-none border-slate-300 shrink-0 transition-all hover:scale-105 ${
                          isAnniversary ? "" : "rounded-full shadow border p-1"
                        }`}
                      >
                        {/* רנדור צורת הלב המשודרגת עבור ימי נישואין */}
                        {isAnniversary ? (
                          <div className="absolute inset-0 w-full h-full flex items-center justify-center">
                            <svg
                              viewBox="1.75 3 20.5 18.35"
                              className="absolute inset-0 w-full h-full"
                              style={{
                                fill: circle.color,
                                width: "100%",
                                height: "100%",
                              }}
                            >
                              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                            </svg>
                            {/* התאמת מיקום הטקסט במרכז העמוק של הלב המוגדל */}
                            {/* התאמת מיקום הטקסט במרכז העמוק של הלב המוגדל */}
                            <div className="relative z-10 flex flex-col items-center justify-center p-1 select-none text-center max-w-[80%] mt-[-6px] w-full">
                              <span className="text-[11px] font-bold text-slate-800 whitespace-nowrap overflow-hidden text-ellipsis w-full block text-center px-0.5 leading-tight">
                                {circle.name}
                              </span>
                              <span
                                className="text-xs font-extrabold text-slate-900 mt-0.5"
                                style={{ direction: "rtl" }}
                              >
                                {circle.date}
                              </span>
                            </div>
                          </div>
                        ) : (
                          // תוכן רגיל של עיגול עבור ימי הולדת
                          <>
                            <span className="text-[11px] font-bold text-slate-800 whitespace-nowrap overflow-hidden text-ellipsis w-full block text-center px-0.5 leading-tight">
                              {circle.name}
                            </span>
                            <span className="text-xs font-extrabold text-slate-900 mt-0.5">
                              {circle.date}
                            </span>
                          </>
                        )}
                      </div>
                    );
                  })}
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
          <div className="bg-white p-6 rounded-2xl max-w-xl w-full shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-2 text-slate-800">
              העתקת הנתונים ומדריך צביעה לקנבה
            </h3>
            <p className="text-xs text-slate-600 mb-4 leading-relaxed">
              הנתונים יסודרו אוטומטית לפי קבוצות צבעים. לאחר שתדביק אותם בקנבה,
              השתמש במדריך הבא כדי לדעת איזה דפים (כרטיסים) לצבוע בכל צבע.
            </p>

            <div className="bg-indigo-50/70 border border-indigo-100 rounded-xl p-4 mb-5 text-sm">
              <h4 className="font-bold text-indigo-900 mb-2.5 border-b border-indigo-200 pb-1">
                🎨 מדריך צביעת דפים ב-Canva:
              </h4>
              <div className="flex flex-col gap-2">
                {colorInstructions.map((inst, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between bg-white p-2 rounded-lg border border-indigo-50 shadow-sm"
                  >
                    <span className="font-semibold text-slate-700 flex items-center gap-2">
                      <span
                        className="w-4 h-4 rounded-full border border-slate-300 shadow-inner"
                        style={{ backgroundColor: inst.color }}
                      ></span>
                      {inst.colorName} ({inst.color})
                    </span>
                    <span className="text-xs bg-indigo-600 text-white font-mono px-2 py-0.5 rounded-md font-bold">
                      {inst.startIdx === inst.endIdx
                        ? `דף ${inst.startIdx}`
                        : `דפים ${inst.startIdx} עד ${inst.endIdx}`}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-3 justify-end border-t border-slate-100 pt-3">
              <button
                onClick={handleCopyToClipboard}
                className="bg-indigo-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-indigo-700 transition shadow-md"
              >
                📋 העתק שמות ותאריכים
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
