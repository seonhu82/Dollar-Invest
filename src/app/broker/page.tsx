"use client";

import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useState, useEffect } from "react";
import { useBridgeStore } from "@/stores/bridgeStore";
import {
  Link2,
  Check,
  X,
  Download,
  RefreshCw,
  Building2,
  Laptop,
  Globe,
  Unlink,
  Loader2,
} from "lucide-react";

interface BrokerAccount {
  id: string;
  broker: string;
  accountNo: string;
  accountAlias: string;
  lastSyncAt: string | null;
  portfolios: {
    id: string;
    name: string;
    currency: string;
    balance: number;
  }[];
}

export default function BrokerPage() {
  const { connected, hanaConnected, version, checkStatus, isChecking } = useBridgeStore();

  const [accounts, setAccounts] = useState<BrokerAccount[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);

  // 하나증권 연동 폼
  const [hanaAccountNo, setHanaAccountNo] = useState("");
  const [hanaAlias, setHanaAlias] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState("");
  const [syncing, setSyncing] = useState<string | null>(null);

  // 한국투자증권 폼
  const [kisAppKey, setKisAppKey] = useState("");
  const [kisAppSecret, setKisAppSecret] = useState("");
  const [kisAccountNo, setKisAccountNo] = useState("");
  const [kisAlias, setKisAlias] = useState("");
  const [kisConnecting, setKisConnecting] = useState(false);
  const [kisConnectError, setKisConnectError] = useState("");

  // PC 브릿지 다운로드
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    checkStatus();
    fetchAccounts();
  }, []);

  const fetchAccounts = async () => {
    try {
      const res = await fetch("/api/broker-accounts");
      const data = await res.json();
      setAccounts(data.accounts || []);
    } catch {
      // 무시
    } finally {
      setLoadingAccounts(false);
    }
  };

  const handleHanaConnect = async () => {
    if (!hanaAccountNo) {
      setConnectError("계좌번호를 입력해주세요.");
      return;
    }

    setConnecting(true);
    setConnectError("");

    try {
      const res = await fetch("/api/bridge/hana/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountNo: hanaAccountNo,
          accountAlias: hanaAlias || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error);
      }

      setHanaAccountNo("");
      setHanaAlias("");
      await checkStatus();
      await fetchAccounts();
    } catch (err) {
      setConnectError(err instanceof Error ? err.message : "연결에 실패했습니다.");
    } finally {
      setConnecting(false);
    }
  };

  const handleSync = async (accountId: string) => {
    setSyncing(accountId);
    try {
      const res = await fetch("/api/bridge/hana/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brokerAccountId: accountId }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error);
      }

      alert(data.message);
      await fetchAccounts();
    } catch (err) {
      alert(err instanceof Error ? err.message : "동기화에 실패했습니다.");
    } finally {
      setSyncing(null);
    }
  };

  const handleDisconnect = async (accountId: string) => {
    if (!confirm("이 계정 연동을 해제하시겠습니까?")) return;

    try {
      const res = await fetch(`/api/broker-accounts?id=${accountId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        await fetchAccounts();
      }
    } catch {
      alert("연동 해제에 실패했습니다.");
    }
  };

  const handleKisConnect = async () => {
    if (!kisAppKey || !kisAppSecret || !kisAccountNo) {
      setKisConnectError("모든 필드를 입력해주세요.");
      return;
    }

    setKisConnecting(true);
    setKisConnectError("");

    try {
      const res = await fetch("/api/bridge/kis/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appKey: kisAppKey,
          appSecret: kisAppSecret,
          accountNo: kisAccountNo,
          accountAlias: kisAlias || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error);
      }

      setKisAppKey("");
      setKisAppSecret("");
      setKisAccountNo("");
      setKisAlias("");
      await fetchAccounts();
      alert("한국투자증권 연동이 완료되었습니다.");
    } catch (err) {
      setKisConnectError(err instanceof Error ? err.message : "연동에 실패했습니다.");
    } finally {
      setKisConnecting(false);
    }
  };

  const handleKisSync = async (accountId: string) => {
    setSyncing(accountId);
    try {
      const res = await fetch("/api/bridge/kis/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brokerAccountId: accountId }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error);
      }

      alert(data.message);
      await fetchAccounts();
    } catch (err) {
      alert(err instanceof Error ? err.message : "동기화에 실패했습니다.");
    } finally {
      setSyncing(null);
    }
  };

  const handleBridgeDownload = async () => {
    setDownloading(true);
    try {
      const res = await fetch("/api/bridge/download", {
        method: "POST",
      });

      if (!res.ok) {
        throw new Error("다운로드에 실패했습니다.");
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "dollar-invest-bridge-readme.txt";
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      alert(err instanceof Error ? err.message : "다운로드에 실패했습니다.");
    } finally {
      setDownloading(false);
    }
  };

  const hanaAccounts = accounts.filter((a) => a.broker === "HANA");
  const kisAccounts = accounts.filter((a) => a.broker === "KIS");

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">증권사 연동</h1>
          <p className="text-muted-foreground">
            증권사를 연동하여 자동으로 거래하고 잔고를 동기화하세요
          </p>
        </div>

        {/* 연동 방식 안내 */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Laptop className="h-5 w-5 text-primary" />
                <CardTitle className="text-base">PC 브릿지</CardTitle>
              </div>
              <CardDescription>하나증권 연동용</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                PC에서 브릿지 프로그램을 실행하여 하나증권 API와 연동합니다.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Globe className="h-5 w-5 text-primary" />
                <CardTitle className="text-base">REST API</CardTitle>
              </div>
              <CardDescription>한국투자증권 연동용</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                웹에서 직접 한국투자증권 API와 연동합니다.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-muted-foreground" />
                <CardTitle className="text-base">수동 입력</CardTitle>
              </div>
              <CardDescription>API 없이 사용</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                증권사 연동 없이 거래 내역을 직접 입력합니다.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* 연동된 계정 목록 */}
        {accounts.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>연동된 계정</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {loadingAccounts ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                accounts.map((account) => (
                  <div
                    key={account.id}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div className="flex items-center gap-4">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        <Building2 className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">
                          {account.broker === "HANA" ? "하나증권" : "한국투자증권"}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {account.accountAlias} ({account.accountNo})
                        </p>
                        {account.lastSyncAt && (
                          <p className="text-xs text-muted-foreground">
                            마지막 동기화:{" "}
                            {new Date(account.lastSyncAt).toLocaleString("ko-KR")}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {account.broker === "HANA" && connected && hanaConnected && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleSync(account.id)}
                          disabled={syncing === account.id}
                        >
                          {syncing === account.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <RefreshCw className="h-4 w-4" />
                          )}
                          <span className="ml-1">동기화</span>
                        </Button>
                      )}
                      {account.broker === "KIS" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleKisSync(account.id)}
                          disabled={syncing === account.id}
                        >
                          {syncing === account.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <RefreshCw className="h-4 w-4" />
                          )}
                          <span className="ml-1">동기화</span>
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDisconnect(account.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Unlink className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        )}

        {/* 하나증권 */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  하나증권
                </CardTitle>
                <CardDescription>PC 브릿지를 통한 1Q Open API 연동</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                {connected ? (
                  hanaConnected ? (
                    <span className="flex items-center gap-1 text-sm text-green-600">
                      <Check className="h-4 w-4" />
                      로그인됨
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-sm text-yellow-600">
                      <Check className="h-4 w-4" />
                      브릿지 연결됨
                    </span>
                  )
                ) : (
                  <span className="flex items-center gap-1 text-sm text-muted-foreground">
                    <X className="h-4 w-4" />
                    연결 안됨
                  </span>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={checkStatus}
                  disabled={isChecking}
                >
                  <RefreshCw className={`h-4 w-4 ${isChecking ? "animate-spin" : ""}`} />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {connected ? (
              <>
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Check className="h-6 w-6 text-green-600" />
                    <div>
                      <p className="font-medium text-green-800">PC 브릿지 연결됨</p>
                      <p className="text-sm text-green-700">버전: {version || "알 수 없음"}</p>
                    </div>
                  </div>
                </div>

                {hanaConnected ? (
                  <div className="p-4 bg-secondary rounded-lg">
                    <p className="font-medium">하나증권 로그인됨</p>
                    <p className="text-sm text-muted-foreground">
                      거래 및 잔고 동기화가 가능합니다.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <p className="font-medium text-yellow-800">하나증권 연동이 필요합니다</p>
                      <p className="text-sm text-yellow-700">
                        브릿지 프로그램에서 하나증권에 로그인한 후, 아래에서 계좌를 연동하세요.
                      </p>
                    </div>

                    {connectError && (
                      <div className="p-3 text-sm text-red-600 bg-red-50 rounded-lg">
                        {connectError}
                      </div>
                    )}

                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <label className="text-sm font-medium mb-2 block">계좌번호</label>
                        <Input
                          placeholder="123-12-123456"
                          value={hanaAccountNo}
                          onChange={(e) => setHanaAccountNo(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-2 block">별칭 (선택)</label>
                        <Input
                          placeholder="예: 달러 투자 계좌"
                          value={hanaAlias}
                          onChange={(e) => setHanaAlias(e.target.value)}
                        />
                      </div>
                    </div>

                    <Button
                      className="w-full"
                      onClick={handleHanaConnect}
                      disabled={connecting}
                    >
                      {connecting ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Link2 className="h-4 w-4 mr-2" />
                      )}
                      하나증권 연동하기
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <div className="space-y-4">
                <div className="p-4 bg-secondary rounded-lg">
                  <h4 className="font-medium mb-2">PC 브릿지 설치 방법</h4>
                  <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                    <li>아래 버튼을 클릭하여 브릿지 프로그램을 다운로드합니다.</li>
                    <li>다운로드한 파일을 실행하여 설치합니다.</li>
                    <li>브릿지 프로그램을 실행하고 하나증권에 로그인합니다.</li>
                    <li>이 페이지에서 연결 상태를 확인합니다.</li>
                  </ol>
                </div>

                <Button className="w-full" onClick={handleBridgeDownload} disabled={downloading}>
                  {downloading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4 mr-2" />
                  )}
                  PC 브릿지 다운로드
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 한국투자증권 */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  한국투자증권
                </CardTitle>
                <CardDescription>KIS Developers REST API 연동</CardDescription>
              </div>
              {kisAccounts.length > 0 ? (
                <span className="flex items-center gap-1 text-sm text-green-600">
                  <Check className="h-4 w-4" />
                  연결됨
                </span>
              ) : (
                <span className="flex items-center gap-1 text-sm text-muted-foreground">
                  <X className="h-4 w-4" />
                  연결 안됨
                </span>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-secondary rounded-lg">
              <h4 className="font-medium mb-2">연동 방법</h4>
              <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                <li>
                  <a
                    href="https://apiportal.koreainvestment.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    KIS Developers
                  </a>
                  에서 회원가입 및 앱 등록을 합니다.
                </li>
                <li>발급받은 App Key와 App Secret을 입력합니다.</li>
                <li>계좌번호를 입력하고 연동을 완료합니다.</li>
              </ol>
            </div>

            <div className="space-y-4">
              {kisConnectError && (
                <div className="p-3 text-sm text-red-600 bg-red-50 rounded-lg">
                  {kisConnectError}
                </div>
              )}

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm font-medium mb-2 block">App Key</label>
                  <Input
                    type="text"
                    placeholder="App Key를 입력하세요"
                    value={kisAppKey}
                    onChange={(e) => setKisAppKey(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">App Secret</label>
                  <Input
                    type="password"
                    placeholder="App Secret을 입력하세요"
                    value={kisAppSecret}
                    onChange={(e) => setKisAppSecret(e.target.value)}
                  />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm font-medium mb-2 block">계좌번호</label>
                  <Input
                    type="text"
                    placeholder="계좌번호를 입력하세요 (8자리)"
                    value={kisAccountNo}
                    onChange={(e) => setKisAccountNo(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">별칭 (선택)</label>
                  <Input
                    type="text"
                    placeholder="예: 달러 투자 계좌"
                    value={kisAlias}
                    onChange={(e) => setKisAlias(e.target.value)}
                  />
                </div>
              </div>

              <Button
                className="w-full"
                onClick={handleKisConnect}
                disabled={kisConnecting}
              >
                {kisConnecting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Link2 className="h-4 w-4 mr-2" />
                )}
                한국투자증권 연동하기
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
