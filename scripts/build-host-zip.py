#!/usr/bin/env python3
"""
Đóng gói bot thành 1 file zip SELF-CONTAINED cho host (Wispbyte, Bot-Hosting...).
Gồm: mã nguồn + node_modules (đã cài sẵn) + file cấu hình .env.

Cách dùng:
  HOST_DISCORD_TOKEN=... HOST_DISCORD_CLIENT_ID=... HOST_CONVEX_URL=... HOST_CONVEX_DEPLOY_KEY=... \
    python3 scripts/build-host-zip.py

Giá trị cấu hình được lấy từ biến môi trường (không nhúng secret vào git).
"""
import os
import sys
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BOT = os.path.join(ROOT, "bot")
OUT = os.path.join(BOT, "protogon-bot.zip")

ENV_FALLBACK = {
    "DISCORD_TOKEN": os.environ.get("HOST_DISCORD_TOKEN", ""),
    "DISCORD_CLIENT_ID": os.environ.get("HOST_DISCORD_CLIENT_ID", ""),
    "CONVEX_URL": os.environ.get("HOST_CONVEX_URL", ""),
    "CONVEX_DEPLOY_KEY": os.environ.get("HOST_CONVEX_DEPLOY_KEY", ""),
}

# Thư mục KHÔNG bao giờ đóng gói
SKIP_DIRS = {".git", "__pycache__", ".turbo", ".cache", ".isolate", ".vscode"}
# File KHÔNG bao giờ đóng gói
SKIP_FILES = {
    "protogon-bot.zip",
    "package-lock.json",
    "bun.lock",
    "bun.lockb",
    "pnpm-lock.yaml",
    "yarn.lock",
    ".DS_Store",
    "discloud.config",
}
# Trong node_modules: bỏ rác làm phình zip (bản build của host không cần)
NM_SKIP_DIRS = {".bin", ".cache", ".github", "docs", "examples", "eslint", "node_modules/.pnpm"}
NM_SKIP_SUFFIXES = (".map", ".md", ".d.ts", ".flow", ".tsbuildinfo")


def parse_env_file(path):
    result = {}
    if not path or not os.path.exists(path):
        return result
    with open(path, "r", encoding="utf-8") as f:
        for line in f.read().splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, _, v = line.partition("=")
            result[k.strip()] = v.strip()
    return result


def ensure_env():
    # Ưu tiên: file cấu hình từ HOST_ENV_FILE (đường dẫn ngoài repo) -> biến môi trường
    source = {}
    file_path = os.environ.get("HOST_ENV_FILE")
    if file_path:
        source.update(parse_env_file(file_path))
    for k, v in ENV_FALLBACK.items():
        if v and k not in source:
            source[k] = v

    env_path = os.path.join(BOT, ".env")
    existing = parse_env_file(env_path)
    missing = {k: v for k, v in source.items() if v and k not in existing}
    if missing:
        with open(env_path, "a", encoding="utf-8") as f:
            for k, v in missing.items():
                f.write(f"{k}={v}\n")
        print(f"[env] Đã ghi {len(missing)} biến cấu hình mới vào bot/.env")


def skip_file(rel, parts):
    name = os.path.basename(rel)
    if name in SKIP_FILES:
        return True
    if rel.endswith(NM_SKIP_SUFFIXES):
        return True
    if "node_modules" in parts:
        if any(p in NM_SKIP_DIRS for p in parts):
            return True
    return False


def skip_dir(parts):
    if any(p in SKIP_DIRS for p in parts):
        return True
    # Không gói scripts/ và discloud.config của host khác — Wispbyte không cần
    if "scripts" in parts and parts[0] == "scripts":
        return True
    if "discloud.config" in parts:
        return True
    if "node_modules" in parts:
        if any(p in NM_SKIP_DIRS for p in parts):
            return True
    return False


def main():
    if not os.path.isdir(os.path.join(BOT, "node_modules")):
        print("Lỗi: chưa có bot/node_modules — chạy `cd bot && bun install --production` trước.")
        sys.exit(1)
    ensure_env()
    if os.path.exists(OUT):
        os.remove(OUT)
    count = 0
    with zipfile.ZipFile(OUT, "w", zipfile.ZIP_DEFLATED, compresslevel=6) as zf:
        for base, dirs, files in os.walk(BOT):
            rel_dir = os.path.relpath(base, BOT)
            parts = [] if rel_dir == "." else rel_dir.split(os.sep)
            dirs[:] = [d for d in dirs if not skip_dir(parts + [d])]
            for fn in sorted(files):
                rel = os.path.join(rel_dir, fn) if rel_dir != "." else fn
                if skip_file(rel, parts + [fn]):
                    continue
                zf.write(os.path.join(base, fn), rel)
                count += 1
    size_mb = os.path.getsize(OUT) / 1024 / 1024
    print(f"[zip] Xong: {OUT} ({count} entries, {size_mb:.1f} MB)")


if __name__ == "__main__":
    main()
