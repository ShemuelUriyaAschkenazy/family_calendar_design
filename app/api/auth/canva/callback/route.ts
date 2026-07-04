import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code) {
    return new NextResponse("לא התקבל קוד אימות מקנבה", { status: 400 });
  }

  const clientId = process.env.CANVA_CLIENT_ID;
  const clientSecret = process.env.CANVA_CLIENT_SECRET;
  const templateId = process.env.CANVA_TEMPLATE_ID;
  const redirectUri = "http://127.0.0.1:3000/api/auth/canva/callback";

  if (!clientId || !clientSecret || !templateId) {
    return new NextResponse("משתני סביבה חסרים בשרת (.env.local)", {
      status: 500,
    });
  }

  try {
    // 1. החלפת קוד האימות הזמני ב-Access Token רשמי מול קנבה
    const authHeader = Buffer.from(`${clientId}:${clientSecret}`).toString(
      "base64",
    );
    const tokenResponse = await fetch(
      "https://api.canva.com/rest/v1/oauth/token",
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${authHeader}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code: code,
          redirect_uri: redirectUri,
        }),
      },
    );

    if (!tokenResponse.ok) {
      const errText = await tokenResponse.text();
      console.error("Canva Token Error:", errText);
      return new NextResponse("נכשל אימות הטוקן מול קנבה", { status: 500 });
    }

    const { access_token } = await tokenResponse.json();

    // 2. שליפת נתוני האירועים שהמתינו בעוגייה הזמנית מה-Frontend
    const cookieStore = await cookies();
    const pendingEventsCookie = cookieStore.get("pending_calendar_events");
    if (!pendingEventsCookie) {
      return new NextResponse("פג תוקף נתוני האירועים, נא לנסות שוב מהאתר", {
        status: 400,
      });
    }

    const events = JSON.parse(pendingEventsCookie.value);

    // 3. שיחוח ואיחוד כל האירועים מכל 12 החודשים לרשימה אחת שטוחה
    const allEventsToProcess: any[] = [];
    Object.keys(events).forEach((month) => {
      events[month].forEach((event: any) => {
        allEventsToProcess.push({
          name: event.name,
          date: event.date,
          color: event.color.replace("#", ""),
        });
      });
    });

    console.log(
      `מתחיל ייצור אוטומטי חינמי עבור ${allEventsToProcess.length} כרטיסים בקנבה...`,
    );

    // 4. ריצה בלולאה וייצור פקודת Autofill אסינכרונית לכל כרטיס וכרטיס
    for (const event of allEventsToProcess) {
      // המפתחות כאן תואמים בול למה שרשמת בטקסטים וב-Alt Text של התבנית!
      const dataPayload = {
        person_name: { type: "text", text: event.name },
        event_date: { type: "text", text: event.date },
        card_bg: {
          type: "image",
          image: {
            url: `https://placehold.co/100x100/${event.color}/${event.color}.png`,
          },
        },
      };

      // שלח בקשה לקנבה לייצר העתק של הריבוע עם הנתונים האלו
      const autofillResponse = await fetch(
        "https://api.canva.com/rest/v1/autofills",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            brand_template_id: templateId,
            title: `כרטיס לוח שנה - ${event.name} (${event.date})`,
            data: dataPayload,
          }),
        },
      );

      if (!autofillResponse.ok) {
        const errText = await autofillResponse.text();
        console.error(`שגיאה בייצור הכרטיס עבור ${event.name}:`, errText);
        continue; // ממשיכים לכרטיס הבא כדי לא לתקוע את שאר הריצה
      }

      // המתנה של 200 מילי-שניות בין פניות כדי לשמור על יציבות ולא לעבור את מגבלת הקצב של קנבה
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    // 5. ניקוי העוגייה הזמנית עם סיום התהליך
    cookieStore.delete("pending_calendar_events");

    // 6. הפניית המשתמש ישירות לעמוד הפרויקטים שלו בקנבה, שם כל הריבועים הקטנים מוכנים
    return NextResponse.redirect("https://www.canva.com/your-projects");
  } catch (error) {
    console.error("Callback Server Error:", error);
    return new NextResponse("שגיאת שרת פנימית בתהליך ה-Callback", {
      status: 500,
    });
  }
}
