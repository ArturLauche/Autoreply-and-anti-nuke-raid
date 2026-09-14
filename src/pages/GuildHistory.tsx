import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { usePaginatedQuery, useQuery } from "convex/react";
import {
  ArrowLeft,
  CalendarDays,
  ChevronDown,
  Filter,
  Loader2,
  Search,
  ShieldAlert,
  X,
} from "lucide-react";
import { api } from "../../convex/_generated/api";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { discordGuildIconUrl, getSessionToken } from "../lib/discord";
import { ANTINUKE_MODULE_META, ANTINUKE_ORDER, PUNISH_LABEL } from "../lib/constants";
import type { GuildData } from "../lib/types";

function formatDateTime(ts: number): string {
  return new Date(ts).toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Convert an <input type="date"> value ("YYYY-MM-DD") to a UTC timestamp. */
function dateToTs(d: string, endOfDay: boolean): number | undefined {
  if (!d) return undefined;
  const [y, m, day] = d.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, day));
  if (endOfDay) date.setUTCHours(23, 59, 59, 999);
  return date.getTime();
}

export default function GuildHistory() {
  const { guildId = "" } = useParams();
  const token = getSessionToken();

  const [filterModule, setFilterModule] = useState<string>("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const guild = useQuery(api.guilds.getGuild, { token, guildId }) as GuildData | null | undefined;
  const { results, status, loadMore } = usePaginatedQuery(
    api.reports.historyForGuild,
    {
      token,
      guildId,
      module: filterModule === "all" ? undefined : filterModule,
      from: dateToTs(fromDate, false),
      to: dateToTs(toDate, true),
      search: debouncedSearch.trim() || undefined,
    },
    { initialNumItems: 20 },
  );

  if (guild === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }
  if (guild === null) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background">
        <p className="font-display text-lg font-semibold">Không thể truy cập server này</p>
        <Link to="/dashboard" className="text-sm text-primary hover:underline">
          ← Về danh sách server
        </Link>
      </div>
    );
  }

  const icon = discordGuildIconUrl({ id: guild.guild.discordId, icon: guild.guild.icon });
  const loading = status === "LoadingFirstPage" || status === "LoadingMore";
  const hasActiveFilter =
    filterModule !== "all" || fromDate !== "" || toDate !== "" || debouncedSearch.trim() !== "";

  function clearFilters() {
    setFilterModule("all");
    setFromDate("");
    setToDate("");
    setSearch("");
    setDebouncedSearch("");
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-border/60 bg-white/60 backdrop-blur">
        <div className="container py-6">
          <div className="flex flex-wrap items-center gap-4">
            <Link
              to={`/dashboard/${guild.guild.discordId}`}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            {icon ? (
              <img src={icon} alt="" className="h-11 w-11 rounded-xl" />
            ) : (
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-secondary font-display font-bold text-muted-foreground">
                {guild.guild.name.slice(0, 2).toUpperCase()}
              </span>
            )}
            <div>
              <h1 className="font-display text-xl font-bold tracking-tight">Lịch sử chống nuke</h1>
              <p className="text-sm text-muted-foreground">{guild.guild.name}</p>
            </div>
            <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
              <CalendarDays className="h-4 w-4" />
              {results.length} sự kiện đã hiển thị
            </div>
          </div>
        </div>
      </header>

      <main className="container py-8">
        <div className="grid gap-3 rounded-xl border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="grid gap-1.5">
            <Label className="text-xs text-muted-foreground">Module</Label>
            <Select value={filterModule} onValueChange={setFilterModule}>
              <SelectTrigger>
                <SelectValue placeholder="Tất cả module" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả module</SelectItem>
                {ANTINUKE_ORDER.map((m) => (
                  <SelectItem key={m} value={m}>
                    {ANTINUKE_MODULE_META[m].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs text-muted-foreground">Từ ngày</Label>
            <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs text-muted-foreground">Đến ngày</Label>
            <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs text-muted-foreground">Tìm theo tên thủ phạm</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Tên Discord…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </div>

        {hasActiveFilter && (
          <div className="mt-3 flex items-center justify-between">
            <Badge variant="secondary" className="gap-1">
              <Filter className="h-3 w-3" /> Đang lọc kết quả
            </Badge>
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <X className="h-3.5 w-3.5" /> Xóa bộ lọc
            </Button>
          </div>
        )}

        {results.length === 0 && status !== "LoadingFirstPage" ? (
          <Card className="mt-4 border-dashed">
            <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <ShieldAlert className="h-6 w-6" />
              </span>
              <p className="max-w-sm text-sm text-muted-foreground">
                {hasActiveFilter
                  ? "Không có sự kiện nào khớp với bộ lọc hiện tại."
                  : "Chưa có sự kiện chống nuke nào được ghi nhận."}
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card className="mt-4">
            <CardContent className="divide-y divide-border p-0">
              {results.map((e) => (
                <div
                  key={`${e.createdAt}-${e.module}`}
                  className="flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-accent/40"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-danger/10 text-danger">
                    <ShieldAlert className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">
                        {ANTINUKE_MODULE_META[e.module]?.label ?? e.module}
                      </p>
                      <Badge variant="outline">
                        {e.count} lượt · ngưỡng {e.threshold} trong {e.windowSeconds}s
                      </Badge>
                      <Badge variant="secondary">{PUNISH_LABEL[e.punish] ?? e.punish}</Badge>
                    </div>
                    <p className="mt-0.5 truncate text-sm text-muted-foreground">
                      {e.action}
                      {e.executorName
                        ? ` · thủ phạm ${e.executorName}`
                        : e.executorId
                          ? ` · thủ phạm <@${e.executorId}>`
                          : ""}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                    {formatDateTime(e.createdAt)}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <div className="mt-6 flex flex-col items-center gap-3">
          {status === "CanLoadMore" && (
            <Button variant="secondary" onClick={() => loadMore(20)} disabled={loading}>
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
              Tải thêm sự kiện
            </Button>
          )}
          {status === "Exhausted" && results.length > 0 && (
            <p className="text-xs text-muted-foreground">
              — Đã hiển thị toàn bộ {results.length} sự kiện —
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
