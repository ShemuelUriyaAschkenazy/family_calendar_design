import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { imageBase64, userEmail } = await request.json();

    if (!imageBase64) {
      return NextResponse.json({ error: "No image data provided" }, { status: 400 });
    }

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Resend API key is missing on the server" }, { status: 500 });
    }

    // ניקוי ה-Prefix של ה-Base64 כדי לקבל רק את תוכן הקובץ הנקי
    const base64Content = imageBase64.split(",")[1];

    // שליחת הבקשה ישירות ל-API של Resend ללא צורך בהתקנת ה-SDK שלהם
    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: "בונה לוחות תאריכים חרות בלב<onboarding@resend.dev>", // כתובת ברירת המחדל של Resend לבדיקות
        to: userEmail || "herut.photo@gmail.com", // המייל שאליו יישלח העותק (תוכל לשנות לדיפולט שלך)
        subject: "🎨 הגרסה הסופית של לוח השנה המשפחתי שלך!",
        html: `
          <div style="font-family: sans-serif; direction: rtl; text-align: right; padding: 20px;">
            <h2>הידד! לוח השנה שלך מוכן 📆</h2>
            <p>מצורף למייל זה צילום מסך של הגרסה הסופית והצבעים שקבעת ללוח השנה.</p>
            <p>תוכל להשתמש בצילום זה כנקודת ייחוס או להשוואת הגוונים בכל שלב.</p>
          </div>
        `,
        attachments: [
          {
            content: base64Content,
            filename: "calendar-preview.png",
          },
        ],
      }),
    });

    if (!resendResponse.ok) {
      const errorData = await resendResponse.json();
      return NextResponse.json({ error: errorData.message || "Failed to send email via Resend" }, { status: resendResponse.status });
    }

    return NextResponse.json({ success: true, message: "Email sent successfully!" });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}