// ESLint flat config — lá chắn tĩnh đầu tiên trước cả test.
//
// Bối cảnh: bug thật ngày 15/09 — khi tách antinuke.js thành thư mục, 4 module
// thiếu import (Colors, AuditLogEvent, PermissionFlagsBits…). Test không đụng
// nhánh đó nên CI vẫn xanh, nhưng bot thật sẽ crash ngay khi raid xảy ra.
// `no-undef` chặn chính xác loại lỗi này NGAY LÚC LINT — trước cả khi chạy test.
//
// Phạm vi:
//  - bot/** + scripts/** (CommonJS): no-undef + no-unused-vars là hai rule chính.
//  - src/** + convex/** (TypeScript): typescript-eslint recommended. Không bật
//    no-undef cho TS — TypeScript compiler đã xử lý, bật vào chỉ gây noise giả.
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";

export default tseslint.config(
  // Không quét những thứ không thuộc code nguồn.
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "coverage/**",
      "convex/_generated/**", // do `bun convex codegen` sinh ra — không sửa tay
      "bot/test-djs-mock.cjs", // mock tạm sinh khi chạy test
      "scripts/_*.cjs", // script trợ giúp tạm thời (tiền tố _)
    ],
  },

  // ─── Bot Discord + test scripts (JavaScript CommonJS) ───
  {
    files: ["bot/**/*.js", "scripts/**/*.cjs"],
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "commonjs",
      globals: { ...globals.node },
    },
    rules: {
      // Hai lá chắn chính — error tuyệt đối.
      "no-undef": "error",
      "no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrors: "none", // catch (e) {} rỗng là chủ đích ở nhiều luồng bot
        },
      ],
      // Nới các rule gây noise với code bot hiện có nhưng không phải bug thật.
      "no-empty": ["error", { allowEmptyCatch: true }],
      "no-constant-condition": ["error", { checkLoops: false }],
      "no-case-declarations": "off",
      "no-misleading-character-class": "off", // regex test data tiếng Việt có dấu combining — chủ đích
    },
  },

  // ─── File cấu hình ESM rải rác ở root ───
  {
    files: ["postcss.config.js"],
    languageOptions: { ecmaVersion: 2022, sourceType: "module", globals: { ...globals.node } },
  },

  // ─── Web dashboard + Convex backend (TypeScript) ───
  ...tseslint.config({
    files: ["src/**/*.{ts,tsx}", "convex/**/*.ts", "*.config.ts"],
    extends: [tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      // Convex idiom: tham số loại trừ đặt tên _excluded — không phải lỗi.
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      // Code hiện tại dùng any ở biên giới dữ liệu (Discord raw, backup JSON).
      // Tắt để adoption sạch — bật lại dần khi siết kiểu.
      "@typescript-eslint/no-explicit-any": "off",
    },
  }),
);
