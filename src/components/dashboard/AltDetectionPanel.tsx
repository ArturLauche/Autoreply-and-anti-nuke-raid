import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import {
  AlertTriangle,
  Fingerprint,
  Globe,
  ShieldAlert,
  ShieldCheck,
  Skull,
  UserX,
  Users,
} from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { Card, CardContent } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Switch } from "../ui/switch";
import type { GuildData } from "../../lib/types";
import { getSessionToken } from "../../lib/discord";

const TOKEN = () => getSessionToken();

const PUNISH_OPTIONS = [
  { value: "kick", label: "Kick", icon: UserX, color: "text-foreground" },
  { value: "ban", label: "Ban", icon: Skull, color: "text-danger" },
  { value: "timeout", label: "Timeout", icon: AlertTriangle, color: "text-foreground" },
  { value: "verify", label: "Re-verify", icon: ShieldCheck, color: "text-muted-foreground" },
] as const;

const VPN_MODES = [
  { value: "off", label: "Tat", desc: "Khong kiem tra VPN" },
  { value: "warn", label: "Canh bao", desc: "Ghi log VPN nhung khong chan" },
  { value: "strict", label: "Nghiem ngat", desc: "Chan VPN/Proxy ngay lap tuc" },
] as const;

function riskColor(score: number) {
  if (score >= 70) return "bg-danger/10 text-danger border-danger/30";
  if (score >= 40) return "bg-foreground/10 text-foreground border-foreground/30";
  if (score >= 20) return "bg-secondary text-foreground border-border";
  return "bg-secondary text-muted-foreground border-border";
}

function riskLabel(score: number) {
  if (score >= 70) return "Cao";
  if (score >= 40) return "Trung binh";
  if (score >= 20) return "Thap";
  return "An toan";
}

function formatAge(createdAt: number) {
  const days = Math.floor((Date.now() - createdAt) / 86_400_000);
  if (days < 1) return "hom nay";
  if (days === 1) return "1 ngay";
  if (days < 30) return `${days} ngay`;
  if (days < 365) return `${Math.floor(days / 30)} thang`;
  return `${Math.floor(days / 365)} nam`;
}

type AltConfigData = Record<string, any>;
type AltJoinData = Record<string, any>;
type AltStatsData = Record<string, any>;

export default function AltDetectionPanel({ data }: { data: GuildData }) {
  const token = TOKEN();
  const guildId = data.guild.discordId;

  const altConfig = useQuery(api.altDetection.getAltConfig, { token, guildId }) as
    AltConfigData | null | undefined;
  const recentJoins = useQuery(api.altDetection.getRecentJoins, { token, guildId, limit: 50 }) as
    AltJoinData[] | null | undefined;
  const altStats = useQuery(api.altDetection.getAltStats, { token, guildId }) as
    AltStatsData | null | undefined;

  const updateConfig = useMutation(api.altDetection.updateAltConfig);

  const [saving, setSaving] = useState(false);

  const enabled = altConfig?.altDetectionEnabled ?? false;
  const currentPunish = altConfig?.altPunish ?? "kick";
  const maxRisk = altConfig?.altMaxRiskScore ?? 70;
  const currentVpnMode = altConfig?.altVpnMode ?? "off";
  const safeMode = altConfig?.altSafeMode ?? true;

  async function toggleEnabled() {
    setSaving(true);
    try {
      await updateConfig({ token, guildId, altDetectionEnabled: !enabled });
      toast.success(enabled ? "Da tat alt detection" : "Da bat alt detection");
    } catch (e: unknown) {
      toast.error((e as Error).message);
    }
    setSaving(false);
  }

  async function setPunish(punish: string) {
    setSaving(true);
    try {
      await updateConfig({
        token,
        guildId,
        altPunish: punish as "kick" | "ban" | "timeout" | "verify",
      });
      toast.success(`Da doi hinh phat thanh ${punish}`);
    } catch (e: unknown) {
      toast.error((e as Error).message);
    }
    setSaving(false);
  }

  async function setThreshold(value: number) {
    setSaving(true);
    try {
      await updateConfig({ token, guildId, altMaxRiskScore: value });
      toast.success(`Nguong rui ro: ${value}/100`);
    } catch (e: unknown) {
      toast.error((e as Error).message);
    }
    setSaving(false);
  }

  async function setSafeMode(v: boolean) {
    setSaving(true);
    try {
      await updateConfig({ token, guildId, altSafeMode: v });
      toast.success(
        v
          ? "Đã bật chế độ an toàn — chỉ phạt khi có đủ bằng chứng"
          : "Đã tắt chế độ an toàn — phạt theo điểm rủi ro",
      );
    } catch (e: unknown) {
      toast.error((e as Error).message);
    }
    setSaving(false);
  }

  async function setVpnMode(mode: string) {
    setSaving(true);
    try {
      await updateConfig({
        token,
        guildId,
        altVpnMode: mode as "strict" | "warn" | "off",
        vpnBlockEnabled: mode === "strict",
      });
      toast.success(`Che do VPN: ${mode}`);
    } catch (e: unknown) {
      toast.error((e as Error).message);
    }
    setSaving(false);
  }

  const joins = recentJoins ?? [];

  return (
    <div className="space-y-5">
      {/* Header + Toggle */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="flex items-center gap-2 text-lg font-bold text-foreground">
            <Fingerprint className="h-5 w-5 text-primary" />
            Alt Account + VPN Detection
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Phat hien va chan alt account, VPN/Proxy khi thanh vien moi tham gia server.
          </p>
        </div>
        <Switch checked={enabled} onCheckedChange={toggleEnabled} disabled={saving} />
      </div>

      {/* Stats Cards */}
      {altStats && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Users className="h-3 w-3" /> Luot join (7 ngay)
              </p>
              <p className="text-2xl font-bold mt-1">{altStats.totalJoins7d ?? 0}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <ShieldAlert className="h-3 w-3 text-danger" /> Rui ro cao
              </p>
              <p className="text-2xl font-bold mt-1 text-danger">{altStats.highRiskCount ?? 0}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Globe className="h-3 w-3 text-muted-foreground" /> VPN/Proxy
              </p>
              <p className="text-2xl font-bold mt-1">{altStats.vpnCount ?? 0}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <AlertTriangle className="h-3 w-3 text-muted-foreground" /> Tai khoan moi
              </p>
              <p className="text-2xl font-bold mt-1">
                {altStats.newAccountCount ?? 0}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Configuration */}
      <Card>
        <CardContent className="p-5 space-y-5">
          <h4 className="font-semibold text-foreground">Cau hinh</h4>

          {/* Punish */}
          <div>
            <label className="text-sm font-medium text-foreground mb-2 block">Hinh phat</label>
            <div className="flex flex-wrap gap-2">
              {PUNISH_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                return (
                  <Button
                    key={opt.value}
                    size="sm"
                    variant={currentPunish === opt.value ? "default" : "outline"}
                    onClick={() => setPunish(opt.value)}
                    disabled={saving}
                  >
                    <Icon className={`h-3.5 w-3.5 mr-1.5 ${opt.color}`} />
                    {opt.label}
                  </Button>
                );
              })}
            </div>
          </div>

          {/* Threshold */}
          <div>
            <label className="text-sm font-medium text-foreground mb-2 block">
              Nguong rui ro: <span className="text-primary font-bold">{maxRisk}/100</span>
            </label>
            <input
              type="range"
              min={10}
              max={100}
              value={maxRisk}
              onChange={(e) => setThreshold(parseInt(e.target.value))}
              className="w-full accent-primary"
              disabled={saving}
            />
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>10 (nghiem ngat)</span>
              <span>100 (long le)</span>
            </div>
          </div>

          {/* VPN Mode */}
          <div>
            <label className="text-sm font-medium text-foreground mb-2 block">
              Che do VPN/Proxy
            </label>
            <div className="flex flex-wrap gap-2">
              {VPN_MODES.map((mode) => {
                return (
                  <Button
                    key={mode.value}
                    size="sm"
                    variant={currentVpnMode === mode.value ? "default" : "outline"}
                    onClick={() => setVpnMode(mode.value)}
                    disabled={saving}
                  >
                    {mode.label}
                    <span className="ml-1.5 text-xs text-muted-foreground hidden sm:inline">
                      -- {mode.desc}
                    </span>
                  </Button>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              ⚠️ Discord không cung cấp địa chỉ IP của thành viên cho bot, nên việc phát hiện
              VPN/Proxy trực tiếp là không khả thi với dữ liệu hiện tại. Hệ thống tập trung vào phát
              hiện alt account bằng bằng chứng hành vi (tuổi tài khoản, tên/avatar trùng, lịch sử bị
              phạt, join cluster) — đây là cách chặn account lạm dụng VPN hiệu quả nhất mà Discord
              cho phép.
            </p>
          </div>

          {/* Safe Mode */}
          <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-background/50 px-4 py-3">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-foreground">
                <ShieldCheck className="h-4 w-4" />
              </span>
              <div>
                <p className="text-sm font-semibold">Chế độ an toàn (chống chặn nhầm)</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Chỉ phạt khi có <b>đủ bằng chứng độc lập</b>: 2+ tín hiệu mạnh → phạt đúng cấu
                  hình; 1 tín hiệu → hạ cấp nhẹ hơn (ban → kick, kick → timeout); 0 tín hiệu → chỉ
                  theo dõi. Tắt để phạt theo điểm rủi ro như cũ (dễ chặn nhầm hơn).
                </p>
              </div>
            </div>
            <Switch checked={safeMode} onCheckedChange={setSafeMode} disabled={saving} />
          </div>
        </CardContent>
      </Card>

      {/* Recent Joins */}
      <Card>
        <CardContent className="p-5">
          <h4 className="font-semibold text-foreground mb-4">Luot join gan day ({joins.length})</h4>
          {joins.length === 0 ? (
            <p className="text-sm text-muted-foreground">Chua co du lieu join nao.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="pb-2 pr-4">Thanh vien</th>
                    <th className="pb-2 pr-4 text-center">Rui ro</th>
                    <th className="pb-2 pr-4 text-center">Bang chung</th>
                    <th className="pb-2 pr-4 text-center">Xu ly</th>
                    <th className="pb-2 pr-4 text-center">Tuoi</th>
                    <th className="pb-2 pr-4 text-center">VPN</th>
                    <th className="pb-2">Yeu to</th>
                  </tr>
                </thead>
                <tbody>
                  {joins.map((j) => {
                    const riskScore = j.riskScore ?? 0;
                    return (
                      <tr key={j._id} className="border-b last:border-0">
                        <td className="py-2.5 pr-4">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-foreground">{j.username}</span>
                            <code className="text-xs text-muted-foreground">
                              ({(j.userId ?? "").slice(0, 8)}...)
                            </code>
                          </div>
                        </td>
                        <td className="py-2.5 pr-4 text-center">
                          <span
                            className={`inline-block rounded-full border px-2 py-0.5 text-xs font-bold ${riskColor(riskScore)}`}
                          >
                            {riskScore} -- {riskLabel(riskScore)}
                          </span>
                        </td>
                        <td className="py-2.5 pr-4 text-center">
                          <span
                            className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-xs font-bold ${(j.strongSignals ?? 0) >= 2 ? "bg-danger/10 text-danger border border-danger/30" : (j.strongSignals ?? 0) === 1 ? "bg-foreground/10 text-foreground border border-foreground/30" : "bg-muted text-muted-foreground border border-border"}`}
                          >
                            {j.strongSignals ?? 0}
                          </span>
                        </td>
                        <td className="py-2.5 pr-4 text-center">
                          {j.action && j.action !== "pass" ? (
                            <Badge
                              variant="outline"
                              className="text-[10px] text-danger border-danger/30"
                            >
                              {j.action}
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">--</span>
                          )}
                        </td>
                        <td className="py-2.5 pr-4 text-center text-muted-foreground text-xs">
                          {formatAge(j.createdAt)}
                        </td>
                        <td className="py-2.5 pr-4 text-center">
                          {j.isVPN ? (
                            <Badge
                              variant="outline"
                              className="text-[10px] text-danger border-danger/30"
                            >
                              VPN
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">--</span>
                          )}
                        </td>
                        <td className="py-2.5">
                          <div className="flex flex-wrap gap-1">
                            {(j.riskFactors ?? []).map((f: string, i: number) => (
                              <Badge
                                key={i}
                                variant="outline"
                                className="text-[10px] text-muted-foreground"
                              >
                                {f}
                              </Badge>
                            ))}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Top Risk Factors */}
      {altStats?.topFactors && (
        <Card>
          <CardContent className="p-5">
            <h4 className="font-semibold text-foreground mb-3">Yeu to rui ro pho bien</h4>
            <div className="space-y-2">
              {(altStats.topFactors as Array<[string, number]>).map(([factor, count]) => (
                <div key={factor} className="flex items-center gap-3">
                  <span className="text-sm text-foreground min-w-[160px]">{factor}</span>
                  <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all"
                      style={{ width: `${Math.min(100, count * 10)}%` }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground w-8 text-right">{count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
