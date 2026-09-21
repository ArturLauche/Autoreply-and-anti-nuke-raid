/**
 * i18n.de.panels.ts — Bản dịch DE đợt 2, song song với src/lib/i18n.en.panels.ts.
 * Gồm các mảnh câu bị JSX cắt (dịch từng mảnh sao cho ghép lại đọc tự nhiên),
 * nhãn điều kiện trong {} và nhãn dữ liệu dịch lúc render.
 */
export const DE_PANELS: Record<string, string> = {
  ": backend Convex production đang chạy bản cũ, chưa có các hàm mới. Chủ dự án cần chạy":
    ": das Convex-Production-Backend läuft auf einem älteren Stand ohne die neuen Funktionen. Der Projekteigner muss",
  "chưa có dữ liệu": "noch keine Daten",
  "Bot tự đồng bộ dữ liệu (trạng thái, số server, chủ sở hữu) lên máy chủ":
    "Der Bot synchronisiert Daten (Status, Serverzahl, Eigner) zum Backend",
  "mỗi {p0} giây": "alle {p0} Sekunden",
  ": 2+ tín hiệu mạnh → phạt đúng cấu hình; 1 tín hiệu → hạ cấp nhẹ hơn (ban → kick, kick → timeout); 0 tín hiệu → chỉ theo dõi. Tắt để phạt theo điểm rủi ro như cũ (dễ chặn nhầm hơn).":
    ": 2+ starke Signale → Strafe wie konfiguriert; 1 Signal → eine Stufe milder (Ban → Kick, Kick → Timeout); 0 Signale → nur beobachten. Ausschalten, um weiter nach Risikopunkten zu strafen (fehleranfälliger).",
  "Mỗi {p0} ngày": "Alle {p0} Tage",
  Tắt: "Aus",
  "Chưa backup": "Noch kein Backup",
  "module chống nuke bật": "Anti-Nuke-Module an",
  "Hiện có": "Aktuell",
  "signature từ": "Signaturen von",
  nguồn: "Quellen",
  "Đang khóa — tự mở sau ~{p0} phút": "Gesperrt — öffnet in ~{p0} Minuten wieder",
  "Thu thập mẫu raid + AI phân tích để tìm": "Sammelt Raid-Muster + KI-Analyse, um zu finden",
  "{p0} mẫu": "{p0} Muster",
  "đang tải…": "wird geladen…",
  "Vụ gần đây": "Neue Fälle",
  lượt: "Treffer",
  "đã ban nguồn cơn": "Quelle gebannt",
  nghi: "Verdächtiger",
  bật: "an",
  "vi phạm": "Verstöße",
  "module đang bật": "Module aktiv",
  "Mỗi vi phạm cộng điểm nhiệt theo cài đặt của module. Nhiệt độ tăng dần, tự giảm theo thời gian; khi chạm ngưỡng":
    "Jede Übertretung addiert Heat nach den Moduleinstellungen. Die Heat steigt und sinkt mit der Zeit; wird der",
  "thành viên nhận cảnh báo riêng, rồi tự tăng cấp hình phạt:":
    "erreicht, erhält das Mitglied eine private Verwarnung, dann eskalieren die Strafen:",
  "Ngưỡng phải tăng dần: warn < tạm khóa < kick < ban (tối đa 100 điểm). Thành viên vừa bị phạt mà":
    "Schwellen müssen steigen: Warn < Timeout < Kick < Ban (max. 100 Punkte). Wurde ein Mitglied gerade bestraft und",
  "tái phạm trong {p0} phút": "wiederholt sich innerhalb von {p0} Minuten",
  "sẽ nhận": "erhält es",
  "điểm nhiệt": "Heat-Punkte",
  "Số warn để tăng cấp (0 = tắt)": "Verwarnungen bis zur Eskalation (0 = aus)",
  "Đang bật:": "Aktiv:",
  "trong {p0} phút → tự": "innerhalb von {p0} Minuten → automatisch",
  "(mặc định: {limit} warn / {window} phút).":
    "(Standard: {limit} Verwarnungen / {window} Minuten).",
  "Xóa {p0}": "{p0} entfernen",
  "Áp dụng mọi kênh": "Gilt für alle Kanäle",
  "{p0} kênh được chọn": "{p0} Kanäle ausgewählt",
  "Thêm rule auto reply": "Auto-Reply-Regel hinzufügen",
  "tag người nhắn,": "taggt den Absender,",
  "Chỉ áp dụng cho kênh (bỏ trống = mọi kênh)": "Nur diese Kanäle (leer = alle Kanäle)",
  "Chưa có kênh nào được đồng bộ": "Noch keine Kanäle synchronisiert",
  "Gõ tên kênh để tìm nhanh…": "Kanalnamen zum Filtern tippen…",
  "Cooldown (giây, 0 = không giới hạn)": "Abklingzeit (Sekunden, 0 = unbegrenzt)",
  "Chụp cấu trúc server (role, quyền role, kênh + quyền kênh) lên":
    "Sichert die Serverstruktur (Rollen, Rollenrechte, Kanäle + Kanalrechte) nach",
  "— khắc phục rồi bấm Backup ngay lại.": "— behebe es und klicke erneut auf Jetzt sichern.",
  "— khắc phục (bot còn trong server, đủ quyền Administrator) rồi bấm Khôi phục lại.":
    "— behebe es (der Bot muss noch im Server mit Administrator sein) und klicke erneut auf Wiederherstellen.",
  "Tạo backup cho": "Backup erstellen für",
  "(danh mục, văn bản, thoại…) kèm quyền truy cập từng kênh, cùng":
    "(Kategorien, Text, Voice…) mit Zugriffsrechten je Kanal, dazu",
  "Backup luôn được lưu trong Convex; đẩy lên GitHub giúp bạn còn giữ được dữ liệu ngay cả khi Convex bị xóa. Mọi server đều dùng chung":
    "Backups liegen immer in Convex; der GitHub-Schiebeweg sichert deine Daten, selbst wenn Convex gelöscht wird. Alle Server teilen sich",
  của: "von",
  hoặc: "oder",
  "), tải file lên đây — bot sẽ": "), lade die Datei hier hoch — der Bot wird",
  "(ảnh/video…) và": "(Bilder/Videos…) und",
  "Bot đang chạy bản cũ ({version}) — cần cập nhật bot lên bản mới nhất (v{min}+) để khôi phục và báo kết quả chính xác.":
    "Der Bot läuft auf einer alten Version ({version}) — aktualisiere ihn auf die neueste (v{min}+), damit Wiederherstellung und Berichte korrekt sind.",
  "không rõ": "unbekannt",
  "— kiểm tra lại file rồi tải lên.": "— prüfe die Datei und lade sie erneut hoch.",
  mỗi: "alle",
  ", tối đa": ", max",
  "Backup gần nhất:": "Neuestes Backup:",
  "· lần tới:": "· nächstes:",
  "Bật lên là bot chụp bản đầu tiên trong khoảng 1 phút, sau đó lặp lại theo chu kỳ bạn chọn.":
    "Nach dem Einschalten sichert der Bot erstmals innerhalb ~1 Minute und wiederholt es in deinem gewählten Zyklus.",
  "Đang tắt — bot chỉ backup khi bạn bấm “Backup ngay” hoặc dùng lệnh.":
    "Aus — der Bot sichert nur, wenn du auf „Jetzt sichern“ klickst oder den Befehl nutzt.",
  "Lưu lịch tự động": "Zeitplan speichern",
  "Bật/tắt từng phần khi bot khôi phục — áp dụng cho":
    "Teile der Wiederherstellung einzeln schalten — gilt für",
  lẫn: "und",
  "Lưu tùy chỉnh khôi phục": "Wiederherstellungsoptionen speichern",
  "(quyền": "(Umfang",
  ") của": ") von",
  "💡 Ngoài dashboard, bạn cũng có thể dùng lệnh trong Discord:":
    "💡 Neben dem Dashboard kannst du auch Discord-Befehle nutzen:",
  "!backup restore <số>": "!backup restore <Nummer>",
  bản: "Backups",
  "Khôi phục vào server này": "In diesen Server wiederherstellen",
  "Đang gửi…": "Wird gesendet…",
  "— thường do người nhận tắt DM hoặc không dùng chung server với bot":
    "— meist weil der Empfänger DMs ausgeschaltet hat oder keinen Server mit dem Bot teilt",
  "Khi bot phát hiện loạt kết nối ứng dụng ngoài vượt ngưỡng module":
    "Erkennt der Bot eine Welle externer App-Verbindungen über den Modulschwellenwert",
  người: "Personen",
  "kết nối": "Verbindungen",
  bởi: "durch",
  "app khác…": "weitere Apps…",
  "Chưa xác định được người dùng — chỉ ghi nhận": "Kein Nutzer identifiziert — nur protokolliert",
  "Không có": "Keine",
  "(ứng dụng mở rộng) được kết nối ồ ạt hoặc app spam vào server — kèm":
    "(Erweiterungs-Apps) werden massenhaft verbunden oder spammen in den Server — mit",
  "đang tắt — bật lại trong mục": "ist aus — wieder einschalten unter",
  "⚠️ Bot không gửi được bảng:": "⚠️ Der Bot konnte das Panel nicht posten:",
  "kết thúc": "endet",
  "bất cứ lúc nào": "jederzeit",
  "người tham gia": "Teilnahmen",
  "người thắng": "Gewinner",
  " · 🎖️ cấp role thưởng": " · 🎖️ vergibt eine Preisrolle",
  " · DM người thắng": " · DM an die Gewinner",
  " · 🖼️ có ảnh": " · 🖼️ mit Bild",
  "Hủy thất bại": "Abbrechen fehlgeschlagen",
  "lượt tham gia": "Teilnahmen",
  "Lời dẫn tùy chỉnh (hiển thị đầu embed, để trống = dùng giải thưởng)":
    "Eigene Einleitung (oben im Embed, leer = Preis verwenden)",
  "Nhiệt giảm {p0} điểm/phút": "Heat sinkt {p0} Punkte/Minute",
  "= tạm khóa": "= Timeout",
  "= cảnh báo": "= Verwarnung",
  "0 = an toàn": "0 = sicher",
  "Xóa nhiệt của {p0}": "Heat von {p0} löschen",
  "Đang bật · {p0} tiêu chí": "An · {p0} Kriterien",
  "Đang tắt": "Aus",
  "Tài khoản tạo ít hơn số ngày dưới đây sẽ bị chặn (0 = tắt). Selfbot thường dùng tài khoản mới tạo hàng loạt.":
    "Konten, die jünger sind als die unten angegebene Tageszahl, werden blockiert (0 = aus). Selfbots nutzen oft frisch massenerstellte Konten.",
  "Tài khoản không có ảnh đại diện riêng (đang dùng hình mặc định) sẽ bị chặn.":
    "Konten ohne eigenen Avatar (noch mit Standardbild) werden blockiert.",
  "Tài khoản không có bất kỳ huy hiệu công khai nào (flag = 0) sẽ bị chặn — selfbot mới hầu như không có huy hiệu.":
    "Konten ohne öffentliches Abzeichen (flag = 0) werden blockiert — frische Selfbots haben fast nie eines.",
  "Khi server đang khóa kênh (raid), mọi thành viên mới đều bị xử lý — chặn đà tấn công thứ hai.":
    "Während der Kanalsperre (Raid) wird jedes neue Mitglied behandelt — stoppt die zweite Angriffswelle.",
  "Kick = thành viên có thể quay lại; Ban = chặn vĩnh viễn (mạnh hơn với selfbot).":
    "Kick = das Mitglied kann wiederkommen; Ban = dauerhafte Sperre (stärker gegen Selfbots).",
  "(kiểu Carl-bot), lý do, người thực hiện và phân biệt rõ nguồn:":
    "(Carl-Bot-Stil), den Grund, den Ausführenden und eine klare Quell-Kennzeichnung:",
  "hành động gần nhất": "neueste Aktionen",
  "đang bật thông báo": "Hinweise an",
  "Nội dung thông báo sau khi bot": "Hinweisinhalt, nachdem der Bot",
  từ: "von",
  "từ lệnh": "aus dem Befehl",
  Ngưỡng: "Schwelle",
  "= xóa ngay tin vi phạm ·": "= löscht die Verstoß-Nachricht sofort ·",
  "= xóa hàng loạt tin liên quan vụ vi phạm.":
    "= löscht alle Nachrichten im Umfeld des Vorfalls im Bulk.",
  "Chưa có role được đồng bộ": "Noch keine Rollen synchronisiert",
  "Gõ tên role để tìm nhanh…": "Rollenname zum Filtern tippen…",
  "Báo cáo hàng ngày:": "Tagesbericht:",
  "lần cuối": "zuletzt",
  "thủ phạm": "Täter",
  "{p0} đang bật": "{p0} aktiviert",
  "Đang bảo vệ": "Geschützt",
  "Đã tắt toàn bộ": "Vollständig deaktiviert",
  "đồng bộ qua bot": "per Bot synchronisiert",
  "Chưa đặt": "Nicht gesetzt",
  "cảnh báo & sự kiện": "Alarme & Ereignisse",
  "đặt trong Cài đặt": "in den Einstellungen gesetzt",
  "Lần cuối đồng bộ:": "Zuletzt synchronisiert:",
  "để tag người nhắn,": "zum Taggen des Absenders,",
  "Chọn từ gợi ý bên dưới hoặc dán emoji tùy chỉnh: emoji unicode, custom emoji":
    "Aus den Vorschlägen unten wählen oder eigenes Emoji einfügen: Unicode-Emoji, Custom-Emoji",
  "chưa có": "nicht gesetzt",
  "🖼️ có thumbnail ·": "🖼️ hat ein Vorschaubild ·",
  "Thất bại": "Fehlgeschlagen",
  "Xóa thất bại": "Löschen fehlgeschlagen",
  "1–3 ký tự đặc biệt — lệnh text như": "1–3 Sonderzeichen — Textbefehle wie",
  "tự gửi log khi có sự kiện. Tùy chỉnh loại sự kiện, màu embed và nội dung kèm.":
    "postet bei Ereignissen automatisch Logs. Ereignistypen, Embed-Farbe und Zusatzinhalt sind anpassbar.",
  "Màu embed (hex, để trống = mặc định)": "Embed-Farbe (hex, leer = Standard)",
  "Lỗi lưu webhook": "Webhook konnte nicht gespeichert werden",
  "Nhập mật khẩu mới để thay đổi…": "Neues Passwort zum Ändern eingeben…",
  "Nhập mật khẩu (4–64 ký tự)…": "Passwort eingeben (4–64 Zeichen)…",
  "Lưu thất bại": "Speichern fehlgeschlagen",
  "Trạng thái:": "Status:",
  Webhook: "Webhook",
  "Đang kiểm tra…": "Wird geprüft…",
  "Đã đổi phương thức xác minh": "Verifizierungsmethode aktualisiert",
  "để tag,": "zum Taggen,",
  "để tên server": "für den Servernamen",
  "để trống = màu mặc định": "leer = Standardfarbe",
  "Đã cập nhật kênh xác minh": "Verifizierungskanal aktualisiert",
  "Đã cập nhật role chưa xác minh": "Unverifiziert-Rolle aktualisiert",
  "Đã cập nhật role đã xác minh": "Verifiziert-Rolle aktualisiert",
  "Đã yêu cầu bot gửi panel xác minh!": "Den Bot gebeten, das Verifizierungspanel zu posten!",
  "Chưa chọn kênh": "Kein Kanal gewählt",
  "Chưa chọn role": "Keine Rolle gewählt",
  "— thiết lập xác minh bằng lệnh Discord.": "— Verifizierung per Discord-Befehl einrichten.",
  "Webhook mặc định của bot": "Standard-Webhook des Bots",
  "· kênh": "· Kanal",
  "kênh đã bị xóa": "Kanal gelöscht",
  "(theo Kênh log trong Cài đặt) · nhận mọi log hình phạt & anti nuke/raid.":
    "(folgt dem Log-Kanal in den Einstellungen) · nimmt jedes Straf- & Anti-Nuke/Raid-Log entgegen.",
  "Hôm nay lúc": "Heute um",
  "• Dán URL vào ô trên, soạn embed với tiêu đề, mô tả, màu sắc, fields... rồi bấm":
    "• URL oben einfügen, Embed mit Titel, Beschreibung, Farbe, Feldern… verfassen, dann klicken auf",
  "moderation, anti-raid và anti-nuke xử lý —":
    "von Moderation, Anti-Raid und Anti-Nuke behandelt —",
  "chỉ áp dụng cho": "gilt nur für",
  "của người dùng (bật Chế độ nhà phát triển trong Discord → chuột phải tên người dùng → Sao chép ID người dùng) để họ không bị hệ thống xử lý":
    "des Nutzers (Entwicklermodus in Discord aktivieren → Rechtsklick auf den Namen → Nutzer-ID kopieren), damit das System ihn überspringt",
  "người dùng": "Nutzer",
  "Danh sách áp dụng cho": "Die Liste gilt für",
  "toàn bộ module của server": "alle Module des Servers",
  ": spam, từ ngữ xấu, link mời, link độc hại, file nguy hiểm, raid thành viên, ban/kick hàng loạt, tạo/xóa kênh & role hàng loạt, webhook/thread hàng loạt… Người dùng/role trong danh sách được bỏ qua hoàn toàn — không cộng nhiệt, không xóa tin, không ban. Danh sách này":
    ": Spam, Schimpfwörter, Einladungslinks, bösartige Links, gefährliche Dateien, Mitglieder-Raids, Massen-Bans/Kicks, Massen-Kanal- & Rollen-Erstellung/Löschung, Massen-Webhooks/Threads… Gelistete Nutzer/Rollen werden vollständig übersprungen — keine Heat, keine Löschung, kein Ban. Diese Liste",
  "đang dùng bot.": "den Bot nutzen.",
  "Protogon Bot · Tự trả lời thông minh, nhiệt độ vi phạm, Join Gate & phòng thủ chống raid cho Discord":
    "Protogon Bot · Smartes Auto-Reply, Verstoß-Heat, Join Gate & Raid-Schutz für Discord",
  "bị chặn: tài khoản": "blockiert: das Konto ist",
  "Bảo vệ toàn diện & giao tiếp cho server của bạn":
    "Rundumschutz & Konversation für deinen Server",
  "(24 module) canh cấu trúc server (ban/kick hàng loạt, phá kênh, phá role…) và":
    "(24 Module) bewachen die Serverstruktur (Massen-Bans/Kicks, Kanal-/Rollen-Vandalismus…) und",
  "Không khớp": "Keine Treffer für",
  "{p0} server · {p1} thành viên": "{p0} Server · {p1} Mitglieder",
  "Lỗi kết nối": "Verbindungsfehler",
  "Khi đã đặt seed, MỌI lệnh của bot yêu cầu chìa khóa khớp — kẻ ngoài không thể giả mạo heartbeat/backup/lockdown. Trên VPS dán giá trị seed VỪA NHẬP vào biến":
    "Ist ein Seed gesetzt, braucht JEDER Bot-Befehl den passenden Schlüssel — Außenstehende können Heartbeat/Backup/Lockdown nicht fälschen. Auf dem VPS den SOEBEN EINGEGEBENEN Seed in die Variable",
  "trong bot/.env rồi": "in bot/.env eintragen und",
  "Đã bật bảo vệ ✅ — dán giá trị seed VỪA NHẬP vào BOT_KEY trên VPS (không hiện lại ở đây).":
    "Schutz aktiviert ✅ — trage den SOEBEN EINGEGEBENEN Seed in BOT_KEY auf dem VPS ein (er wird hier nicht noch einmal gezeigt).",
  "Lỗi khi đặt seed — thử lại.": "Seed konnte nicht gesetzt werden — erneut versuchen.",
  "Cửa sổ Admin chỉ hiển thị trong taskbar với":
    "Das Admin-Fenster erscheint nur in der Taskbar für",
  "Cho phép AI tổng hợp (Mimo V2.5 qua Kira AI — free 30M tokens/ngày riêng cho việc học; tổng hợp mỗi lượt khi có dữ liệu mới, không đụng hạn mức Groq/NVIDIA)":
    "KI-Synthese erlauben (Mimo V2.5 über Kira AI — 30 Mio. Gratis-Tokens/Tag nur fürs Lernen; synthetisiert bei jedem Lauf mit neuen Daten, ohne das Groq/NVIDIA-Kontingent anzutasten)",
  "Nguồn lượt trước": "Quellen des letzten Laufs",
  "Kích hoạt bot học NGAY từ nguồn mở + AI tổng hợp. Lần cuối:":
    "Bringt den Bot JETZT zum Lernen aus offenen Quellen + KI-Synthese. Letztes Mal:",
  "Lịch sử học": "Lernverlauf",
  "lượt gần nhất": "neueste Läufe",
  "· nhớ": "· merkt sich",
  "Từ khóa đã học": "Gelernte Schlüsselwörter",
  "Máy chủ backend của Protogon hiện không truy cập được từ trang web này (lỗi kết nối Convex). Nếu bạn là quản trị viên, hãy kiểm tra cấu hình":
    "Protogons Backend ist von dieser Website gerade nicht erreichbar (Convex-Verbindungsfehler). Als Administrator prüfe die Konfiguration",
  "và thử lại sau ít phút.": "und versuche es in ein paar Minuten erneut.",
  "Để đăng nhập, bạn cần tạo ứng dụng Discord và điền":
    "Für die Anmeldung musst du eine Discord-Anwendung erstellen und",
  "vào mục API Keys. Cách làm:": "unter API-Schlüssel eintragen. So gehts:",
  "Thêm redirect URI": "Redirect-URI hinzufügen",
  vào: "zu",
  và: "und",
  "Mời Protogon vào server của bạn rồi quay lại đây. Cần quyền":
    "Lade Protogon auf deinen Server ein und komm zurück. Du brauchst die Berechtigung",
  "thành viên · prefix": "Mitglieder · Präfix",
  "Mời bot vào server trước khi quản lý":
    "Lade den Bot auf den Server ein, bevor du ihn verwaltest",
  "Bạn sẽ được chuyển tới trang mời bot.": "Du wirst zur Bot-Einladungsseite weitergeleitet.",
  ngưỡng: "Schwelle",
  trong: "in",
  "Tải thêm sự kiện": "Mehr Ereignisse laden",
  "— Đã hiển thị toàn bộ": "— Alle angezeigt",
  "sự kiện": "Ereignisse",
  "• Auto-mod = spam tin, mention, từ xấu, ảnh/file, link mời + link độc hại.":
    "• Auto-Mod = Nachrichten-Spam, Mentions, Schimpfwörter, Bilder/Dateien, Einladungs- + bösartige Links.",
  "• Moderation = thông báo sau khi bot phạt (ban · timeout · warn · kick) — chọn mức chi tiết riêng cho từng hành động.":
    "• Moderation = Hinweise nach der Strafe des Bots (Ban · Timeout · Warn · Kick) — Detailgrad je Aktion wählbar.",
  "• Join Gate = chặn selfbot khi vào server.": "• Join Gate = blockt Selfbots beim Beitritt.",
  "• ⭐ Whitelist = chọn người dùng/role miễn trừ moderation, anti-raid và nuke.":
    "• ⭐ Whitelist = Nutzer/Rollen wählen, die von Moderation, Anti-Raid und Nuke ausgenommen sind.",
  "• 💾 Backup server = chụp role + kênh lên đám mây riêng; khôi phục lại khi server bị nuke phá sập.":
    "• 💾 Server-Backup = sichert Rollen + Kanäle in deine eigene Cloud; stellt wieder her, wenn ein Nuke den Server zerlegt.",
  "• 🔗 Webhook & Log = bot tự tạo webhook tên/avatar/màu tùy chỉnh để nhận log.":
    "• 🔗 Webhook & Log = der Bot erstellt einen Webhook mit eigenem Namen/Avatar/Farbe für Logs.",
  "tự trả lời & chống raid": "Auto-Reply & Anti-Raid",
  "kèm warn tích lũy": "mit kumulierenden Verwarnungen",
  "canh server 24/7.": "bewacht den Server 24/7.",
  "Trung bình:": "Durchschnitt:",
  "Tối đa:": "Spitze:",
  "đang đo": "wird gemessen",
  "Đánh giá:": "Bewertung:",
  Nhanh: "Schnell",
  "Nhiệt giảm {decay} điểm/phút — thành viên ngoan tự rời bảng sau một lúc im giọng. ▪ {warn} cảnh báo · ▪ {timeout} tạm khóa · ▪ {kick} kick · ■ {ban} ban":
    "Heat sinkt {decay} Punkte/Minute — brave Mitglieder verschwinden nach einer Weile Funkstille von der Tafel. ▪ {warn} Verwarnung · ▪ {timeout} Timeout · ▪ {kick} Kick · ■ {ban} Ban",
  "lần cảnh báo": "Verwarnungen",
  'Chỉnh sửa "{p0}"': "„{p0}“ bearbeiten",
  'Hủy giveaway "{p0}"?': "Giveaway „{p0}“ abbrechen?",
  'Xóa bảng "{p0}"?': "Panel „{p0}“ löschen?",
  '— bấm "Học ngay" để thử lại': "— klicke auf „Jetzt lernen“, um es erneut zu versuchen",
  '— hãy sửa lỗi rồi bấm "Gửi panel xác minh vào kênh" lại':
    "— behebe den Fehler und klicke erneut auf „Verifizierungspanel in den Kanal posten“",
  "—": "—",
};
