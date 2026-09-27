// TEST: 4 nâng cấp UX web — cảnh báo chưa lưu, command palette, trạng thái
// đồng bộ, bật chống nuke hàng loạt.
// Chạy: bun scripts/test-web-ux-upgrades.ts
//
// Vì sao test: đây đều là lớp "người dùng hiểu sai" — chạy không lỗi gì nhưng
// dẫn tới mất cấu hình, tìm không ra panel, hoặc tưởng bot đã chạy cấu hình
// mới. Biên sai 1 phút / sai thứ tự tìm kiếm là hỏng mục đích.
import {
  confirmLeave,
  hasUnsavedChanges,
  setPanelDirty,
  unsavedPanelIds,
} from "../src/lib/useUnsavedChanges";
import { filterCommands, foldDiacritics, scoreCommand } from "../src/components/CommandPalette";
import { syncState, SETTINGS_APPLY_WINDOW_MS, STALE_HEARTBEAT_MS } from "../src/lib/syncState";

let pass = 0;
let fail = 0;
const check = (label: string, ok: boolean) => {
  console.log(ok ? `  ✅ ${label}` : `  ❌ ${label}`);
  if (ok) pass++;
  else fail++;
};

const T = 1_700_000_000_000;

console.log("── #1 cảnh báo chưa lưu ──");

// 1. Panel bẩn → có thay đổi chưa lưu; bỏ bẩn → sạch.
setPanelDirty("t1", true);
check("đánh dấu bẩn → có thay đổi", hasUnsavedChanges());
check("lưu danh sách panel bẩn", unsavedPanelIds().includes("t1"));
setPanelDirty("t1", false);
check("bỏ bẩn → sạch", !hasUnsavedChanges());

// 2. NHIỀU panel cùng lúc bẩn → phải giữ hết, xoá 1 không xoá nhầm cái khác.
setPanelDirty("a", true);
setPanelDirty("b", true);
setPanelDirty("a", false);
check("xoá 1 panel không xoá panel khác", hasUnsavedChanges());
check("còn đúng panel b", unsavedPanelIds().length === 1 && unsavedPanelIds()[0] === "b");
setPanelDirty("b", false);
check("xoá hết → sạch", !hasUnsavedChanges());

// 3. Đánh dấu lặp (React render nhiều lần) không nhân bản.
setPanelDirty("c", true);
setPanelDirty("c", true);
check("đánh dấu lặp không nhân bản", unsavedPanelIds().filter((x) => x === "c").length === 1);
setPanelDirty("c", false);

// 4. confirmLeave: chưa lặp gì thì đi tiếp, KHÔNG hỏi (hỏi oan mệt).
// Bịa window.confirm vì test chạy ngoài trình duyệt.
{
  const g = globalThis as unknown as { confirm: (m: string) => boolean };
  const orig = g.confirm;
  let asked = 0;
  g.confirm = () => {
    asked++;
    return true;
  };
  check("chưa có gì bẩn → đi tiếp, KHÔNG hỏi", confirmLeave() === true && asked === 0);

  setPanelDirty("d", true);
  check("có thay đổi → hỏi trước", confirmLeave() === true && asked === 1);
  g.confirm = () => false;
  check("người dùng bấm Ở LẠI → chặn rời đi", confirmLeave() === false);
  g.confirm = orig;
  setPanelDirty("d", false);
}

console.log("── #2 command palette ──");

// 5. Rỗng → trả về tất cả, giữ thứ tự.
{
  const items = [
    { label: "Chống nuke / raid", keywords: "antinuke" },
    { label: "Auto-mod", keywords: "automod spam" },
  ];
  const out = filterCommands(items, "");
  check("gõ rỗng → thấy tất cả", out.length === 2);
  check("giữ thứ tự gốc", out[0].label === "Chống nuke / raid");
}

// 6. Khớp tiền tố phải đứng trước khớp ở giữa.
{
  const items = [
    { label: "Backup server", keywords: "cloudupload" },
    { label: "Cài đặt chống nuke", keywords: "anti" },
  ];
  const out = filterCommands(items, "c");
  check("tiền tố 'Cài' đứng trước 'Backup'", out[0].label === "Cài đặt chống nuke");
  check("tiền tố có điểm cao hơn", scoreCommand(items[1], "c") > scoreCommand(items[0], "c"));
}

// 7. KHÔNG DẤU vẫn ra kết quả — người dùng Việt gõ rất nhanh, không bấm dấu.
// `foldDiacritics` cố ý KHÔNG đổi hoa/thường (chuyện của người gọi).
check("bỏ dấu tiếng Việt", foldDiacritics("Chống nuke") === "Chong nuke");
check("bỏ dấu cả chữ đ", foldDiacritics("Gác hiệu") === "Gac hieu");
{
  const out = filterCommands([{ label: "Gác hiệu", keywords: "" }], "gac hieu");
  check("tìm bằng chuỗi không dấu", out.length === 1);
  check("gõ có dấu cũng khớp", filterCommands([{ label: "Gác hiệu" }], "gác hiệu").length === 1);
}

// 8. Tìm bằng từ khoá tiếng Anh trong `keywords`.
{
  const out = filterCommands(
    [
      { label: "Chống nuke / raid", keywords: "antinuke raid" },
      { label: "Auto-mod", keywords: "automod spam" },
    ],
    "raid",
  );
  check(
    "tìm được qua keywords tiếng Anh",
    out.length === 1 && out[0].label === "Chống nuke / raid",
  );
}

// 9. Không có kết quả → mảng rỗng (UI hiện "không có kết quả nào", không crash).
check(
  "từ bùa nhau → rỗng",
  filterCommands([{ label: "Auto-mod", keywords: "" }], "zzz").length === 0,
);

// 10. Không phân biệt hoa thường.
check(
  "gõ HOA vẫn khớp",
  filterCommands([{ label: "Auto-mod", keywords: "" }], "AUTO").length === 1,
);
check(
  "khoảng trắng thừa không làm hỏng",
  filterCommands([{ label: "Auto-mod", keywords: "" }], "  auto  ").length === 1,
);

// 11. Hòa điểm → giữ thứ tự gốc (người dùng đã quen vị trí panel).
{
  const out = filterCommands(
    [
      { label: "Alpha", keywords: "" },
      { label: "Beta", keywords: "" },
    ],
    "",
  );
  check("hòa điểm giữ thứ tự gốc", out[0].label === "Alpha" && out[1].label === "Beta");
}

console.log("── #4 trạng thái đồng bộ ──");

// 12. Bot offline → nói thẳng, KHÔNG báo "đồng bộ".
check(
  "bot offline → bot-offline",
  syncState({ settingsChangedAt: T, botOnline: false, now: T }) === "bot-offline",
);

// 13. Chưa từng sửa + bot sống → im lặng (không badge rác).
check("chưa sửa gì → in-sync", syncState({ botOnline: true, now: T }) === "in-sync");
check(
  "settingsChangedAt undefined → in-sync",
  syncState({ settingsChangedAt: undefined, botOnline: true, now: T }) === "in-sync",
);

// 14. Vừa lưu (< 3 phút) → "đang gửi", KHÔNG báo xong.
check(
  "vừa lưu → just-saved",
  syncState({ settingsChangedAt: T, botOnline: true, now: T + 60_000 }) === "just-saved",
);

// 15. Biên đúng 3 phút → sang "đã gửi" (không phải just-saved).
check(
  "đúng 3 phút → đã gửi",
  syncState({ settingsChangedAt: T, botOnline: true, now: T + SETTINGS_APPLY_WINDOW_MS }) ===
    "sent",
);

// 16. QUAN TRỌNG: không bao giờ báo "đã áp dụng" — không có tín hiệu đó.
{
  const s = syncState({ settingsChangedAt: T, botOnline: true, now: T + 86_400_000 });
  check("một ngày sau vẫn KHÔNG báo đã áp dụng", s === "sent");
  check("không có trạng thái 'đã áp dụng' nào", !["applied", "done"].includes(s));
}

// 17. Có cấu hình mới nhưng heartbeat quá cũ → coi như bot chết, nói thật.
// Phải để `now` đã qua mốc 3 phút, nếu không thì nhánh "just-saved" chạy trước.
check(
  "heartbeat cũ + có cấu hình mới → bot-offline",
  syncState({
    settingsChangedAt: T,
    botOnline: true,
    lastHeartbeat: T - STALE_HEARTBEAT_MS - 1,
    now: T + SETTINGS_APPLY_WINDOW_MS + 1,
  }) === "bot-offline",
);
// 17b. Heartbeat còn tươi thì vẫn là "đã gửi", không phải offline.
check(
  "heartbeat còn tươi → đã gửi",
  syncState({
    settingsChangedAt: T,
    botOnline: true,
    lastHeartbeat: T + SETTINGS_APPLY_WINDOW_MS,
    now: T + SETTINGS_APPLY_WINDOW_MS + 1,
  }) === "sent",
);

console.log(`\n${pass} PASS, ${fail} FAIL`);
process.exit(fail ? 1 : 0);
