import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Badge } from "../ui/badge";
import { History, User, ArrowRight } from "lucide-react";

import { dateLocale, translate } from "../../lib/i18n";
interface AuditLogPanelProps {
  token: string;
  guildId: string;
}

export default function AuditLogPanel({ token, guildId }: AuditLogPanelProps) {
  const [limit, setLimit] = useState(20);
  const logs = useQuery(api.audit.getLog, { token, guildId, limit });

  if (logs === undefined) {
    return (
      <Card>
        <CardContent className="p-4 sm:p-6 text-center text-muted-foreground">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent mx-auto" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <History className="h-5 w-5" />
          {translate("Lịch sử thay đổi")}{" "}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 max-h-[500px] overflow-y-auto">
        {logs.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            {translate("Chưa có thay đổi nào được ghi nhận")}{" "}
          </p>
        )}
        {logs.map((log) => (
          <div
            key={log._id}
            className="flex items-start gap-3 rounded-lg border border-border/30 p-3 text-sm"
          >
            <div className="flex-shrink-0 mt-0.5">
              <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="h-3.5 w-3.5 text-primary" />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium">{log.executorName}</span>
                <Badge variant="outline" className="text-xs">
                  {log.action}
                </Badge>
                <span className="text-muted-foreground text-xs">
                  {new Date(log.createdAt).toLocaleString(dateLocale())}
                </span>
              </div>
              <div className="mt-1 text-muted-foreground">
                <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">
                  {log.field}
                </span>
              </div>
              {(log.oldValue || log.newValue) && (
                <div className="mt-1.5 flex items-center gap-2 text-xs">
                  {log.oldValue && (
                    <span className="line-through text-destructive/70 max-w-[200px] truncate">
                      {log.oldValue}
                    </span>
                  )}
                  {log.oldValue && log.newValue && (
                    <ArrowRight className="h-3 w-3 flex-shrink-0 text-muted-foreground" />
                  )}
                  {log.newValue && (
                    <span className="font-medium text-foreground max-w-[200px] truncate">
                      {log.newValue}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
        {logs.length >= limit && (
          <button
            onClick={() => setLimit((l) => l + 20)}
            className="w-full text-sm text-primary hover:underline py-2"
          >
            {translate("Xem thêm...")}{" "}
          </button>
        )}
      </CardContent>
    </Card>
  );
}
