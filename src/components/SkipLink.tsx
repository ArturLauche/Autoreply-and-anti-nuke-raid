import { translate } from "../lib/i18n";

/**
 * SkipLink — "Bỏ qua tới nội dung", chỉ hiện khi focus (bàn phím).
 *
 * Vì sao có: mọi trang công khai đều có header/điều hướng cố định phía trước
 * nội dung. Người dùng bàn phím/trình đọc màn hình phải Tab qua TOÀN Bộ điều
 * hướng mỗi lần mở trang. Đây là lối tắt chuẩn WCAG 2.4.1 và là thứ người ta
 * kiểm tra đầu tiên khi đánh giá khả năng truy cập.
 *
 * Dùng kèm `id="main"` trên <main> của trang — nhảy tới đó, không phải Tab.
 */
export default function SkipLink() {
  return (
    <a
      href="#main"
      className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:flex focus:h-10 focus:items-center focus:rounded-md focus:border focus:border-border focus:bg-background focus:px-4 focus:text-sm focus:font-medium focus:text-foreground focus:shadow-lg"
    >
      {translate("Bỏ qua tới nội dung")}
    </a>
  );
}
