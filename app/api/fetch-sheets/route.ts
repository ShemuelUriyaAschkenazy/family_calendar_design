import { NextResponse } from 'next/server';
import Papa from 'papaparse';

function extractSheetId(url: string): string | null {
  const matches = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
  return matches ? matches[1] : null;
}

async function fetchTabUrl(sheetId: string, tabName: string): Promise<any[]> {
  const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tabName)}`;
  
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`נכשל במשיכת הטאב: ${tabName}`);
  
  const csvText = await response.text();
  const parsed = Papa.parse(csvText, {
    header: true,
    skipEmptyLines: true
  });
  
  return parsed.data;
}

export async function POST(request: Request) {
  try {
    const { sheetUrl } = await request.json();
    const sheetId = extractSheetId(sheetUrl);
    
    if (!sheetId) {
      return NextResponse.json({ error: 'קישור גוגל שיטס לא תקין' }, { status: 400 });
    }

    const [gregorianData, hebrewData] = await Promise.all([
      fetchTabUrl(sheetId, 'לוח לועזי'),
      fetchTabUrl(sheetId, 'לוח עברי')
    ]);

    return NextResponse.json({
      gregorian: gregorianData,
      hebrew: hebrewData
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'שגיאה פנימית בשרת' }, { status: 500 });
  }
}