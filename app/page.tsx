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
  "ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני",
  "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"
];
const HEBREW_MONTHS = [
  "תשרי", "חשוון", "כסלו", "טבת", "שבט", "אדר",
  "ניסן", "אייר", "סיון", "תמוז", "אב", "אלול"
];

const AVAILABLE_DESIGNS = [
  {
    id: "design_1",
    name: "עיצוב 1 (3 צבעים חמים)",
    imagePath: "/designs/design_1.jpeg",
    colors: ["#ebcdbb", "#b9dfd3", "#FFFFFF", "#FFFFFF"],
    useFourth: false,
  },
  {
    id: "design_2",
    name: "עיצוב 2 (4 צבעים פסטל)",
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
    א: 1, ב: 2, ג: 3, ד: 4, ה: 5, ו: 6, ז: 7, ח: 8, ט: 9, י: 10,
    כ: 20, ל: 30, מ: 40, נ: 50, ס: 60, ע: 70, פ: 80, צ: 90, ק: 100,
    ר: 200, ש: 300, ת: 400,
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
  const [calendarType, setCalendarType] = useState<"gregorian" | "hebrew">("hebrew");
  const [rawData, setRawData] = useState<RawEvent[]>([]);
  const [processedCalendar, setProcessedCalendar] = useState<Record<string, ProcessedCircle[]>>({});
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [emailInput, setEmailInput] = useState("herut.photo@gmail.com");
  const [familyName, setFamilyName] = useState("");

  const [birthdayColors, setBirthdayColors] = useState<string[]>([
    "#FFFFFF", "#F4EAE1", "#E6DFD3", "#D8CFC4"
  ]);
  const [useFourthColor, setUseFourthColor] = useState<boolean>(false);
  
  const [anniversaryColor, setAnniversaryColor] = useState<string>("#e8b6c7");
  const [selectedDesign, setSelectedDesign] = useState<string>("");

  const [showModal, setShowModal] = useState(false);
  const [tableDataString, setTableDataString] = useState("");
  const [colorInstructions, setColorInstructions] = useState<ColorGroupInstruction[]>([]);

  // Tuned layout metrics for high density desktop visibility
  const circleSize = 84; 

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
      let date = type === "gregorian" ? row["יום בחודש (מספר)"] : row["יום בחודש (אותיות)"];
      const month = type === "gregorian" ? row["חודש לועזי"] : row["חודש עברי"];
      const isAnniversary = row["סוג האירוע"] === "יום נישואין";

      if (!name || !date || !month || !sortedCalendar[month]) return;

      date = date
        .replace(/[\u201D\u201C\u2013\u2014”„“]/g, '"')
        .replace(/[\u2018\u2019’]/g, "'")
        .trim();

      if (type === "hebrew") {
        date = date.replace(/'/g, "׳").replace(/"/g, "״");
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
        const numA = type === "gregorian" ? parseInt(a.date, 10) : hebrewToNumber(a.date);
        const numB = type === "gregorian" ? parseInt(b.date, 10) : hebrewToNumber(b.date);
        return numA - numB;
      });
    });

    const activeBirthdayColors = enableFourth ? currentColors : currentColors.slice(0, 3);

    monthsList.forEach((month, monthIdx) => {
      const currentMonthEvents = sortedCalendar[month];
      const colorUsageInMonth: Record<string, number> = {};
      activeBirthdayColors.forEach((c) => { colorUsageInMonth[c] = 0; });

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
          if (prevMonthEvents && prevMonthEvents[idx]) {
            neighborMonthPrevColor = prevMonthEvents[idx].color;
          }
        }

        let allowedColors = activeBirthdayColors.filter(
          (c) => c !== sameMonthPrevColor && c !== neighborMonthPrevColor
        );

        if (allowedColors.length === 0) { allowedColors = activeBirthdayColors; }

        const minUsage = Math.min(...allowedColors.map((c) => colorUsageInMonth[c] || 0));
        const bestColorOptions = allowedColors.filter((c) => (colorUsageInMonth[c] || 0) === minUsage);
        const chosenColor = bestColorOptions[Math.floor(Math.random() * bestColorOptions.length)];

        event.color = chosenColor;
        colorUsageInMonth[chosenColor] = (colorUsageInMonth[chosenColor] || 0) + 1;
      });
    });

    setProcessedCalendar(sortedCalendar);
  };

  const handleDesignChange = (designId: string) => {
    setSelectedDesign(designId);
    if (!designId) return;

    const design = AVAILABLE_DESIGNS.find((d) => d.id === designId);
    if (!design) return;

    const oldColors = [...birthdayColors];
    const newColors = design.colors;

    setBirthdayColors(newColors);
    setUseFourthColor(design.useFourth);

    const updatedCalendar = { ...processedCalendar };
    Object.keys(updatedCalendar).forEach((month) => {
      updatedCalendar[month] = updatedCalendar[month].map((event) => {
        if (event.type === "birthday") {
          const colorIdx = oldColors.indexOf(event.color);
          if (colorIdx !== -1) return { ...event, color: newColors[colorIdx] };
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
        const selectedData = calendarType === "gregorian" ? result.gregorian : result.hebrew;
        setRawData(selectedData);
        processData(selectedData, calendarType, birthdayColors, anniversaryColor, useFourthColor);
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

    const updatedCalendar = { ...processedCalendar };
    Object.keys(updatedCalendar).forEach((month) => {
      updatedCalendar[month] = updatedCalendar[month].map((event) => {
        if (event.type === "anniversary") return { ...event, color: newColor };
        return event;
      });
    });
    setProcessedCalendar(updatedCalendar);
  };

  const handleToggleFourthColor = (checked: boolean) => { setUseFourthColor(checked); };

  const handleRegenerateColors = () => {
    if (rawData.length === 0) return alert("נא לטעון נתונים מהגיליון תחילה");
    processData(rawData, calendarType, birthdayColors, anniversaryColor, useFourthColor);
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
    const confirmEmail = confirm(
      "📢 תזכורת חשובה!\nהאם שלחת לעצמך צילום מסך של הלוח והצבעים הנוכחיים למייל?\n\nלחץ 'אישור' כדי להמשיך להעתקה לקנבה, או 'ביטול' כדי לשלוח מייל קודם."
    );

    if (!confirmEmail) return;
    const allEvents: ProcessedCircle[] = [];

    Object.keys(processedCalendar).forEach((month) => {
      processedCalendar[month].forEach((event) => { allEvents.push(event); });
    });

    if (allEvents.length === 0) return alert("אין נתונים לייצוא");

    const targetColorOrder = [
      ...(useFourthColor ? birthdayColors : birthdayColors.slice(0, 3)),
      anniversaryColor,
    ];

    allEvents.sort((a, b) => targetColorOrder.indexOf(a.color) - targetColorOrder.indexOf(b.color));

    const rows = allEvents.map((event) => `${event.name}\t${event.date}`);

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
    alert("השמות והתאריכים הועתקו כשהם ממוינים לפי צבעים! כעת בצע הדבקה בקנבה.");
  };

  const activeMonths = calendarType === "gregorian" ? GREGORIAN_MONTHS : HEBREW_MONTHS;

  const handleGeneratePreview = async () => {
    const calendarElement = document.getElementById("calendar-preview-area");
    if (!calendarElement) return alert("לא ניתן היה למצוא את אזור הלוח לצילום");

    setIsGeneratingPreview(true);
    setPreviewImage(null);

    try {
      const canvas = await html2canvas(calendarElement, {
        useCORS: true,
        scale: 2,
        backgroundColor: "#E8FAFF",
      });
      setPreviewImage(canvas.toDataURL("image/png"));
    } catch (error) {
      console.error(error);
      alert("התרחשה שגיאה במהלך יצירת התצוגה המקדימה של הקובץ");
    } finally {
      setIsGeneratingPreview(false);
    }
  };

  const handleSendEmail = async () => {
    if (!emailInput) return alert("נא להזין כתובת אימייל תקנית");
    if (!familyName.trim()) return alert("נא להזין את שם המשפחה עבורה מיועד הלוח");
    if (!previewImage) return alert("נא לייצר תצוגה מקדימה תחילה");

    setIsSendingEmail(true);

    try {
      const response = await fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: previewImage,
          userEmail: emailInput,
          familyName: familyName.trim(),
        }),
      });

      if (response.ok) {
        alert("📧 המייל נשלח בהצלחה יחד עם קובץ התצוגה המקדימה שאישרת!");
        setPreviewImage(null);
      } else {
        const result = await response.json();
        alert(`שגיאה בשליחת המייל: ${result.error}`);
      }
    } catch (error) {
      console.error(error);
      alert("התרחשה שגיאה במהלך שליחת המייל");
    } finally {
      setIsSendingEmail(false);
    }
  };

  return (
    <div 
      className="bg-[#E8FAFF] min-h-screen w-full text-right font-sans antialiased text-slate-800 p-6" 
      style={{ direction: "rtl" }}
    >
      <div className="w-full max-w-[1600px] mx-auto">
        
        {/* Header with New Logo */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8 pb-6 border-b border-slate-200/50 px-4">
          <div className="flex items-center gap-4">
            <img 
              src="/logo.webp" 
              alt="חרות בלב" 
              className="h-16 w-auto object-contain rounded-xl"
            />
            <div>
              <h1 className="text-3xl font-black text-[#7c1c3a] tracking-tight mb-1">
                מחולל לוח תאריכים משפחתי
              </h1>
              <p className="text-xs font-semibold text-slate-400">סטודיו חרות בלב • עיצוב נקי, מאוורר ומדויק</p>
            </div>
          </div>
          <a
            href="https://docs.google.com/spreadsheets/d/1rbCMUSLySLr5LoaMO_TSBYJIZjKVlTagOCf_bRUmOqc/copy"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-white/80 backdrop-blur-sm text-slate-600 hover:bg-white border border-slate-200 font-bold py-2.5 px-5 rounded-xl transition text-xs flex items-center gap-2 shadow-sm"
          >
            <span>📄</span>
            ליצירת קובץ דוגמה ב-Google Sheets
          </a>
        </div>

        {/* Step 1: Input sheet URL */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/50 shadow-sm mb-8 flex flex-wrap gap-4 items-end mx-4">
          <div className="flex-1 min-w-[300px]">
            <label className="block text-xs font-bold text-slate-400 mb-2 tracking-wide">
              קישור ל-Google Sheet (צפייה פתוחה):
            </label>
            <input
              type="text"
              className="w-full p-3 border border-slate-200 rounded-xl text-left bg-[#fdfdfd] focus:ring-2 focus:ring-[#7c1c3a]/10 focus:border-[#7c1c3a] outline-none transition text-sm"
              placeholder="https://docs.google.com/spreadsheets/d/..."
              value={sheetUrl}
              onChange={(e) => setSheetUrl(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 mb-2 tracking-wide">
              סוג לוח שנה:
            </label>
            <select
              className="p-3 border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-[#7c1c3a]/10 focus:border-[#7c1c3a] outline-none transition cursor-pointer text-sm font-medium"
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
            className="bg-[#7c1c3a] text-white font-bold py-3 px-8 rounded-xl hover:bg-[#61122a] disabled:bg-slate-300 transition text-sm shadow-sm"
          >
            {loading ? "טוען נתונים..." : "טען מהגיליון"}
          </button>
        </div>

        {/* Step 2: Banner selection */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/50 shadow-sm mb-8 mx-4">
          <div className="max-w-md">
            <label className="block text-xs font-bold text-slate-400 mb-2 tracking-wide">
              בחר עיצוב באנר (ישנה את צבעי ברירת המחדל):
            </label>
            <select
              className="w-full p-3 border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-[#7c1c3a]/10 focus:border-[#7c1c3a] outline-none transition text-sm cursor-pointer"
              value={selectedDesign}
              onChange={(e) => handleDesignChange(e.target.value)}
            >
              <option value="">-- ללא עיצוב / התאמה אישית --</option>
              {AVAILABLE_DESIGNS.map((design) => (
                <option key={design.id} value={design.id}>{design.name}</option>
              ))}
            </select>
          </div>

          {selectedDesign && (
            <div className="mt-4 border border-slate-200/60 rounded-xl overflow-hidden max-w-4xl mx-auto shadow-sm">
              <div className="bg-slate-50 text-[11px] font-bold text-slate-400 p-2 text-center border-b border-slate-100">
                תצוגה מקדימה של הבאנר העליון המתוכנן
              </div>
              <img
                src={AVAILABLE_DESIGNS.find((d) => d.id === selectedDesign)?.imagePath}
                alt="Design Preview"
                className="w-full h-36 object-cover"
              />
            </div>
          )}
        </div>

        {rawData.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8 mx-4">
            
            {/* Colors configuration panel */}
            <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200/50 shadow-sm flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-700 mb-4 pb-2 border-b border-slate-50 flex items-center gap-2">
                  <span>🎨</span> הגדרות וניהול צבעי הלוח
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="md:col-span-2 md:border-l md:border-slate-100 md:pl-6">
                    <div className="flex justify-between items-center mb-4">
                      <span className="text-xs font-bold text-slate-400 tracking-wider">🎂 צבעי ימי הולדת</span>
                      <label className="flex items-center gap-2 text-xs text-[#7c1c3a] font-bold cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={useFourthColor}
                          onChange={(e) => handleToggleFourthColor(e.target.checked)}
                          className="rounded border-slate-300 text-[#7c1c3a] focus:ring-[#7c1c3a] w-4 h-4"
                        />
                        צבע רביעי
                      </label>
                    </div>

                    <div className="grid grid-cols-4 gap-3">
                      {birthdayColors.map((color, idx) => {
                        if (idx === 3 && !useFourthColor) return null;
                        return (
                          <div key={idx} className="flex flex-col items-center gap-2 bg-slate-50 p-3 rounded-xl border border-slate-100">
                            <input
                              type="color"
                              value={color}
                              onChange={(e) => handleBirthdayColorChange(idx, e.target.value)}
                              className="w-11 h-11 rounded-lg cursor-pointer border border-slate-200 shadow-sm"
                            />
                            <span className="text-[10px] font-bold text-slate-400">צבע {idx + 1}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex flex-col justify-between">
                    <div>
                      <span className="text-xs font-bold text-slate-400 tracking-wider block mb-2">💖 ימי נישואין</span>
                      <p className="text-[11px] text-slate-400 mb-4 leading-relaxed">
                        האירועים יקבלו את צבע הרקע וצורת הלב הזו בתצוגה המקדימה.
                      </p>
                      <div className="flex gap-3 items-center bg-slate-50 p-3 rounded-xl border border-slate-100 w-full">
                        <input
                          type="color"
                          value={anniversaryColor}
                          onChange={(e) => handleAnniversaryColorChange(e.target.value)}
                          className="w-11 h-11 rounded-lg cursor-pointer border border-slate-200 shadow-sm"
                        />
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-slate-700">צבע הלב</span>
                          <span className="text-[10px] text-slate-400 font-mono mt-0.5 uppercase">{anniversaryColor}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-50">
                <button
                  onClick={handleRegenerateColors}
                  className="w-full bg-slate-50 text-slate-600 font-bold py-2.5 px-4 rounded-xl hover:bg-slate-100 border border-slate-200 transition text-xs flex items-center justify-center gap-2"
                >
                  🎲 הגרל צבעים מחדש
                </button>
              </div>
            </div>

            {/* Backup & send email panel */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200/50 shadow-sm flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2 pb-2 border-b border-slate-50">
                  <span>📧</span> שליחת תצוגה מקדימה למייל
                </h3>

                <div className="space-y-4">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 mb-1.5">שם המשפחה עבור הלוח:</label>
                    <input
                      type="text"
                      placeholder="למשל: משפחת ישראלי"
                      value={familyName}
                      onChange={(e) => setFamilyName(e.target.value)}
                      disabled={isSendingEmail || isGeneratingPreview}
                      className="w-full p-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-[#7c1c3a]/10 focus:border-[#7c1c3a] outline-none shadow-sm bg-[#fafafa]"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 mb-1.5">כתובת אימייל ליעד:</label>
                    <input
                      type="email"
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                      disabled
                      className="w-full p-3 border border-slate-100 rounded-xl text-sm bg-slate-50 text-slate-400 cursor-not-allowed"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mt-6 pt-4 border-t border-slate-50">
                <button
                  onClick={handleGeneratePreview}
                  disabled={isGeneratingPreview || isSendingEmail}
                  className="bg-slate-800 text-white font-bold py-2.5 px-4 rounded-xl hover:bg-slate-900 transition text-xs flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
                >
                  <span>📸</span>
                  <span>{isGeneratingPreview ? "מייצר..." : "צור תצוגה מקדימה"}</span>
                </button>

                <button
                  onClick={handleSendEmail}
                  disabled={!previewImage || isSendingEmail}
                  className="bg-[#7c1c3a] text-white font-bold py-2.5 px-4 rounded-xl hover:bg-[#61122a] transition text-xs flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 disabled:bg-slate-200 disabled:cursor-not-allowed"
                >
                  {isSendingEmail ? "שולח..." : "2. שלח את מה שמוצג"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Snapshot Review Banner */}
        {Object.keys(processedCalendar).length > 0 && (
          <>
            {previewImage && (
              <div className="bg-white border border-slate-200 p-5 rounded-2xl mb-8 shadow-sm animate-fadeIn mx-4">
                <div className="flex justify-between items-center mb-2 border-b border-slate-100 pb-2">
                  <span className="text-sm font-bold text-slate-700 flex items-center gap-2">
                    🔍 בדיקת קובץ הצילום המיועד למייל:
                  </span>
                  <button
                    onClick={() => setPreviewImage(null)}
                    className="text-xs font-bold text-slate-400 hover:text-slate-600 underline"
                  >
                    ✕ בטל / נקה צילום
                  </button>
                </div>
                <p className="text-xs text-slate-500 mb-4">
                  זהו בדיוק הקובץ שיישלח כקובץ מצורף (Attachment). ודא שכל השמות והתאריכים מופיעים תקין, ולאחר מכן לחץ על <b>"2. שלח את מה שמוצג"</b>.
                </p>
                <div className="border border-slate-100 rounded-xl overflow-hidden max-h-64 overflow-y-auto bg-white shadow-inner">
                  <img src={previewImage} alt="Email Attachment Preview" className="w-full h-auto object-contain" />
                </div>
              </div>
            )}

            {/* Flat Single-Row Layout (No Scroll, No Wrap) */}
            <div className="px-4 overflow-hidden">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <h2 className="text-xl font-bold text-slate-700">תצוגה מקדימה של הלוח</h2>
                <button
                  onClick={handlePrepareDataForCanva}
                  className="bg-emerald-600 text-white font-bold py-3 px-8 rounded-xl hover:bg-emerald-700 shadow-sm transition text-md w-full sm:w-auto"
                >
                  הכן נתונים להעתקה לקנבה ✨
                </button>
              </div>

              {/* Exact 12-column grid to hold all months tightly in one elegant view block */}
              <div
                id="calendar-preview-area"
                className="grid grid-cols-12 gap-1 bg-white p-2 rounded-2xl border border-slate-200 shadow-sm pb-6 w-full"
              >
                {activeMonths.map((month) => (
                  <div
                    key={month}
                    className="bg-[#f8fafc] p-1.5 rounded-xl border border-slate-100 flex flex-col items-center min-h-[360px] shadow-sm overflow-hidden"
                  >
                    <div className="font-bold text-[11px] text-slate-600 border-b border-slate-200/60 w-full text-center pb-1.5 mb-2 truncate tracking-tight">
                      {month}
                    </div>

                    <div className="flex flex-col gap-2 w-full items-center">
                      {processedCalendar[month]?.map((circle) => {
                        const isAnniversary = circle.type === "anniversary";

                        return (
                          <div
                            key={circle.id}
                            onClick={() => handleSingleCircleColorChange(month, circle.id)}
                            style={{
                              width: `${circleSize}px`,
                              height: `${circleSize}px`,
                              backgroundColor: isAnniversary ? "transparent" : circle.color,
                            }}
                            className={`relative flex flex-col justify-center items-center text-center cursor-pointer select-none transition-all hover:scale-105 ${
                              isAnniversary ? "" : "rounded-full shadow-sm border border-slate-200/60 p-1"
                            }`}
                          >
                            {isAnniversary ? (
                              <div className="absolute inset-0 w-full h-full flex items-center justify-center">
                                <svg
                                  viewBox="1.75 3 20.5 18.35"
                                  className="absolute inset-0 w-full h-full"
                                  style={{ fill: circle.color, width: "100%", height: "100%" }}
                                >
                                  <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                                </svg>
                                <div className="relative z-10 flex flex-col items-center justify-center p-0.5 select-none text-center max-w-[85%] mt-[-4px] w-full">
                                  <span className="text-[10px] font-bold text-slate-800 whitespace-nowrap overflow-hidden text-ellipsis w-full block text-center px-0.5 leading-tight">
                                    {circle.name}
                                  </span>
                                  <span className="text-[11px] font-extrabold text-slate-900 mt-0.5">
                                    {circle.date}
                                  </span>
                                </div>
                              </div>
                            ) : (
                              <>
                                <span className="text-[10px] font-bold text-slate-800 whitespace-nowrap overflow-hidden text-ellipsis w-full block text-center px-0.5 leading-tight">
                                  {circle.name}
                                </span>
                                <span className="text-[11px] font-extrabold text-slate-900 mt-0.5">
                                  {circle.date}
                                </span>
                              </>
                            )}
                          </div>
                        );
                      })}
                      {processedCalendar[month]?.length === 0 && (
                        <span className="text-[9px] text-slate-400 italic mt-6">אין אירועים</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Modal Instruction Panel */}
        {showModal && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50 backdrop-blur-[2px]">
            <div className="bg-white p-6 rounded-2xl max-w-xl w-full shadow-xl border border-slate-100 max-h-[90vh] overflow-y-auto">
              <h3 className="text-xl font-black mb-1 text-[#7c1c3a]">
                העתקת הנתונים ומדריך צביעה לקנבה
              </h3>
              <p className="text-xs text-slate-400 mb-5 leading-relaxed">
                הנתונים יסודרו אוטומטית לפי קבוצות צבעים. לאחר שתדביק אותם בקנבה, השתמש במדריך הבא כדי לדעת איזה דפים (כרטיסים) לצבוע בכל צבע.
              </p>

              <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 mb-6 text-sm">
                <h4 className="font-bold text-slate-700 mb-3 border-b border-slate-200 pb-2 flex items-center gap-1.5">
                  <span>🎨</span> מדריך צביעת דפים ב-Canva:
                </h4>
                <div className="flex flex-col gap-2">
                  {colorInstructions.map((inst, index) => (
                    <div key={index} className="flex items-center justify-between bg-white p-3 rounded-xl border border-slate-200/60 shadow-sm">
                      <span className="font-bold text-slate-600 flex items-center gap-2">
                        <span
                          className="w-4 h-4 rounded-full border border-slate-300 shadow-inner"
                          style={{ backgroundColor: inst.color }}
                        ></span>
                        {inst.colorName} <span className="font-mono text-xs font-normal text-slate-400">({inst.color})</span>
                      </span>
                      <span className="text-xs bg-[#7c1c3a] text-white font-mono px-2.5 py-1 rounded-lg font-bold">
                        {inst.startIdx === inst.endIdx ? `דף ${inst.startIdx}` : `דפים ${inst.startIdx} עד ${inst.endIdx}`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 justify-end border-t border-slate-100 pt-4">
                <button
                  onClick={handleCopyToClipboard}
                  className="bg-[#7c1c3a] text-white font-bold py-2.5 px-6 rounded-xl hover:bg-[#61122a] transition shadow-sm"
                >
                  📋 העתק שמות ותאריכים
                </button>
                <button
                  onClick={() => setShowModal(false)}
                  className="bg-slate-100 text-slate-500 font-bold py-2.5 px-4 rounded-xl hover:bg-slate-200 transition"
                >
                  סגור
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
} 