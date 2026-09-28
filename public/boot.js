/**
 * public/boot.js — vòng tiến trình preloader (Protogon).
 *
 * Vì sao là FILE NGOÀI mà không phải <script> inline trong index.html:
 * CSP production đặt `script-src 'self'` (xem vercel.json + Dockerfile.web) —
 * inline script KHÔNG có nonce/hash bị chặn im lặng. Hệ quả đo được 28/09/2026
 * bằng trình duyệt thật: hàm này không chạy → #boot không bao giờ nhận class
 * `is-done` → lớp phủ preloader ĐẬY TRẮNG phủ kín cả app ở MỌI trang, kẹt ở
 * 0% mãi mãi. App render bình thường phía dưới, người dùng không bao giờ thấy.
 *
 * File ngoài (cùng origin, cache được) vừa chạy được dưới script-src 'self'
 * NGHIÊM NGẶT — không cần nới 'unsafe-inline' (đó mới là nới lỏng bảo mật).
 *
 * Nội dung bên dưới là logic gốc, chỉ đổi cách nạp (external classic script,
 * đặt cuối <body>, chạy ngay khi parse tới — đúng vai trò inline trước đây).
 */
(function () {
  var boot = document.getElementById("boot");
  if (!boot) return;
  var fill = document.getElementById("boot-fill");
  var pctEl = document.getElementById("boot-pct");
  var reduce = false;
  try {
    reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch (e) {}

  // Nền preloader bám đúng chủ đề app đang dùng: Taskbar lưu
  // "protogon-theme"; chưa có thì theo prefers-color-scheme — cùng quy
  // tắc mặc định, nên không lóe trắng trên máy người dùng chủ đề tối.
  var theme = "";
  try {
    theme = localStorage.getItem("protogon-theme") || "";
  } catch (e) {}
  if (theme !== "light" && theme !== "dark") {
    theme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  boot.setAttribute("data-boot", theme);

  // ── Vòng tiến trình ─────────────────────────────────────────────
  // Tiến trình tự trườn tới ~90% (không giả vờ số % thật) rồi đứng yên
  // chờ app báo xong. Lỗi JS → chốt 100% sau 7s để không kẹt preloader.
  // Bắt đầu từ 0 chứ không phải 10: trước đây mốc 10% là để nhân vật
  // khỏi bị cắt ở mép thanh, nhân vật bỏ rồi thì nhảy phát lên 10% chỉ
  // là nói dối người dùng.
  var start = performance.now();
  var shown = 0;
  var done = false;
  var ended = false;
  function paint(p) {
    // Bật giảm chuyển động → bước 8%. PHẢI chặn trên 100: làm tròn
    // 100 lên 104 là thanh tràn quá cuối (bug tìm ra khi audit).
    var v = reduce ? Math.min(100, Math.round(p / 8) * 8) : p;
    fill.style.width = v + "%";
    pctEl.textContent = Math.round(v) + "%";
    boot.setAttribute("aria-valuenow", String(Math.round(v)));
  }
  function end() {
    if (ended) return;
    ended = true;
    boot.className = boot.className + " is-done";
    setTimeout(function () {
      if (boot.parentNode) boot.parentNode.removeChild(boot);
    }, 700);
  }
  function frame(now) {
    var el = now - start;
    // Đuổi tiệm cận 90% rồi đứng chờ app báo xong. Hằng số 520ms (trước
    // là 700) → tới ~78% sau 1s, nhanh hơn "một chút" mà vẫn còn đủ
    // đường để trườn tiếp, không kịch trần ngay giây đầu.
    var target = done ? 100 : Math.min(90, 10 + 80 * (1 - Math.exp(-el / 520)));
    shown += (target - shown) * (done ? 0.3 : 0.14);
    // Ngưỡng chốt 100 phải SÁT 100: nhảy từ 99,4 lên 100 là một cú giật
    // ~2,5px trên thanh 420px đúng lúc mắt đang nhìn vào nó.
    if (done && shown > 99.8) shown = 100;
    paint(shown);
    if (shown >= 100) {
      end();
      return;
    }
    requestAnimationFrame(frame);
  }
  window.__bootDone = function () {
    done = true;
  };
  setTimeout(function () {
    done = true;
  }, 7000);
  paint(shown);
  requestAnimationFrame(frame);
})();
