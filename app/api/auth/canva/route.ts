import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST(request: Request) {
  try {
    const { events } = await request.json();

    if (!events) {
      return NextResponse.json(
        { error: "לא התקבלו נתוני אירועים" },
        { status: 400 },
      );
    }

    const clientId = process.env.CANVA_CLIENT_ID;
    if (!clientId) {
      return NextResponse.json(
        { error: "CANVA_CLIENT_ID חסר בשרת" },
        { status: 500 },
      );
    }

    // שמירת הנתונים בעוגייה זמנית למשך 5 דקות
    const cookieStore = await cookies();
    cookieStore.set("pending_calendar_events", JSON.stringify(events), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 300, 
      path: "/",
    });

    // ה-Redirect URI הרשמי שהגדרת בפורטל המפתחים
    const redirectUri = "http://127.0.0.1:3000/api/auth/canva/callback";
    
    // ה-Scopes המעודכנים התואמים בול למה שסימנת בממשק של קנבה
    const scope = "brandtemplate:content:read design:content:write";

    const canvaAuthUrl =
      `https://www.canva.com/api/oauth/authorize?` +
      new URLSearchParams({
        response_type: "code",
        client_id: clientId,
        redirect_uri: redirectUri,
        scope: scope,
      }).toString();

    return NextResponse.json({ url: canvaAuthUrl });
  } catch (error) {
    console.error("Auth Error:", error);
    return NextResponse.json({ error: "שגיאה פנימית בשרת" }, { status: 500 });
  }
}