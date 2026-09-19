// Plugin guardrails cho OpenCode — lớp bảo vệ chủ động song song với permission.
//
// Permission trong opencode.json chặn theo TÊN file/lệnh; plugin này chặn theo
// HÀNH VI thực sự: lệnh bash tìm cách đọc nội dung env/secret (cat, grep, tail,
// redirect từ file env…), kể cả khi agent tự tạo file mới rồi dùng lệnh đọc nó.
// Kèm theo: giữ "hợp đồng" AGENTS.md không bị mai một khi session dài bị nén.
//
// Lấy cảm hứng từ cơ chế Keys/Environment của Freebuff: agent không bao giờ tự
// đọc được giá trị secret — cần thì phải hỏi người dùng.

const SECRET_HINTS = [
  ".env",
  ".bot-key",
  "auth.json",
  "id_rsa",
  "credentials.json",
];

function looksLikeSecretAccess(command) {
  const cmd = command.toLowerCase();
  // Đọc trực tiếp file secret qua cat/less/tail/head/grep/xxod…
  if (SECRET_HINTS.some((hint) => cmd.includes(hint))) {
    const readers = ["cat ", "less ", "more ", "head ", "tail ", "grep ", "rg ", "xxd", "base64 ", "strings ", "print ", "source ", ". "];
    if (readers.some((r) => cmd.includes(r))) return true;
    // Redirect nội dung secret ra ngoài: `cp .env`, `< .env`, `$(< .env)`
    if (cmd.includes("cp ") || cmd.includes("< ") || cmd.includes("$(")) return true;
  }
  // Dump cả thư mục chứa secret
  if (cmd.includes("tar ") && cmd.includes(".env")) return true;
  return false;
}

export const GuardrailsPlugin = async () => {
  return {
    // 1) Chặn lệnh bash đọc secret trước khi nó chạy
    "tool.execute.before": async (input, output) => {
      if (input.tool === "bash" && looksLikeSecretAccess(output.args.command || "")) {
        throw new Error(
          "GUARDRAIL: Lệnh này có dấu hiệu đọc nội dung file secret (.env/.bot-key/key). " +
            "Theo AGENTS.md điều khoản 1: DỪNG và hỏi người dùng cung cấp giá trị nếu cần. " +
            "Không tìm lối tắt khác để đọc secret.",
        );
      }
    },

    // 2) Khi session dài bị nén (compaction), nhắc lại hợp đồng làm việc để
    //    agent không "quên" quy trình 5 pha sau nhiều lượt hội thoại.
    "experimental.session.compacting": async (input, output) => {
      output.context.push(
        [
          "## Hợp đồng cần nhớ (từ AGENTS.md)",
          "- Workflow 5 pha: Hiểu → Kế hoạch (todo) → Thực hiện → Xác minh → Báo cáo+commit",
          "- Bị gián đoạn rồi được bảo continue/tiếp đi → TIẾP TỤC ĐÚNG CHỖ DỪNG (xem git diff + todo), không làm lại từ đầu; đi đến khi đủ kiểm chứng xanh + báo cáo mới dừng",
          "- Xong việc = test 41/41 + typecheck + lint XANH, chưa chạy thật thì không claim xanh",
          "- Không đọc secret (.env/.bot-key/key) — cần thì hỏi người dùng",
          "- Sửa kiira-retry-proxy.mjs xong → tự systemctl restart kiira-retry-proxy + curl /__health thấy ok:true mới xong (ngoại lệ duy nhất được restart; bot + dịch vụ khác thì in lệnh nhờ người dùng)",
          "- Được git add + commit + push origin main (tiếng Việt, footer 🤖 Generated with OpenCode) — push CHỈ sau khi cả 3 kiểm chứng XANH trong phiên",
          "- Bug thuộc engine đã có test → bắt buộc thêm test chặn tái diễn",
        ].join("\n"),
      );
    },
  };
};
