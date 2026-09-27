import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { useProductMotion } from "../lib/motion";

/**
 * Lớp bọc chuyển cảnh vào trang cho phần sản phẩm.
 *
 * Landing có chuyển động riêng từng section; các trang trong app thì không có
 * gì, nên khi đổi trang nội dung bật lên đứng phắt — cảm giác "web chưa xong".
 * Bọc `<main>` bằng component này là đủ, và chỉ sửa 1 dòng mỗi trang.
 *
 * Chuyển cảnh rất nhẹ (mờ + trượt 8px, 0.2s): đủ để mắt kịp bám theo mà
 * không cảm thấy đang chờ. `useProductMotion` tự tắt khi người dùng bật
 * `prefers-reduced-motion`.
 */
export default function PageReveal({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const motionSet = useProductMotion();
  return (
    <motion.main className={className} variants={motionSet.panel} initial="hidden" animate="show">
      {children}
    </motion.main>
  );
}
