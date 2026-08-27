#!/bin/bash
# ========================================
# Protogon Bot — VPS Quick Setup Script
# Tested on: Ubuntu 22.04/24.04, Debian 12
# Requires: root access
# ========================================

set -e
echo "🚀 Protogon VPS Setup — Optimized for 1-1 (1vCPU / 1GB RAM)"
echo "============================================================"

# --- 1. System updates ---
echo ""
echo "📦 Updating system..."
apt update -qq && apt upgrade -y -qq

# --- 2. Install Node.js 20 LTS ---
echo ""
echo "📦 Installing Node.js 20 LTS..."
if ! command -v node &> /dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt install -y nodejs
fi
echo "   Node.js: $(node -v)"
echo "   npm: $(npm -v)"

# --- 3. Install PM2 globally ---
echo ""
echo "📦 Installing PM2..."
npm install -g pm2 2>/dev/null || true

# --- 4. Install Bun (optional, faster installs) ---
echo ""
echo "📦 Installing Bun..."
if ! command -v bun &> /dev/null; then
  curl -fsSL https://bun.sh/install | bash
  export BUN_INSTALL="$HOME/.bun"
  export PATH="$BUN_INSTALL/bin:$PATH"
fi
echo "   Bun: $(bun --version 2>/dev/null || echo 'not found')"

# --- 5. Create bot directory ---
echo ""
echo "📁 Setting up bot directory..."
BOT_DIR="/opt/protogon"
mkdir -p "$BOT_DIR/logs"
mkdir -p "$BOT_DIR/data"

# --- 6. Swap file (critical for 1GB RAM) ---
echo ""
echo "💾 Setting up swap file..."
if [ ! -f /swapfile ]; then
  fallocate -l 1G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
  sysctl vm.swappiness=10
  echo "   ✅ 1GB swap created (vm.swappiness=10)"
else
  echo "   ✅ Swap already exists"
fi

# --- 7. System tuning for low memory ---
echo ""
echo "⚙️  Tuning system for low memory..."
cat >> /etc/sysctl.conf << 'EOF'

# === Protogon VPS Tuning ===
vm.swappiness=10
vm.overcommit_memory=1
net.core.somaxconn=1024
net.ipv4.tcp_max_syn_backlog=1024
EOF
sysctl -p 2>/dev/null || true

# --- 8. Auto-restart cron (backup for PM2) ---
echo ""
echo "⏰ Setting up auto-restart cron..."
(crontab -l 2>/dev/null | grep -v "protogon" ; echo "@reboot sleep 30 && cd $BOT_DIR && pm2 resurrect 2>/dev/null || pm2 start ecosystem.config.js") | crontab -

# --- 9. Firewall ---
echo ""
echo "🔥 Configuring firewall..."
if command -v ufw &> /dev/null; then
  ufw allow 22/tcp 2>/dev/null || true
  ufw --force enable 2>/dev/null || true
  echo "   ✅ UFW enabled (SSH only)"
fi

# --- 10. Memory monitoring alias ---
cat > /usr/local/bin/memcheck << 'MEMEOF'
#!/bin/bash
echo "=== Memory Usage ==="
free -h
echo ""
echo "=== PM2 Status ==="
pm2 list 2>/dev/null || echo "PM2 not running"
echo ""
echo "=== Top Memory Processes ==="
ps aux --sort=-%mem | head -10
MEMEOF
chmod +x /usr/local/bin/memcheck

echo ""
echo "============================================================"
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "  1. Upload protogon-bot.zip to $BOT_DIR"
echo "     scp protogon-bot.zip root@YOUR_VPS_IP:$BOT_DIR/"
echo ""
echo "  2. Extract and install:"
echo "     cd $BOT_DIR && unzip protogon-bot.zip"
echo "     cd bot && npm install --omit=dev"
echo ""
echo "  3. Create .env file:"
echo "     nano $BOT_DIR/bot/.env"
echo "     # Add: DISCORD_TOKEN=your_token_here"
echo "     # Add: CONVEX_URL=your_convex_url"
echo ""
echo "  4. Start with PM2:"
echo "     cd $BOT_DIR/bot && pm2 start ecosystem.config.js"
echo "     pm2 save"
echo ""
echo "  5. Check memory:"
echo "     memcheck"
echo "     pm2 monit"
echo ""
echo "============================================================"
