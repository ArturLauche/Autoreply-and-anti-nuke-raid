import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Badge } from "../ui/badge";
import { BarChart3, Shield, Flame, Users, TrendingUp } from "lucide-react";

interface AnalyticsPanelProps {
  token: string;
  guildId: string;
}

const MODULE_COLORS: Record<string, string> = {
  massBan: "bg-foreground",
  massKick: "bg-foreground/80",
  massChannelCreate: "bg-foreground/60",
  massChannelDelete: "bg-foreground/50",
  massRoleCreate: "bg-foreground/70",
  massRoleDelete: "bg-foreground/55",
  spam: "bg-foreground/40",
  raid: "bg-foreground",
  externalAppRaid: "bg-foreground/85",
};

const MODULE_LABELS: Record<string, string> = {
  massBan: "Ban hàng loạt",
  massKick: "Kick hàng loạt",
  massChannelCreate: "Tạo kênh",
  massChannelDelete: "Xóa kênh",
  massRoleCreate: "Tạo role",
  massRoleDelete: "Xóa role",
  massChannelRename: "Đổi tên kênh",
  massRoleEdit: "Sửa role",
  massNickname: "Đổi nickname",
  massRoleAssign: "Gán role",
  adminSelfGrant: "Tự cấp quyền",
  massBotAdd: "Thêm bot",
  botHitAndRun: "Bot hit-and-run",
  suspiciousBotAlert: "Bot lạ",
  massInviteCreate: "Tạo invite",
  guildTamper: "Đổi cấu hình",
  spam: "Spam",
  massJoin: "Raid thành viên",
  externalAppRaid: "Raid app ngoài",
};

export default function AnalyticsPanel({ token, guildId }: AnalyticsPanelProps) {
  const analytics = useQuery(api.audit.getGuildAnalytics, { token, guildId });
  const backupAnalytics = useQuery(api.audit.getBackupAnalytics, { token, guildId });

  if (analytics === undefined || analytics === null) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent mx-auto" />
        </CardContent>
      </Card>
    );
  }

  const maxEvents = Math.max(1, ...Object.values(analytics.eventsByDay));

  return (
    <div className="space-y-4">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4 text-center">
            <Users className="h-5 w-5 text-primary mx-auto mb-1" />
            <div className="text-2xl font-bold">{analytics.memberCount.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">Thành viên</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Shield className="h-5 w-5 text-foreground mx-auto mb-1" />
            <div className="text-2xl font-bold">{analytics.antinukeEvents7d}</div>
            <div className="text-xs text-muted-foreground">Anti-nuke (7 ngày)</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <TrendingUp className="h-5 w-5 text-foreground mx-auto mb-1" />
            <div className="text-2xl font-bold">{analytics.modActions7d}</div>
            <div className="text-xs text-muted-foreground">Mod actions (7 ngày)</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Flame className="h-5 w-5 text-foreground mx-auto mb-1" />
            <div className="text-2xl font-bold">{analytics.topHeat.length}</div>
            <div className="text-xs text-muted-foreground">Đang có nhiệt</div>
          </CardContent>
        </Card>
      </div>

      {/* Events by Module */}
      {Object.keys(analytics.eventsByModule).length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <BarChart3 className="h-5 w-5" />
              Sự kiện theo module (7 ngày)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {Object.entries(analytics.eventsByModule)
              .sort(([, a], [, b]) => b - a)
              .map(([module, count]) => (
                <div key={module} className="flex items-center gap-2">
                  <span className="text-xs w-32 truncate text-muted-foreground">
                    {MODULE_LABELS[module] ?? module}
                  </span>
                  <div className="flex-1 h-4 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${MODULE_COLORS[module] ?? "bg-gray-500"}`}
                      style={{ width: `${(count / maxEvents) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs font-mono w-8 text-right">{count}</span>
                </div>
              ))}
          </CardContent>
        </Card>
      )}

      {/* Mod Actions by Type */}
      {Object.keys(analytics.modByType).length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Moderation (7 ngày)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {Object.entries(analytics.modByType)
                .sort(([, a], [, b]) => b - a)
                .map(([type, count]) => (
                  <Badge key={type} variant="outline" className="gap-1">
                    <span className="capitalize">{type}</span>
                    <span className="text-muted-foreground">×{count}</span>
                  </Badge>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Top Heat Users */}
      {analytics.topHeat.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Flame className="h-5 w-5 text-foreground" />
              Top nhiệt độ
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {analytics.topHeat.map((h, i) => (
              <div key={h.userId} className="flex items-center gap-3 text-sm">
                <span className="text-muted-foreground w-6 text-right">#{i + 1}</span>
                <span className="flex-1 truncate font-medium">{h.username}</span>
                <div className="flex items-center gap-1">
                  <div
                    className="h-3 rounded-full"
                    style={{
                      width: `${h.heat}px`,
                      minWidth: "4px",
                      // Thang xám theo độ đậm; chỉ mức nguy hiểm cao nhất dùng
                      // --danger (token đỏ dành cho trạng thái phạt, không phải trang trí)
                      backgroundColor:
                        h.heat > 70
                          ? "hsl(var(--danger))"
                          : h.heat > 40
                            ? "hsl(var(--foreground))"
                            : h.heat > 25
                              ? "hsl(var(--muted-foreground))"
                              : "hsl(var(--border))",
                    }}
                  />
                  <span className="text-xs font-mono">{h.heat}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Backup Stats */}
      {backupAnalytics && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Backup</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tổng backup:</span>
              <span className="font-medium">{backupAnalytics.total}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tự động:</span>
              <span className="font-medium">
                {backupAnalytics.autoDays > 0 ? `Mỗi ${backupAnalytics.autoDays} ngày` : "Tắt"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Lần cuối:</span>
              <span className="font-medium">
                {backupAnalytics.lastBackupAt
                  ? new Date(backupAnalytics.lastBackupAt).toLocaleString("vi-VN")
                  : "Chưa backup"}
              </span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
