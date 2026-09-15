import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const {
      imageBase64,
      userEmail,
      familyName,
      birthdayColors = [],
      anniversaryColor,
      useFourthColor,
    } = await request.json();

    if (!imageBase64) {
      return NextResponse.json({ error: "No image data provided" }, { status: 400 });
    }

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Resend API key is missing on the server" }, { status: 500 });
    }

    const base64Content = imageBase64.split(",")[1];

    // סינון הצבעים הפעילים בלבד (אם צבע רביעי כבוי, נציג רק 3)
    const activeBirthdayColors = useFourthColor
      ? birthdayColors
      : birthdayColors.slice(0, 3);

    // בניית רשימת הצבעים ב-HTML עם ריבועי תצוגה
    const colorsListHtml = `
      <div style="margin-top: 20px; padding: 15px; background-color: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0;">
        <h3 style="margin-top: 0; color: #334155; font-size: 16px;">🎨 קודי הצבעים (HEX) שנקבעו ללוח:</h3>
        <ul style="list-style: none; padding: 0; margin: 0;">
          ${activeBirthdayColors
            .map(
              (color: string, idx: number) => `
            <li style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
              <span style="display: inline-block; width: 18px; height: 18px; background-color: ${color}; border-radius: 50%; border: 1px solid #cbd5e1;"></span>
              <span><strong>צבע יום הולדת ${idx + 1}:</strong> <code style="background: #e2e8f0; padding: 2px 6px; border-radius: 4px;">${color}</code></span>
            </li>
          `
            )
            .join("")}
          ${
            anniversaryColor
              ? `
            <li style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px; margin-top: 12px; border-top: 1px dashed #cbd5e1; padding-top: 8px;">
              <span style="display: inline-block; width: 18px; height: 18px; background-color: ${anniversaryColor}; border-radius: 50%; border: 1px solid #cbd5e1;"></span>
              <span><strong>צבע יום נישואין (לב):</strong> <code style="background: #e2e8f0; padding: 2px 6px; border-radius: 4px;">${anniversaryColor}</code></span>
            </li>
          `
              : ""
          }
        </ul>
      </div>
    `;

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: "בונה לוחות תאריכים חרות בלב<onboarding@resend.dev>",
        to: userEmail || "herut.photo@gmail.com",
        subject: `🎨 הגרסה הסופית של לוח השנה - ${familyName || "משפחתי"}!`,
        html: `
          <div style="font-family: Arial, sans-serif; direction: rtl; text-align: right; padding: 20px; color: #1e293b;">
            <h2>הידד! לוח השנה עבור ${familyName || "המשפחה"} מוכן 📆</h2>
            <p>מצורף למייל זה צילום מסך של הגרסה הסופית והצבעים שקבעת ללוח השנה.</p>
            
            ${colorsListHtml}

            <p style="margin-top: 20px; font-size: 13px; color: #64748b;">תוכל להשתמש בצילום ובקודי הצבעים כנקודת ייחוס לעבודה ב-Canva או בהדפסה.</p>
          </div>
        `,
        attachments: [
          {
            content: base64Content,
            filename: `calendar-preview-${familyName || "family"}.png`,
          },
        ],
      }),
    });

    if (!resendResponse.ok) {
      const errorData = await resendResponse.json();
      return NextResponse.json(
        { error: errorData.message || "Failed to send email via Resend" },
        { status: resendResponse.status }
      );
    }

    return NextResponse.json({ success: true, message: "Email sent successfully!" });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}