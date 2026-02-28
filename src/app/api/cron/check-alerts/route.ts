import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getExchangeRates } from "@/lib/exchange";
import { getDisplayRate } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * GET /api/cron/check-alerts
 *
 * 모든 활성 알림을 현재 환율과 비교하여 조건 충족 시 AlertLog 생성.
 * - Vercel Cron (10분마다 자동 호출)
 * - 클라이언트에서 알림 페이지 방문 시 수동 호출
 * - 중복 방지: 같은 알림은 1시간 내 재발생하지 않음
 */
export async function GET(request: Request) {
  try {
    // Vercel Cron 인증 (CRON_SECRET 설정 시)
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret) {
      const authHeader = request.headers.get("authorization");
      if (authHeader !== `Bearer ${cronSecret}`) {
        // Cron이 아닌 일반 요청도 허용 (인증된 사용자용)
        // 하지만 CRON_SECRET이 설정되어 있으면 Cron 경로와 일반 경로 구분
      }
    }

    // 1. 현재 환율 조회
    const rates = await getExchangeRates();
    if (!rates || rates.length === 0) {
      return NextResponse.json({ error: "환율 데이터를 가져올 수 없습니다." }, { status: 503 });
    }

    const rateMap = new Map(rates.map((r) => [r.currency, r]));

    // 2. 모든 활성 알림 조회
    const alerts = await prisma.alert.findMany({
      where: { isActive: true },
      include: { user: { select: { id: true } } },
    });

    if (alerts.length === 0) {
      return NextResponse.json({ triggered: 0, checked: 0 });
    }

    const now = new Date();
    const ONE_HOUR = 60 * 60 * 1000;
    const triggered: string[] = [];

    // 3. 각 알림 조건 체크
    for (const alert of alerts) {
      // 중복 방지: 1시간 이내 이미 발생한 알림은 스킵
      if (alert.lastTriggeredAt && now.getTime() - alert.lastTriggeredAt.getTime() < ONE_HOUR) {
        continue;
      }

      const rateData = rateMap.get(alert.currency);
      if (!rateData) continue;

      const currentRate = rateData.rate; // 내부 저장 기준 (1단위당)
      let shouldTrigger = false;
      let title = "";
      let message = "";

      if (alert.type === "TARGET_RATE" && alert.targetRate) {
        const target = Number(alert.targetRate);
        const displayRate = getDisplayRate(alert.currency, currentRate);
        const displayTarget = getDisplayRate(alert.currency, target);

        if (alert.direction === "UP" && currentRate >= target) {
          shouldTrigger = true;
          title = `${alert.currency} 환율 ${displayTarget.toLocaleString()}원 이상 도달`;
          message = `현재 환율 ${displayRate.toLocaleString()}원으로 설정한 목표(${displayTarget.toLocaleString()}원 이상)에 도달했습니다.`;
        } else if (alert.direction === "DOWN" && currentRate <= target) {
          shouldTrigger = true;
          title = `${alert.currency} 환율 ${displayTarget.toLocaleString()}원 이하 도달`;
          message = `현재 환율 ${displayRate.toLocaleString()}원으로 설정한 목표(${displayTarget.toLocaleString()}원 이하)에 도달했습니다.`;
        }
      } else if (alert.type === "CHANGE_RATE" && alert.changeRate) {
        const threshold = Number(alert.changeRate);
        const changePercent = Math.abs(rateData.changePercent);
        const displayRate = getDisplayRate(alert.currency, currentRate);

        if (changePercent >= threshold) {
          shouldTrigger = true;
          const direction = rateData.changePercent > 0 ? "상승" : "하락";
          title = `${alert.currency} 환율 ${rateData.changePercent.toFixed(2)}% ${direction}`;
          message = `현재 환율 ${displayRate.toLocaleString()}원, 전일 대비 ${rateData.changePercent.toFixed(2)}% 변동으로 설정 기준(±${threshold}%)을 초과했습니다.`;
        }
      } else if (alert.type === "DAILY" && alert.dailyTime) {
        // 현재 KST 시간과 설정 시간 비교 (±5분 허용)
        const kst = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
        const [targetHour, targetMin] = alert.dailyTime.split(":").map(Number);
        const currentMinutes = kst.getHours() * 60 + kst.getMinutes();
        const targetMinutes = targetHour * 60 + targetMin;

        if (Math.abs(currentMinutes - targetMinutes) <= 5) {
          const displayRate = getDisplayRate(alert.currency, currentRate);
          shouldTrigger = true;
          title = `${alert.currency} 일일 환율 알림`;
          message = `현재 ${alert.currency}/KRW 환율: ${displayRate.toLocaleString()}원 (전일 대비 ${rateData.changePercent >= 0 ? "+" : ""}${rateData.changePercent.toFixed(2)}%)`;
        }
      }

      // 4. 알림 발생
      if (shouldTrigger) {
        await prisma.$transaction([
          prisma.alertLog.create({
            data: {
              userId: alert.userId,
              alertId: alert.id,
              type: alert.type,
              title,
              message,
              rate: currentRate,
            },
          }),
          prisma.alert.update({
            where: { id: alert.id },
            data: { lastTriggeredAt: now },
          }),
        ]);
        triggered.push(`${alert.currency}:${alert.type}`);
      }
    }

    return NextResponse.json({
      triggered: triggered.length,
      checked: alerts.length,
      details: triggered,
      checkedAt: now.toISOString(),
    });
  } catch (error) {
    console.error("알림 체크 오류:", error);
    return NextResponse.json({ error: "알림 체크에 실패했습니다." }, { status: 500 });
  }
}
