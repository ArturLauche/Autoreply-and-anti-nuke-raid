#!/usr/bin/env sh
# setup-vps-agent.sh — cài đặt môi trường phát triển + OpenCode (AI coding agent)
# trên VPS để bảo trì bot Protogon ngay trên server.
#
# Cách dùng (chạy bằng user thường, KHÔNG phải root):
#   sh ./scripts/setup-vps-agent.sh
#
# Script làm 4 việc:
#   1. Kiểm tra Bun + Node (bot chạy bằng Bun) — thiếu thì cài.
#   2. Cài OpenCode (terminal AI agent) nếu chưa có.
#   3. Chép cấu hình permission an toàn vào ~/.config/opencode/opencode.json
#     (KHÔNG đè file có sẵn — in đường dẫn để bạn tự merge nếu muốn).
#   4. Chép AGENTS.md (quy tắc ứng xử cho agent) vào thư mục dự án.
#
# Sau khi chạy xong: `cd bot && opencode` là dùng được.

set -eu

echo "── 1/4 Kiểm tra Bun + Node ─────────────────────────────"

# unzip là phụ thuộc bắt buộc: cả trình cài Bun lẫn OpenCode đều cần nó để
# giải nén. Distro nhẹ (Ubuntu container, Debian slim…) thường thiếu.
if ! command -v unzip >/dev/null 2>&1; then
  echo "   Thiếu unzip (cần để giải nén Bun/OpenCode) — đang cài..."
  if [ "$(id -u)" = "0" ]; then
    SUDO=""
  elif command -v sudo >/dev/null 2>&1; then
    SUDO="sudo"
  else
    echo "   ❌ Không có quyền cài gói hệ thống (không root, không sudo)."
    echo "      Nhờ admin cài: apt-get install -y unzip   rồi chạy lại script."
    exit 1
  fi
  if command -v apt-get >/dev/null 2>&1; then
    if ! ($SUDO apt-get update -qq && $SUDO apt-get install -y unzip); then
      echo "   ❌ Cài unzip thất bại — kiểm tra mạng/kho gói rồi chạy lại script."
      exit 1
    fi
  elif command -v dnf >/dev/null 2>&1; then
    $SUDO dnf install -y unzip
  elif command -v yum >/dev/null 2>&1; then
    $SUDO yum install -y unzip
  elif command -v apk >/dev/null 2>&1; then
    $SUDO apk add unzip
  else
    echo "   ❌ Không nhận diện được package manager — cài unzip thủ công rồi chạy lại."
    exit 1
  fi
  echo "   ✅ Đã cài unzip."
fi

if ! command -v bun >/dev/null 2>&1; then
  echo "   Bun chưa có — cài từ bun.sh..."
  curl -fsSL https://bun.sh/install | bash
  export PATH="$HOME/.bun/bin:$PATH"
fi
echo "   bun  : $(bun --version)"

if ! command -v node >/dev/null 2>&1; then
  echo "   ⚠️  Node chưa có — bot cần Node ≥ 18 cho smoke test."
  echo "      Cài thủ công: https://nodejs.org (apt/nvm) rồi chạy lại script."
else
  echo "   node : $(node --version)"
fi

echo ""
echo "── 2/4 Cài OpenCode ────────────────────────────────────"
if command -v opencode >/dev/null 2>&1; then
  echo "   OpenCode đã cài: $(opencode --version 2>/dev/null || echo 'đã có')"
else
  curl -fsSL https://opencode.ai/install | bash
  echo "   ✅ Đã cài OpenCode — chạy lại shell hoặc export PATH nếu lệnh chưa nhận."
fi

echo ""
echo "── 3/4 Cấu hình permission an toàn ─────────────────────"
# Cấu hình NẶNG VỀ AN TOÀN:
#  - .env bị chặn đọc mặc định (OpenCode default) + chặn thêm *nội dung* env
#    đi ra ngoài qua webfetch.
#  - git commit/push/reset/clean → DENY tuyệt đối: agent chỉ sửa code, bạn
#    tự review diff rồi tự commit (giống quy trình Changes panel của Freebuff).
#  - lệnh phá hoại (rm -rf, mkfs, dd, shutdown…) → DENY.
#  - mọi lệnh khác → ASK (hỏi trước khi chạy).
OC_DIR="${HOME}/.config/opencode"
OC_FILE="${OC_DIR}/opencode.json"
if [ -f "$OC_FILE" ]; then
  echo "   ℹ️  Đã có ${OC_FILE} — KHÔNG đè. Merge tay nếu cần:"
  echo "      (bản mẫu nằm trong repo: opencode.json)"
else
  mkdir -p "$OC_DIR"
  cp "$(dirname "$0")/../opencode.json" "$OC_FILE" 2>/dev/null &&
    echo "   ✅ Đã chép cấu hình an toàn → ${OC_FILE}" ||
    echo "   ⚠️  Không tìm thấy opencode.json trong repo — kiểm tra lại."
fi

echo ""
echo "── 4/4 AGENTS.md cho dự án ─────────────────────────────"
# AGENTS.md đặt ở root repo — OpenCode tự đọc và tuân theo khi chạy trong repo.
if [ -f AGENTS.md ]; then
  echo "   ✅ AGENTS.md đã có sẵn."
else
  echo "   ℹ️  AGENTS.md chưa có ở root — bản mẫu nằm trong repo, đã đi kèm git pull."
fi

echo ""
echo "════ Xong! Bắt đầu dùng ════"
echo "  cd bot                # hoặc root repo nếu muốn agent thấy cả web/"
echo "  opencode              # mở TUI; lần đầu: /auth login chọn provider + dán key"
echo "  opencode run 'bun run test'   # chạy không cần UI"
echo ""
echo "  Khuyên dùng: model coder mạnh (Claude/GPT/DeepSeek-coder…) —"
echo "  model free tier nhanh chạm hạn mức khi agent đọc/sửa hàng loạt file."
