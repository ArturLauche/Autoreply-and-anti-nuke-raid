import { Gavel, ShieldCheck } from "lucide-react";
import { Badge } from "../ui/badge";
import { Card, CardContent } from "../ui/card";
import type { GuildData } from "../../lib/types";

const ACTION_STYLE: Record<string, string> = {
  "⏱️ Timeout": "bg-amber-500/15 text-amber-500",
  "👢 Kick": "bg-orange-500/15 text-orange-500",
  "🚫 Ban": "bg-danger/15 text-danger",
  "🧹 Purge": "bg-sky-500/15 text-sky-500",
};

function styleFor(action: string): string {
  if (action.includes("Timeout")) return ACTION_STYLE["⏱️ Timeout"];
  if (action.includes("Kick")) return ACTION_STYLE["👢 Kick"];
  if (action.includes("Ban")) return ACTION_STYLE["🚫 Ban"];
  if (action.includes("Purge")) return ACTION_STYLE["🧹 Purge"];
  return "bg-violet-500/15 text-violet-500";
}

function labelFor(action: string): string {
  if (action.includes("Tự động")) return `⚡ ${action.replace("Tự động: ", "")}`;
  return action;
}

export default function ModActionsPanel({ data }: { data: GuildData }) {
  const actions = data.modActions ?? [];

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 font-display font-semibold">
              <Gavel className="h-4 w-4 text-primary" /> Bảng hình phạt
            </h3>
            <p className="text-sm text-muted-foreground">
              Timeout · kick · ban · purge — ghi tự động kèm lý do và người thực hiện
              (cả hình phạt tự động từ hệ thống chống nuke).
            </p>
          </div>
          <Badge variant="secondary">{actions.length} hành động gần nhất</Badge>
        </div>

        {actions.length === 0 ? (
          <div className="mt-4 flex items-center gap-3 rounded-lg bg-secondary/40 px-3 py-3 text-sm text-muted-foreground">
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
            Chưa có hình phạt nào — mọi thứ đang yên bình 🎉
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">Thời gian</th>
                  <th className="py-2 pr-3 font-medium">Hình phạt</th>
                  <th className="py-2 pr-3 font-medium">Thành viên</th>
                  <th className="py-2 pr-3 font-medium">Người thực hiện</th>
                  <th className="py-2 pr-3 font-medium">Lý do</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {actions.map((a) => (
                  <tr key={a._id} className="align-top">
                    <td className="py-2.5 pr-3 whitespace-nowrap text-xs text-muted-foreground">
                      {new Date(a.createdAt).toLocaleString("vi-VN", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="py-2.5 pr-3">
                      <Badge className={styleFor(a.action)}>{labelFor(a.action)}</Badge>
                    </td>
                    <td className="py-2.5 pr-3">
                      <p className="font-medium">{a.targetName || a.targetId || "—"}</p>
                      {a.targetId && (
                        <p className="font-mono text-[10px] text-muted-foreground">{a.targetId}</p>
                      )}
                    </td>
                    <td className="py-2.5 pr-3">
                      <p className="text-muted-foreground">{a.executorName || a.executorId || "Bot tự động"}</p>
                    </td>
                    <td className="py-2.5 pr-3 text-muted-foreground">
                      <p>{a.reason || a.details || "Không có"}</p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
