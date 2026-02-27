"use client";

import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { formatKRW, formatRate } from "@/lib/utils";
import {
  ArrowLeft,
  Download,
  Upload,
  FileSpreadsheet,
  Check,
  AlertCircle,
  Loader2,
  X,
  Info,
} from "lucide-react";
import Link from "next/link";

interface Portfolio {
  id: string;
  name: string;
  currency: string;
}

interface ParsedRow {
  rowNum: number;
  tradedAt: string;
  type: string;
  amount: number;
  rate: number;
  fee: number;
  memo: string;
  krwAmount: number;
  entryRate: number | null;
  error?: string;
}

interface BulkResult {
  success: boolean;
  message: string;
  total: number;
  successCount: number;
  errorCount: number;
  errors: { row: number; error: string }[];
}

export default function ImportPage() {
  const router = useRouter();

  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [portfolioId, setPortfolioId] = useState("");
  const [loading, setLoading] = useState(true);

  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [isParsing, setIsParsing] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<BulkResult | null>(null);
  const [error, setError] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchPortfolios = async () => {
      try {
        const res = await fetch("/api/portfolios");
        const data = await res.json();
        setPortfolios(data.portfolios || []);
        if (data.portfolios?.length > 0) {
          setPortfolioId(data.portfolios[0].id);
        }
      } catch {
        setError("포트폴리오를 불러오는데 실패했습니다.");
      } finally {
        setLoading(false);
      }
    };
    fetchPortfolios();
  }, []);

  const handleDownloadTemplate = () => {
    window.location.href = "/api/transactions/bulk/template";
  };

  const parseFile = async (selectedFile: File) => {
    setFile(selectedFile);
    setIsParsing(true);
    setError("");
    setResult(null);

    try {
      const XLSX = await import("xlsx");
      const buffer = await selectedFile.arrayBuffer();
      const wb = XLSX.read(buffer, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];

      if (!ws) {
        setError("엑셀 시트를 읽을 수 없습니다.");
        setParsedRows([]);
        return;
      }

      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws);

      if (rows.length === 0) {
        setError("데이터가 없습니다. 양식에 맞게 작성해주세요.");
        setParsedRows([]);
        return;
      }

      if (rows.length > 500) {
        setError("한 번에 최대 500건까지 등록할 수 있습니다.");
        setParsedRows([]);
        return;
      }

      const parsed: ParsedRow[] = [];

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const rowNum = i + 2;

        const rawDate = row["거래일자"];
        const rawType = row["구분"];
        const rawAmount = row["금액"];
        const rawRate = row["환율"];
        const rawFee = row["수수료"];
        const rawMemo = row["메모"];
        const rawEntryRate = row["진입가"];

        // 거래일자
        let tradedAt = "";
        if (!rawDate) {
          parsed.push({ rowNum, tradedAt: "", type: "", amount: 0, rate: 0, fee: 0, memo: "", krwAmount: 0, entryRate: null, error: "거래일자가 없습니다" });
          continue;
        }
        if (typeof rawDate === "number") {
          const XLSXSSF = XLSX.SSF;
          const date = XLSXSSF.parse_date_code(rawDate);
          tradedAt = `${date.y}-${String(date.m).padStart(2, "0")}-${String(date.d).padStart(2, "0")}`;
        } else {
          tradedAt = String(rawDate).trim();
        }
        if (!/^\d{4}-\d{2}-\d{2}$/.test(tradedAt) || isNaN(new Date(tradedAt).getTime())) {
          parsed.push({ rowNum, tradedAt, type: "", amount: 0, rate: 0, fee: 0, memo: "", krwAmount: 0, entryRate: null, error: "날짜 형식 오류 (YYYY-MM-DD)" });
          continue;
        }

        // 구분
        const typeStr = String(rawType || "").trim();
        let type: string;
        if (typeStr === "매수" || typeStr.toUpperCase() === "BUY") {
          type = "매수";
        } else if (typeStr === "매도" || typeStr.toUpperCase() === "SELL") {
          type = "매도";
        } else {
          parsed.push({ rowNum, tradedAt, type: typeStr, amount: 0, rate: 0, fee: 0, memo: "", krwAmount: 0, entryRate: null, error: "'매수' 또는 '매도'를 입력해주세요" });
          continue;
        }

        // 금액
        const amount = Number(rawAmount);
        if (!amount || amount <= 0) {
          parsed.push({ rowNum, tradedAt, type, amount: 0, rate: 0, fee: 0, memo: "", krwAmount: 0, entryRate: null, error: "금액은 0보다 큰 숫자여야 합니다" });
          continue;
        }

        // 환율
        const rate = Number(rawRate);
        if (!rate || rate <= 0) {
          parsed.push({ rowNum, tradedAt, type, amount, rate: 0, fee: 0, memo: "", krwAmount: 0, entryRate: null, error: "환율은 0보다 큰 숫자여야 합니다" });
          continue;
        }

        // 수수료
        const fee = Number(rawFee) || 0;
        if (fee < 0) {
          parsed.push({ rowNum, tradedAt, type, amount, rate, fee: 0, memo: "", krwAmount: 0, entryRate: null, error: "수수료는 0 이상이어야 합니다" });
          continue;
        }

        const memo = rawMemo ? String(rawMemo).trim().slice(0, 200) : "";
        const krwAmount = amount * rate + fee;

        // 진입가 파싱 (매도 행에만 적용)
        let entryRate: number | null = null;
        if (type === "매도" && rawEntryRate) {
          const parsedEntryRate = Number(rawEntryRate);
          if (parsedEntryRate > 0) {
            entryRate = parsedEntryRate;
          }
        }

        parsed.push({ rowNum, tradedAt, type, amount, rate, fee, memo, krwAmount, entryRate });
      }

      setParsedRows(parsed);
    } catch {
      setError("파일을 읽을 수 없습니다. 올바른 엑셀 파일(.xlsx)인지 확인해주세요.");
      setParsedRows([]);
    } finally {
      setIsParsing(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) parseFile(selected);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dropZoneRef.current?.classList.remove("border-blue-500", "bg-blue-50");

    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) parseFile(droppedFile);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dropZoneRef.current?.classList.add("border-blue-500", "bg-blue-50");
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dropZoneRef.current?.classList.remove("border-blue-500", "bg-blue-50");
  };

  const handleClear = () => {
    setFile(null);
    setParsedRows([]);
    setResult(null);
    setError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const validRows = parsedRows.filter((r) => !r.error);
  const errorRows = parsedRows.filter((r) => r.error);

  const handleSubmit = async () => {
    if (!portfolioId || validRows.length === 0 || !file) return;

    setIsSubmitting(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("portfolioId", portfolioId);

      const res = await fetch("/api/transactions/bulk", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "일괄 등록에 실패했습니다.");
      }

      setResult(data);

      if (data.success) {
        setTimeout(() => {
          router.push("/trade");
        }, 2000);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "일괄 등록에 실패했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f4f4f5]">
        <Header />
        <main className="max-w-4xl mx-auto px-4 py-8">
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f4f4f5]">
      <Header />
      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* 상단 */}
        <div className="flex items-center space-x-4 mb-6">
          <Link href="/trade">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-1" />
              뒤로
            </Button>
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">거래 내역 일괄 등록</h1>
        </div>

        {/* 안내 */}
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Info className="h-4 w-4" />
              사용 방법
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-gray-600 space-y-1">
            <p>1. 아래 양식 다운로드 버튼으로 엑셀 양식을 받습니다.</p>
            <p>2. 양식에 맞게 거래 내역을 작성합니다.</p>
            <p>3. 작성한 파일을 업로드하고 미리보기를 확인합니다.</p>
            <p>4. 등록 버튼을 눌러 일괄 등록합니다.</p>
          </CardContent>
        </Card>

        {/* 포트폴리오 선택 + 양식 다운로드 */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  포트폴리오 선택
                </label>
                <select
                  value={portfolioId}
                  onChange={(e) => setPortfolioId(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                >
                  {portfolios.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.currency})
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-end">
                <Button
                  variant="outline"
                  onClick={handleDownloadTemplate}
                  className="whitespace-nowrap"
                >
                  <Download className="h-4 w-4 mr-2" />
                  양식 다운로드
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 파일 업로드 */}
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">파일 업로드</CardTitle>
            <CardDescription>엑셀 파일(.xlsx)을 선택하거나 드래그하세요</CardDescription>
          </CardHeader>
          <CardContent>
            {!file ? (
              <div
                ref={dropZoneRef}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-gray-300 rounded-lg p-10 text-center cursor-pointer hover:border-gray-400 transition-colors"
              >
                {isParsing ? (
                  <Loader2 className="h-10 w-10 mx-auto text-gray-400 animate-spin" />
                ) : (
                  <>
                    <Upload className="h-10 w-10 mx-auto text-gray-400 mb-3" />
                    <p className="text-sm text-gray-600">
                      클릭하거나 파일을 끌어다 놓으세요
                    </p>
                    <p className="text-xs text-gray-400 mt-1">.xlsx 파일만 지원</p>
                  </>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>
            ) : (
              <div className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-3">
                <div className="flex items-center gap-3">
                  <FileSpreadsheet className="h-5 w-5 text-green-600" />
                  <div>
                    <p className="text-sm font-medium">{file.name}</p>
                    <p className="text-xs text-gray-500">
                      {parsedRows.length}건 (정상 {validRows.length}건
                      {errorRows.length > 0 && `, 오류 ${errorRows.length}건`})
                    </p>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={handleClear}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 에러 메시지 */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
            <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* 미리보기 테이블 */}
        {parsedRows.length > 0 && !result && (
          <Card className="mb-6">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">미리보기</CardTitle>
              <CardDescription>
                총 {parsedRows.length}건 중 {validRows.length}건 등록 가능
                {errorRows.length > 0 && (
                  <span className="text-red-500 ml-1">
                    ({errorRows.length}건 오류)
                  </span>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="pb-2 pr-3 font-medium text-gray-500">행</th>
                      <th className="pb-2 pr-3 font-medium text-gray-500">거래일자</th>
                      <th className="pb-2 pr-3 font-medium text-gray-500">구분</th>
                      <th className="pb-2 pr-3 font-medium text-gray-500 text-right">금액</th>
                      <th className="pb-2 pr-3 font-medium text-gray-500 text-right">환율</th>
                      <th className="pb-2 pr-3 font-medium text-gray-500 text-right">수수료</th>
                      <th className="pb-2 pr-3 font-medium text-gray-500 text-right">원화금액</th>
                      <th className="pb-2 pr-3 font-medium text-gray-500 text-right">진입가</th>
                      <th className="pb-2 font-medium text-gray-500">메모</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedRows.map((row, idx) => (
                      <tr
                        key={idx}
                        className={`border-b last:border-0 ${
                          row.error ? "bg-red-50" : ""
                        }`}
                      >
                        <td className="py-2 pr-3 text-gray-400">{row.rowNum}</td>
                        <td className="py-2 pr-3">{row.tradedAt || "-"}</td>
                        <td className="py-2 pr-3">
                          {row.type ? (
                            <span
                              className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                                row.type === "매수"
                                  ? "bg-blue-100 text-blue-700"
                                  : row.type === "매도"
                                  ? "bg-red-100 text-red-700"
                                  : "bg-gray-100 text-gray-700"
                              }`}
                            >
                              {row.type}
                            </span>
                          ) : (
                            "-"
                          )}
                        </td>
                        <td className="py-2 pr-3 text-right">
                          {row.amount > 0 ? row.amount.toLocaleString() : "-"}
                        </td>
                        <td className="py-2 pr-3 text-right">
                          {row.rate > 0 ? formatRate(row.rate) : "-"}
                        </td>
                        <td className="py-2 pr-3 text-right">
                          {row.fee > 0 ? formatKRW(row.fee) : "0"}
                        </td>
                        <td className="py-2 pr-3 text-right">
                          {row.krwAmount > 0 ? formatKRW(row.krwAmount) : "-"}
                        </td>
                        <td className="py-2 pr-3 text-right tabular-nums">
                          {row.type === "매도" && row.entryRate ? formatRate(row.entryRate) : "-"}
                        </td>
                        <td className="py-2 max-w-[120px] truncate">
                          {row.error ? (
                            <span className="text-red-600 text-xs flex items-center gap-1">
                              <AlertCircle className="h-3 w-3 flex-shrink-0" />
                              {row.error}
                            </span>
                          ) : (
                            row.memo || ""
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* 등록 버튼 */}
              <div className="mt-6 flex justify-end">
                <Button
                  onClick={handleSubmit}
                  disabled={isSubmitting || validRows.length === 0}
                  className="min-w-[140px]"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      등록 중...
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4 mr-2" />
                      {validRows.length}건 등록하기
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 결과 */}
        {result && (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-4">
                {result.success ? (
                  <>
                    <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                      <Check className="h-6 w-6 text-green-600" />
                    </div>
                    <p className="text-lg font-medium text-gray-900 mb-1">
                      {result.message}
                    </p>
                    <p className="text-sm text-gray-500">
                      잠시 후 거래 내역 페이지로 이동합니다...
                    </p>
                  </>
                ) : (
                  <>
                    <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3">
                      <AlertCircle className="h-6 w-6 text-red-600" />
                    </div>
                    <p className="text-lg font-medium text-gray-900 mb-1">
                      {result.message}
                    </p>
                  </>
                )}

                {result.errors.length > 0 && (
                  <div className="mt-4 text-left bg-red-50 rounded-lg p-4">
                    <p className="text-sm font-medium text-red-700 mb-2">
                      오류 목록
                    </p>
                    {result.errors.map((e, idx) => (
                      <p key={idx} className="text-xs text-red-600">
                        {e.row}행: {e.error}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
