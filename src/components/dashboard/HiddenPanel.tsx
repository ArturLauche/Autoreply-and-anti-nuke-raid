import { Lock } from "lucide-react";
import AutoReplyPanel from "./AutoReplyPanel";
import DmPanel from "./DmPanel";
import GiveawayPanel from "./GiveawayPanel";
import ReactionRolesPanel from "./ReactionRolesPanel";
import type { GuildData } from "../../lib/types";

export default function HiddenPanel({ data }: { data: GuildData }) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
          <Lock className="h-4 w-4 text-primary" /> Tính năng ẩn — dành cho admin
        </h2>
        <p className="text-sm text-muted-foreground">
          Reaction role, giveaway, gửi DM trực tiếp và auto reply — chỉ xuất hiện sau khi
          mở khóa bằng mật khẩu.
        </p>
      </div>
      <ReactionRolesPanel data={data} />
      <GiveawayPanel data={data} />
      <DmPanel data={data} />
      <AutoReplyPanel data={data} />
    </div>
  );
}
