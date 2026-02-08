import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getHanaBalance, getBridgeStatus } from "@/lib/bridge";

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    // 브릿지 상태 확인
    const status = await getBridgeStatus();
    if (!status.connected || !status.hanaConnected) {
      return NextResponse.json(
        { error: "하나증권에 연결되어 있지 않습니다." },
        { status: 503 }
      );
    }

    // 잔고 조회
    const result = await getHanaBalance();

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "잔고 조회에 실패했습니다." },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      balances: result.balances,
    });
  } catch (error) {
    console.error("잔고 조회 오류:", error);
    return NextResponse.json(
      { error: "잔고 조회 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
