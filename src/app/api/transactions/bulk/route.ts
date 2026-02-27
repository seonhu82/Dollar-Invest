import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";

interface ParsedRow {
  rowNum: number;
  tradedAt: string;
  type: "BUY" | "SELL";
  amount: number;
  rate: number;
  fee: number;
  memo: string;
  entryRate: number | null;
  error?: string;
}

// 포트폴리오 재계산
async function recalculatePortfolio(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  portfolioId: string
) {
  const allTransactions = await tx.transaction.findMany({
    where: { portfolioId },
    orderBy: { tradedAt: "asc" },
  });

  let balance = 0;
  let totalCost = 0;
  let totalInvested = 0;
  let totalRealizedPnl = 0;

  for (const t of allTransactions) {
    const amount = Number(t.amount);
    const rate = Number(t.rate);
    const krwAmount = Number(t.krwAmount);

    if (t.type === "BUY") {
      totalCost += amount * rate;
      balance += amount;
      totalInvested += krwAmount;
    } else {
      const avgRate = balance > 0 ? totalCost / balance : 0;
      totalCost -= amount * avgRate;
      balance -= amount;
      totalInvested =
        balance > 0 ? totalInvested * (balance / (balance + amount)) : 0;
      if (t.realizedPnl !== null) {
        totalRealizedPnl += Number(t.realizedPnl);
      }
    }
  }

  const avgBuyRate = balance > 0 ? totalCost / balance : 0;

  await tx.portfolio.update({
    where: { id: portfolioId },
    data: {
      currentBalance: balance,
      avgBuyRate,
      totalInvested,
      totalRealizedPnl,
    },
  });
}

// POST: 엑셀 일괄 등록
export async function POST(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "로그인이 필요합니다." },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const portfolioId = formData.get("portfolioId") as string | null;

    if (!file) {
      return NextResponse.json(
        { error: "파일을 선택해주세요." },
        { status: 400 }
      );
    }

    if (!portfolioId) {
      return NextResponse.json(
        { error: "포트폴리오를 선택해주세요." },
        { status: 400 }
      );
    }

    // 포트폴리오 소유권 확인
    const portfolio = await prisma.portfolio.findFirst({
      where: { id: portfolioId, userId: session.user.id },
    });

    if (!portfolio) {
      return NextResponse.json(
        { error: "포트폴리오를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    // 엑셀 파싱
    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(buffer, { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]];

    if (!ws) {
      return NextResponse.json(
        { error: "엑셀 시트를 읽을 수 없습니다." },
        { status: 400 }
      );
    }

    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws);

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "데이터가 없습니다. 양식에 맞게 작성해주세요." },
        { status: 400 }
      );
    }

    if (rows.length > 500) {
      return NextResponse.json(
        { error: "한 번에 최대 500건까지 등록할 수 있습니다." },
        { status: 400 }
      );
    }

    // 행별 파싱 및 검증
    const parsed: ParsedRow[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2; // 헤더가 1행이므로 데이터는 2행부터

      const rawDate = row["거래일자"];
      const rawType = row["구분"];
      const rawAmount = row["금액"];
      const rawRate = row["환율"];
      const rawFee = row["수수료"];
      const rawMemo = row["메모"];
      const rawEntryRate = row["진입가"];

      // 거래일자 파싱
      let tradedAt = "";
      if (!rawDate) {
        parsed.push({ rowNum, tradedAt: "", type: "BUY", amount: 0, rate: 0, fee: 0, memo: "", entryRate: null, error: "거래일자가 없습니다" });
        continue;
      }

      if (typeof rawDate === "number") {
        // 엑셀 시리얼 날짜 변환
        const date = XLSX.SSF.parse_date_code(rawDate);
        tradedAt = `${date.y}-${String(date.m).padStart(2, "0")}-${String(date.d).padStart(2, "0")}`;
      } else {
        tradedAt = String(rawDate).trim();
      }

      // 날짜 형식 검증
      if (!/^\d{4}-\d{2}-\d{2}$/.test(tradedAt) || isNaN(new Date(tradedAt).getTime())) {
        parsed.push({ rowNum, tradedAt, type: "BUY", amount: 0, rate: 0, fee: 0, memo: "", entryRate: null, error: "날짜 형식이 올바르지 않습니다 (YYYY-MM-DD)" });
        continue;
      }

      // 구분 파싱
      const typeStr = String(rawType || "").trim();
      let type: "BUY" | "SELL";
      if (typeStr === "매수" || typeStr.toUpperCase() === "BUY") {
        type = "BUY";
      } else if (typeStr === "매도" || typeStr.toUpperCase() === "SELL") {
        type = "SELL";
      } else {
        parsed.push({ rowNum, tradedAt, type: "BUY", amount: 0, rate: 0, fee: 0, memo: "", entryRate: null, error: "구분은 '매수' 또는 '매도'로 입력해주세요" });
        continue;
      }

      // 금액 파싱
      const amount = Number(rawAmount);
      if (!amount || amount <= 0) {
        parsed.push({ rowNum, tradedAt, type, amount: 0, rate: 0, fee: 0, memo: "", entryRate: null, error: "금액은 0보다 큰 숫자여야 합니다" });
        continue;
      }

      // 환율 파싱
      const rate = Number(rawRate);
      if (!rate || rate <= 0) {
        parsed.push({ rowNum, tradedAt, type, amount, rate: 0, fee: 0, memo: "", entryRate: null, error: "환율은 0보다 큰 숫자여야 합니다" });
        continue;
      }

      // 수수료 파싱
      const fee = Number(rawFee) || 0;
      if (fee < 0) {
        parsed.push({ rowNum, tradedAt, type, amount, rate, fee: 0, memo: "", entryRate: null, error: "수수료는 0 이상이어야 합니다" });
        continue;
      }

      // 메모
      const memo = rawMemo ? String(rawMemo).trim().slice(0, 200) : "";

      // 진입가 파싱 (매도 행에만 적용)
      let entryRate: number | null = null;
      if (type === "SELL" && rawEntryRate) {
        const parsedEntryRate = Number(rawEntryRate);
        if (parsedEntryRate > 0) {
          entryRate = parsedEntryRate;
        }
      }

      parsed.push({ rowNum, tradedAt, type, amount, rate, fee, memo, entryRate });
    }

    // 에러 있는 행 확인
    const errors = parsed.filter((r) => r.error);
    const valid = parsed.filter((r) => !r.error);

    if (valid.length === 0) {
      return NextResponse.json({
        success: false,
        message: "등록 가능한 데이터가 없습니다.",
        total: parsed.length,
        successCount: 0,
        errorCount: errors.length,
        errors: errors.map((e) => ({ row: e.rowNum, error: e.error })),
      });
    }

    // DB 일괄 저장
    await prisma.$transaction(async (tx) => {
      for (const item of valid) {
        const krwAmount = item.amount * item.rate + item.fee;
        const realizedPnl = item.entryRate !== null
          ? (item.rate - item.entryRate) * item.amount
          : null;

        await tx.transaction.create({
          data: {
            userId: session.user.id,
            portfolioId,
            type: item.type,
            currency: portfolio.currency,
            amount: item.amount,
            rate: item.rate,
            krwAmount,
            fee: item.fee,
            memo: item.memo || null,
            tradedAt: new Date(item.tradedAt),
            isManual: true,
            entryRate: item.entryRate,
            realizedPnl,
          },
        });
      }

      // 포트폴리오 재계산
      await recalculatePortfolio(tx, portfolioId);
    });

    return NextResponse.json({
      success: true,
      message: `${valid.length}건 등록 완료${errors.length > 0 ? `, ${errors.length}건 오류` : ""}`,
      total: parsed.length,
      successCount: valid.length,
      errorCount: errors.length,
      errors: errors.map((e) => ({ row: e.rowNum, error: e.error })),
    });
  } catch (error) {
    console.error("일괄 등록 오류:", error);
    return NextResponse.json(
      { error: "일괄 등록에 실패했습니다." },
      { status: 500 }
    );
  }
}
