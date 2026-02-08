import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { verifyCredentials, saveKISCredentials } from "@/lib/kis";
import { z } from "zod";

const connectSchema = z.object({
  appKey: z.string().min(1, "App Key를 입력해주세요."),
  appSecret: z.string().min(1, "App Secret을 입력해주세요."),
  accountNo: z.string().min(1, "계좌번호를 입력해주세요."),
  accountAlias: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const body = await request.json();
    const validation = connectSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    const { appKey, appSecret, accountNo, accountAlias } = validation.data;

    // 자격 증명 검증
    const isValid = await verifyCredentials({
      appKey,
      appSecret,
      accountNo,
    });

    if (!isValid) {
      return NextResponse.json(
        { error: "API 인증에 실패했습니다. App Key와 App Secret을 확인해주세요." },
        { status: 400 }
      );
    }

    // 자격 증명 저장
    const accountId = await saveKISCredentials(
      session.user.id,
      { appKey, appSecret, accountNo },
      accountAlias
    );

    return NextResponse.json({
      success: true,
      accountId,
      message: "한국투자증권 연동이 완료되었습니다.",
    });
  } catch (error) {
    console.error("KIS 연동 오류:", error);

    if (error instanceof Error && error.message === "이미 연동된 계좌입니다.") {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: "연동에 실패했습니다. 잠시 후 다시 시도해주세요." },
      { status: 500 }
    );
  }
}
