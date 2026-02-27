import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_PUBLIC_URL } } });
async function main() {
  // 모든 거래 확인
  const allTx = await prisma.transaction.findMany({ orderBy: { tradedAt: "desc" }, include: { portfolio: { select: { name: true, currency: true } } } });
  console.log(`전체 거래 수: ${allTx.length}\n`);

  // 통화별 그룹
  const currencies = [...new Set(allTx.map(t => t.currency))];
  for (const cur of currencies) {
    const txs = allTx.filter(t => t.currency === cur);
    console.log(`=== ${cur} 거래 (${txs.length}건) ===`);
    for (const t of txs) {
      const rateCheck = cur === "JPY" ? (Number(t.rate) > 100 ? " ⚠️ 100엔당으로 저장됨!" : " ✅ 1엔당") : "";
      console.log(`  ${t.id.slice(-8)} | ${t.type} | ${Number(t.amount)} | rate=${Number(t.rate)}${rateCheck} | krw=${Number(t.krwAmount)} | ${t.tradedAt.toISOString().split("T")[0]} | isManual=${t.isManual} | ${t.memo || ""}`);
    }
    console.log();
  }

  // 포트폴리오 확인
  const allPortfolios = await prisma.portfolio.findMany();
  console.log(`=== 포트폴리오 (${allPortfolios.length}개) ===`);
  for (const p of allPortfolios) {
    const rateCheck = p.currency === "JPY" ? (Number(p.avgBuyRate) > 100 ? " ⚠️" : " ✅") : "";
    console.log(`  ${p.name} | ${p.currency} | balance=${Number(p.currentBalance)} | avgBuyRate=${Number(p.avgBuyRate)}${rateCheck} | invested=${Number(p.totalInvested)}`);
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());
