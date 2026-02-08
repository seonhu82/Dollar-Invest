"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Wallet } from "lucide-react";
import Link from "next/link";

const currencies = [
  { code: "USD", name: "미국 달러", flag: "🇺🇸" },
  { code: "EUR", name: "유로", flag: "🇪🇺" },
  { code: "JPY", name: "일본 엔", flag: "🇯🇵" },
  { code: "CNY", name: "중국 위안", flag: "🇨🇳" },
  { code: "GBP", name: "영국 파운드", flag: "🇬🇧" },
];

export default function NewPortfolioPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [name, setName] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [description, setDescription] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/portfolios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, currency, description }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "포트폴리오 생성에 실패했습니다.");
      }

      router.push("/portfolio");
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 뒤로가기 */}
        <Link
          href="/portfolio"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          포트폴리오 목록
        </Link>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5" />
              새 포트폴리오 만들기
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="p-3 text-sm text-red-600 bg-red-50 rounded-lg">
                  {error}
                </div>
              )}

              {/* 이름 */}
              <div className="space-y-2">
                <Label htmlFor="name">포트폴리오 이름</Label>
                <Input
                  id="name"
                  placeholder="예: 달러 적금, 여행 자금"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  maxLength={50}
                />
              </div>

              {/* 통화 선택 */}
              <div className="space-y-2">
                <Label>통화</Label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {currencies.map((c) => (
                    <button
                      key={c.code}
                      type="button"
                      onClick={() => setCurrency(c.code)}
                      className={`p-3 rounded-lg border text-left transition-colors ${
                        currency === c.code
                          ? "border-primary bg-primary/5"
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{c.flag}</span>
                        <div>
                          <div className="font-medium text-sm">{c.code}</div>
                          <div className="text-xs text-muted-foreground">
                            {c.name}
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* 설명 */}
              <div className="space-y-2">
                <Label htmlFor="description">설명 (선택)</Label>
                <Input
                  id="description"
                  placeholder="포트폴리오에 대한 간단한 설명"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  maxLength={200}
                />
              </div>

              {/* 버튼 */}
              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => router.back()}
                >
                  취소
                </Button>
                <Button type="submit" className="flex-1" disabled={loading}>
                  {loading ? "생성 중..." : "포트폴리오 만들기"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
