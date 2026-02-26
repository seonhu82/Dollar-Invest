import { NextResponse } from "next/server";
import * as XLSX from "xlsx";

// GET: 엑셀 양식 다운로드
export async function GET() {
  try {
    const headers = ["거래일자", "구분", "금액", "환율", "수수료", "메모"];
    const exampleData = [
      ["2026-02-26", "매수", 100, 1435.3, 0, "첫 매수"],
      ["2026-02-25", "매도", 50, 1440.0, 500, "차익실현"],
    ];

    const wsData = [headers, ...exampleData];
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // 열 너비 설정
    ws["!cols"] = [
      { wch: 14 }, // 거래일자
      { wch: 8 },  // 구분
      { wch: 12 }, // 금액
      { wch: 12 }, // 환율
      { wch: 10 }, // 수수료
      { wch: 20 }, // 메모
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "거래내역");

    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    return new NextResponse(buf, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": "attachment; filename=trade_template.xlsx",
      },
    });
  } catch (error) {
    console.error("양식 생성 오류:", error);
    return NextResponse.json({ error: "양식 생성에 실패했습니다." }, { status: 500 });
  }
}
