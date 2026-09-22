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
  "Protogon Bot · Tự trả lời theo từ khóa, nhiệt độ vi phạm, Join Gate và phòng thủ chống raid cho cộng đồng Discord":
    "Protogon Bot · Keyword-Auto-Reply, Verstoß-Heat, Join Gate und Raid-Schutz für die Discord-Community",
  "bị chặn: tài khoản": "blockiert: das Konto ist",
  "Bảo vệ vững chắc, giao tiếp mượt mà cho server của bạn":
    "Solider Schutz und reibungslose Kommunikation für deinen Server",
  "(24 module) bám sát cấu trúc server (ban/kick hàng loạt, phá kênh, phá role…); còn":
    "(24 Module) überwachen die Serverstruktur (Massen-Bans/Kicks, Kanal- und Rollen-Vandalismus…), während",
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
  "cùng warn tích lũy": "plus kumulierte Verwarnungen",
  "giám sát server 24/7.": "überwacht deinen Server 24/7.",
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
  "Bật rồi phải chọn kênh gửi — hoặc tắt tính năng":
    "Aktiviert, aber kein Kanal gewählt — Kanal wählen oder Funktion ausschalten",
  "Chào thành viên mới": "Neue Mitglieder begrüßen",
  "Tạm biệt thành viên rời server": "Verabschiedung für gehende Mitglieder",
  "Gửi tin chào vào kênh bạn chọn khi có thành viên tham gia":
    "Sendet eine Begrüßung in den gewählten Kanal, wenn ein Mitglied beitritt",
  "Gửi tin tạm biệt khi có thành viên rời server":
    "Sendet eine Verabschiedung, wenn ein Mitglied den Server verlässt",
  "Kênh gửi": "Zielkanal",
  "Nội dung": "Nachricht",
  "Xem trước:": "Vorschau:",
  "Gửi dạng embed": "Als Embed senden",
  "Tắt = gửi tin nhắn thường (không khung)": "Aus = als normale Nachricht senden (ohne Rahmen)",
  "Welcome & Goodbye": "Welcome & Goodbye",
  "đang bật": "aktiv",
  "Đã bật": "Aktiviert",
  "Đã tắt": "Deaktiviert",
  "Đã lưu": "Gespeichert",
  "Đã lưu — bot áp dụng trong vòng ~3 phút":
    "Gespeichert — der Bot wendet es innerhalb von ~3 Minuten an",
  "Chào thành viên mới và tạm biệt thành viên rời server — kênh riêng, nội dung tùy chỉnh. Bot không chào bot, không ping @everyone từ nội dung tùy chỉnh (an toàn chống ping sập server).":
    "Begrüße neue Mitglieder und verabschiede gehende — eigene Kanäle, eigener Text. Der Bot ignoriert Bots und pinget nie @everyone aus eigenem Text (sicher gegen Ping-Spam).",
  "Chào mừng {user} đã đến {server}! Bạn là thành viên thứ {count} 🎉":
    "Willkommen {user} auf {server}! Du bist Mitglied #{count} 🎉",
  "{user} đã rời {server}. Hẹn gặp lại!": "{user} hat {server} verlassen. Bis bald!",
  "Bot Discord · Nhiệt độ · Join Gate · Chào thành viên · Trợ lý AI":
    "Discord-Bot · Heat · Join Gate · Begrüßungen · KI-Assistent",
  "Chào thành viên mới và tạm biệt người rời đi bằng kênh riêng, nội dung tùy chỉnh với placeholder ({user}, {server}, {count}…), gửi dạng embed hoặc tin nhắn thường.":
    "Begrüße neue Mitglieder und verabschiede gehende — eigene Kanäle, eigener Text mit Platzhaltern ({user}, {server}, {count}…), als Embed oder normale Nachricht.",
  /* ==== Welcome & Goodbye v2 — template ngẫu nhiên, embed tùy chỉnh, DM, autorole ==== */
  "Template ngẫu nhiên": "Zufällige Vorlagen",
  "{n} câu": "{n} Zeilen",
  "Mỗi dòng là 1 câu — bot chọn ngẫu nhiên mỗi lượt join/leave, đỡ nhàm chán. Bật sẽ thắng nội dung ở trên.":
    "Jede Zeile ist ein Gruß — der Bot wählt bei jedem Beitreten/Verlassen zufällig eine aus, damit es nie langweilig wird. Hat Vorrang vor dem Text oben.",
  "Chào mừng {user} đến {server}!\nÊ kèo {username}, vào chơi đi!\nNgười thứ {count} vừa xuất hiện 🎉":
    "Willkommen {user} auf {server}!\nSchön dich zu sehen, {username}!\nMitglied #{count} ist gerade da 🎉",
  "🎉 Thành viên mới!": "🎉 Neues Mitglied!",
  "👋 Tạm biệt": "👋 Tschüss",
  "Màu (#hex)": "Farbe (#hex)",
  "Màu phải dạng #hex (VD: #57f287)": "Farbe muss #hex sein (z. B. #57f287)",
  "Ảnh banner (URL)": "Banner-Bild (URL)",
  "Thumbnail (URL)": "Vorschaubild (URL)",
  ThànhViênMới: "NeuesMitglied",
  "Chào qua DM": "Begrüßung per DM",
  "Gửi tin chào riêng qua tin nhắn riêng của thành viên mới":
    "Sende eine private Begrüßung an die Direktnachrichten des neuen Mitglieds",
  "Nội dung DM": "DM-Text",
  "Cảm ơn {username} đã tham gia {server}! Đọc #quy-tắc trước khi chat nhé.":
    "Danke fürs Beitreten zu {server}, {username}! Lies erst die #regeln, bevor du chattest.",
  "Autorole — tự cấp role": "Autorole — Rolle automatisch zuweisen",
  "Tự cấp role cho thành viên mới ngay khi họ vào server":
    "Weise neuen Mitgliedern automatisch eine Rolle zu, sobald sie beitreten",
  "Role cấp tự động": "Automatisch zugewiesene Rolle",
  "Chọn role": "Rolle wählen",
  "Trễ trước khi cấp (giây, 0-120)": "Verzögerung vor der Zuweisung (Sekunden, 0-120)",
  "Cấp role cho bot": "Rolle auch an Bots vergeben",
  "Mặc định tắt — bot vào server không nhận autorole":
    "Standardmäßig aus — Bots, die dem Server beitreten, erhalten die Autorolle nicht",
  "Bảo vệ raid: server đang khóa (lockdown) → autorole tạm dừng, không cấp role cho tài khoản raid dồn dập.":
    "Raidschutz: Während der Server gesperrt ist (Lockdown) pausiert die Autorolle, damit Raid-Konten die Rolle nicht bekommen.",

  /* ==== Landing — đợt viết lại copy (Lô 1). Bản DE của các key còn entry cũ
     nằm ở section theo alphabet trong i18n.de.ts (trùng, không còn dùng). */
  "bảo vệ server toàn diện": "umfassender Serverschutz",
  "hoặc gọi từ khóa để bot phản hồi tức thì. Đi kèm":
    "oder ruf ein Schlüsselwort auf und der Bot antwortet sofort. Dazu",
  "· hoạt động 24/7": "· rund um die Uhr im Einsatz",
  "Tái phạm trong 30 phút, nhiệt sẽ nhân":
    "Wiederholung in 30 Minuten — die Heat wird multipliziert",
  "Protogon gom hệ thống tự trả lời và 32 module bảo vệ (24 chống nuke + 8 auto-mod) vào một chỗ: cấu hình trực quan trên dashboard, giám sát server 24/7, có trợ lý Haimiya đồng hành khi bạn cần.":
    "Protogon vereint Auto-Reply und 32 Schutzmodule (24 Anti-Nuke + 8 Auto-Mod) an einem Ort: alles im übersichtlichen Dashboard konfigurieren, den Server 24/7 im Blick — mit Assistentin Haimiya an deiner Seite.",
  "Nhiệt tăng dần, hình phạt leo thang theo ngưỡng":
    "Heat steigt, Strafen eskalieren nach Schwellenwert",
  "Vừa bị phạt mà tái phạm, nhiệt sẽ nhân":
    "Direkt nach einer Strafe wiederholt → Heat wird multipliziert",
  "trong 30 phút. Warn tích lũy chạy song song: đủ 3 lần là tự tăng cấp.":
    "innerhalb von 30 Minuten. Kumulierte Verwarnungen laufen parallel: 3 Verwarnungen lösen die Eskalation aus.",
  "khi bất kỳ module nào vượt ngưỡng, bot sẽ chặn toàn bộ thành viên gửi tin trong server, tự mở lại sau vài phút hoặc khi mod dùng":
    "sobald ein Modul seinen Schwellenwert überschreitet, sperrt der Bot serverweit das Senden — Freigabe nach einigen Minuten oder per Mod-Befehl",
  "Đăng nhập bằng Discord, mời Protogon vào server để bật nhiệt độ, Join Gate, lọc nội dung và 32 module chống nuke ngay trên dashboard — cùng trợ lý ảo Haimiya đồng hành. Miễn phí cho mọi server.":
    "Mit Discord anmelden und Protogon einladen, um Heat, Join Gate, Inhaltsfilter und 32 Anti-Nuke-Module direkt im Dashboard zu aktivieren — mit Assistentin Haimiya an deiner Seite. Kostenlos für jeden Server.",
  "…cùng 12 module chống nuke khác, xem đầy đủ trong dashboard.":
    "…plus 12 weitere Anti-Nuke-Module, vollständig im Dashboard.",

  /* ==== Lô 2 — viết lại copy panel Overview / Settings / Branding / ModuleCard. */
  "Chưa ghi nhận sự kiện nào — bot chưa xử lý vi phạm chống nuke ở server này.":
    "Noch keine Ereignisse — der Bot hat auf diesem Server noch keinen Anti-Nuke-Verstoß bearbeitet.",
  "Tính từ tổng nhiệt độ và warn tích lũy của thành viên. Vi phạm càng nhiều thì nhiệt càng cao và mức an toàn càng giảm; khi chạm ngưỡng, hình phạt tự tăng cấp (cảnh báo → tạm khóa → kick → ban) và tái phạm bị nhân đôi nhiệt.":
    "Berechnet aus Gesamt-Heat und kumulierten Verwarnungen der Mitglieder. Mehr Verstöße → mehr Heat und niedrigere Sicherheitsstufe; ab der Schwelle eskaliert die Strafe automatisch (Verwarnung → Timeout → Kick → Ban), Wiederholung verdoppelt die Heat.",
  "Rule auto reply hỗ trợ placeholder:": "Auto-Reply-Regeln unterstützen Platzhalter:",
  "để tag người nhắn và": "um die schreibende Person zu erwähnen, und",
  "để lấy tên hiển thị.": "für den Anzeigenamen.",
  "Mọi thay đổi cấu hình được bot đồng bộ tự động trong khoảng 3 phút.":
    "Jede Konfigurationsänderung wird in etwa 3 Minuten automatisch zum Bot synchronisiert.",
  "Bảng nhiệt & warn trong Moderation có nút xóa nhiệt cho từng người hoặc toàn bộ.":
    "Die Heat- & Verwarnungstabelle in Moderation kann Heat für einzelne Mitglieder oder alle löschen.",
  "Join Gate chặn selfbot ngay khi vào server: tài khoản quá mới, thiếu avatar hoặc huy hiệu.":
    "Join Gate blockt Selfbots direkt beim Beitritt: zu neue Konten sowie Konten ohne Avatar oder Abzeichen.",
  "Module “Chống link độc hại & file nguy hiểm” quét domain lừa đảo và tệp đuôi .exe/.scr…":
    "Das Modul „Schädliche Links & gefährliche Dateien“ prüft Scam-Domains und Dateien mit Endungen wie .exe/.scr…",
  "Mod/Admin có tên trong Cài đặt được miễn trừ khỏi toàn bộ hệ thống chống nuke.":
    "In den Einstellungen eingetragene Mods/Admins sind vom gesamten Anti-Nuke-System ausgenommen.",
  "Nhiệt tự giảm dần theo phút; đủ ngưỡng là hình phạt tự tăng cấp.":
    "Heat sinkt pro Minute; ab dem Schwellenwert eskaliert die Strafe automatisch.",
  "⚡ Phạt thẳng theo hành động đã chọn, không cộng nhiệt.":
    "⚡ Straft direkt mit der gewählten Aktion und addiert keine Heat.",
  "Không có — mọi role đều bị kiểm tra": "Keine — jede Rolle wird geprüft",
  "Chưa có role nào được đồng bộ": "Noch keine Rollen synchronisiert",
  "= xóa toàn bộ tin liên quan đến vụ vi phạm.": "= löscht alle Nachrichten zum Verstoß.",
  "🔥 Nhiệt mỗi vi phạm": "🔥 Heat pro Verstoß",
  "Logo bot xuất hiện trên trang chủ, trang quản lý và toàn bộ website.":
    "Das Bot-Logo erscheint auf der Startseite, den Verwaltungsseiten und der ganzen Website.",
  "Ảnh đại diện của Haimiya trong cửa sổ trò chuyện trợ giúp.":
    "Haimiyas Avatar im Hilfe-Chatfenster.",
  "Đổi avatar bot và trợ lý AI ngay trên web — chỉ admin sở hữu bot được phép.":
    "Bot- und KI-Assistenten-Avatar direkt im Web ändern — nur für den Bot-Besitzer.",
  "Ảnh tải lên được lưu trên bộ nhớ đám mây của bot và áp dụng ngay toàn web (trang chủ, đăng nhập, dashboard, chat AI).":
    "Hochgeladene Bilder liegen im Cloud-Speicher des Bots und gelten sofort websiteweit (Startseite, Anmeldung, Dashboard, KI-Chat).",
  "Ảnh tối đa 2MB, vui lòng chọn ảnh nhỏ hơn.":
    "Bilder max. 2MB — bitte ein kleineres Bild wählen.",
  "Tải ảnh lên máy chủ thất bại (HTTP {p0})": "Bild-Upload zum Server fehlgeschlagen (HTTP {p0})",
  "Máy chủ không trả về ID ảnh — hãy thử dán đường dẫn ảnh thay thế":
    "Der Server hat keine Bild-ID zurückgegeben — füge stattdessen eine Bild-URL ein",
  "Đã đổi avatar bot, áp dụng ngay toàn web": "Bot-Avatar geändert — sofort websiteweit aktiv",
  "Đã đổi avatar Haimiya, áp dụng ngay toàn web 🎀":
    "Haimiyas Avatar geändert — sofort websiteweit aktiv 🎀",
  "Tải ảnh thất bại": "Bild-Upload fehlgeschlagen",
  "Đã lưu ảnh mới, áp dụng ngay toàn web": "Neues Bild gespeichert — sofort websiteweit aktiv",
  "Đã xóa ảnh tùy chỉnh, trở về mặc định": "Eigenes Bild entfernt — zurück zum Standard",
  "Nhận sự kiện chống nuke/raid, báo cáo hàng ngày và các thông báo quan trọng.":
    "Empfängt Anti-Nuke/Raid-Ereignisse, den Tagesbericht und weitere wichtige Hinweise.",
  "Kênh log hành động mod — auto-mod và lệnh thủ công, theo phong cách Carl-bot":
    "Log-Kanal für Mod-Aktionen — Auto-Mod und manuelle Befehle, im Carl-bot-Stil",
  "Tóm tắt sự kiện chống nuke gửi vào kênh log vào khoảng 00:00 UTC mỗi ngày":
    "Sendet täglich gegen 00:00 UTC eine Anti-Nuke-Zusammenfassung in den Log-Kanal",
  "Khi bot xác nhận raid/nuke: gửi DM khẩn cho chủ server (kẻ nuke không xóa được), AI quét chat và báo cáo vào kênh log, kèm lệnh":
    "Wenn der Bot Raid/Nuke bestätigt: dringende DM an den Serverinhaber (ein Nuker kann sie nicht löschen), die KI liest den Chat und berichtet in den Log-Kanal, samt Befehl",
  "Tắt nếu không muốn cảnh báo làm phiền cả server — mod vẫn thấy log":
    "Ausschalten, wenn die Warnung nicht den ganzen Server stören soll — Mods sehen den Log weiterhin",
  "tự gửi log khi có sự kiện; tùy chỉnh loại sự kiện, màu embed và nội dung kèm.":
    "sendet Logs automatisch bei Ereignissen; Ereignistypen, Embed-Farbe und Zusatzinhalt anpassbar.",
  "Được miễn trừ chống nuke và có quyền quản lý rule auto reply trong Discord.":
    "Vom Anti-Nuke ausgenommen und darf Auto-Reply-Regeln in Discord verwalten.",
  "Dùng để mở khóa khu vực riêng tư dành cho chủ sở hữu bot; nội dung bên trong không tiết lộ công khai. Chỉ":
    "Dient zum Entsperren des privaten Bereichs für den Bot-Besitzer; die Inhalte werden nie öffentlich gezeigt. Nur",
  "🔒 Bạn không phải admin sở hữu bot — chỉ chủ sở hữu bot mới được đặt, đổi hoặc xóa mật khẩu này.":
    "🔒 Du bist nicht der Bot-besitzende Admin — nur der Bot-Besitzer darf dieses Passwort setzen, ändern oder löschen.",
  "Chọn sắc độ xám áp dụng cho toàn bộ trang quản lý của server (nút, thẻ, sidebar).":
    "Graustufe für den gesamten Verwaltungsbereich dieses Servers wählen (Buttons, Karten, Sidebar).",
  "Đã lưu cài đặt, bot áp dụng trong khoảng 3 phút":
    "Einstellungen gespeichert — der Bot übernimmt sie in etwa 3 Minuten",
  "Prefix gồm 1–3 ký tự đặc biệt, ví dụ: !, ^, !!":
    "Das Präfix besteht aus 1–3 Sonderzeichen, z. B. !, ^, !!",
  "1–3 ký tự đặc biệt, dùng cho lệnh text như": "1–3 Sonderzeichen, für Textbefehle wie",
  ", kể cả người có quyền phá server.": ", auch für alle mit Rechten, den Server zu zerstören.",

  /* ==== Lô 3a — viết lại copy panel AntiNuke / AutoMod / AltDetection. */
  "Bảo vệ cấu trúc server khỏi các đợt tấn công hàng loạt: ban, kick, tạo/xóa kênh và role…":
    "Schützt die Serverstruktur vor Massenangriffen: Bans, Kicks, Kanal- und Rollen-Erstellung/-Löschung…",
  "⚠️ Chống nuke đang tắt toàn bộ — server chưa được bảo vệ khỏi raid.":
    "⚠️ Anti-Nuke ist vollständig aus — dein Server ist vor Raids ungeschützt.",
  "Áp cấu hình tối ưu theo quy mô server; danh sách trắng của bạn giữ nguyên.":
    "Wendet eine optimale Konfiguration für deine Servergröße an; deine Whitelist bleibt unverändert.",
  "Chia sẻ chữ ký raid ẩn danh với các server khác dùng Protogon — server của bạn được bảo vệ bằng kinh nghiệm toàn mạng.":
    "Teilt anonymisierte Raid-Signaturen mit anderen Servern, die Protogon nutzen — dein Server profitiert von serverweiter Erfahrung.",
  "Tự chặn gửi tin nhắn và voice khi phát hiện raid; mở lại khi hết giờ hoặc bằng":
    "Blockiert bei erkanntem Raid automatisch Nachrichten und Voice; Freigabe nach Ablauf der Zeit oder per",
  "(tài khoản trùng avatar/username, người tạo invite, audit log) rồi tự ban.":
    "(Konten mit gleichem Avatar/Namen, Ersteller der Einladung, Audit-Log) und bannt sie automatisch.",
  "Đã lưu cài đặt Raid Intel — bot áp dụng trong khoảng 3 phút":
    "Raid-Intel-Einstellungen gespeichert — der Bot übernimmt sie in etwa 3 Minuten",
  "Thu thập mẫu raid và dùng AI phân tích để tìm":
    "Sammelt Raid-Muster und lässt die KI nachspüren",
  "Phân tích cụm tài khoản và audit log sau mỗi vụ.":
    "Analysiert nach jedem Fall das Konten-Cluster und das Audit-Log.",
  "Đang khóa — tự mở sau khoảng {p0} phút": "Gesperrt — öffnet sich in etwa {p0} Minuten",
  "Hiện không có kênh nào bị khóa": "Aktuell ist kein Kanal gesperrt",
  "Tự động kiểm duyệt nội dung: chống spam tin nhắn, mention, từ ngữ thô tục, ảnh/file và link mời Discord":
    "Automatische Inhaltsmoderation: Nachrichten-Spam, Mentions, Schimpfwörter, Bild-/Datei-Spam und Discord-Einladungen",
  "Mỗi vi phạm cộng điểm nhiệt theo cài đặt của module. Nhiệt tăng dần rồi tự giảm theo thời gian; khi chạm ngưỡng":
    "Jede Übertretung addiert Heat nach den Moduleinstellungen. Die Heat steigt und sinkt mit der Zeit; ab der Schwelle",
  "Ngưỡng phải tăng dần: cảnh báo < tạm khóa < kick < ban (tối đa 100 điểm). Thành viên vừa bị phạt mà":
    "Schwellen müssen steigen: Verwarnung < Timeout < Kick < Ban (max. 100 Punkte). Wer bestraft wird und",
  "bật, mọi tin nhắn chứa từ trong danh sách dưới đây sẽ bị xóa và xử lý tự động. Xóa hết từ để tắt bộ lọc từ ngữ xấu.":
    "aktiv, wird jede Nachricht mit einem Wort aus der Liste unten gelöscht und automatisch behandelt. Alle Wörter entfernen, um den Schimpfwortfilter auszuschalten.",
  "Chưa có từ nào — bộ lọc từ ngữ xấu chỉ hoạt động sau khi bạn thêm từ.":
    "Noch keine Wörter — der Schimpfwortfilter greift erst, wenn du welche hinzufügst.",
  "mỗi lần vi phạm, thanh nhiệt đầy nhanh hơn.":
    "pro Verstoß, der Heat-Balken füllt sich also schneller.",
  "🔥 Bảng nhiệt và warn tích lũy của từng thành viên":
    "🔥 Heat und kumulierte Verwarnungen je Mitglied",
  "⚠️ Discord không cung cấp địa chỉ IP của thành viên cho bot, nên phát hiện VPN/Proxy trực tiếp là không khả thi với dữ liệu hiện có. Hệ thống tập trung vào phát hiện tài khoản phụ bằng bằng chứng hành vi (tuổi tài khoản, tên/avatar trùng, lịch sử bị phạt, cụm join) — cách chặn tài khoản lạm dụng VPN hiệu quả nhất mà Discord cho phép.":
    "⚠️ Discord gibt Bots keine IP-Adressen der Mitglieder preis, daher ist eine direkte VPN/Proxy-Erkennung mit den vorhandenen Daten nicht möglich. Das System erkennt Zweitkonten anhand von Verhaltensbelegen (Kontoalter, gleiche Namen/Avatare, Strafhistorie, Join-Cluster) — der wirksamste von Discord erlaubte Weg gegen Konten mit VPN-Missbrauch.",
  ": từ 2 tín hiệu mạnh trở lên → phạt đúng cấu hình; 1 tín hiệu → hạ cấp nhẹ hơn (ban → kick, kick → timeout); không có tín hiệu → chỉ theo dõi. Tắt để phạt theo điểm rủi ro như trước (dễ chặn nhầm hơn).":
    ": ab zwei starken Signalen → Strafe nach Konfiguration; ein Signal → mildere Strafe (Ban → Kick, Kick → Timeout); keine Signale → nur beobachten. Ausschalten, um wie zuvor nach Risikopunkten zu strafen (anfälliger für Fehlalarme).",
  "(8 module) sàng lọc nội dung độc hại mỗi ngày. Vượt ngưỡng, bot truy ra thủ phạm qua audit log, phạt đúng cài đặt và báo real-time về kênh log.":
    "(8 Module) filtern täglich schädliche Inhalte. Bei Schwellenwertüberschreitung ermittelt der Bot den Täter über das Audit-Log, straft nach deinen Einstellungen und alarmiert den Log-Kanal in Echtzeit.",
  "Trọn bộ trong một bot": "Das komplette Paket in einem Bot",
  "Bên cạnh những gì bạn thấy, Protogon giữ riêng một khu vực quyền lực mà chỉ chủ sở hữu bot mở khóa được bằng mật khẩu bí mật — ngay trong dashboard, không cần cài thêm gì.":
    "Neben allem Sichtbaren hält Protogon einen privaten Machtbereich bereit, den nur der Bot-Besitzer mit einem geheimen Passwort entsperrt — direkt im Dashboard, ohne Zusatzinstallation.",
  "Chào thành viên mới và tạm biệt thành viên rời server — template ngẫu nhiên, embed tùy chỉnh, DM chào riêng, autorole. Bot không chào bot, không ping @everyone từ nội dung tùy chỉnh, và tự im lặng khi server đang khóa chống raid.":
    "Begrüße neue Mitglieder und verabschiede gehende — zufällige Vorlagen, eigene Embeds, private DM-Begrüßung, Autorolle. Der Bot ignoriert Bots, pingt nie @everyone aus eigenem Inhalt und bleibt stumm, während der Server gegen Raids gesperrt ist.",

  /* ==== Lô 3b — viết lại copy panel JoinGate / Verify / Webhook / Backup. */
  "Đã thêm {p0} vào danh sách trắng": "{p0} zur Whitelist hinzugefügt",
  "Đã xóa {p0} khỏi danh sách trắng": "{p0} aus der Whitelist entfernt",
  "Kiểm tra mọi thành viên mới ngay khi vào server và tự động chặn tài khoản nghi selfbot":
    "Prüft jedes neue Mitglied beim Beitritt und blockiert verdächtige Selfbot-Konten automatisch",
  "Khi bật, mọi thành viên mới đều phải vượt qua các tiêu chí bên dưới mới được ở lại server. Ai không đạt sẽ bị":
    "Wenn aktiv, muss jedes neue Mitglied die Prüfungen unten bestehen, um im Server zu bleiben. Wer sie nicht besteht, wird",
  "⚠️ Join Gate đang tắt — mọi tài khoản đều vào được, kể cả selfbot.":
    "⚠️ Join Gate ist aus — jedes Konto darf beitreten, Selfbots inklusive.",
  "Tài khoản mới hơn số ngày dưới đây sẽ bị chặn (0 = tắt). Selfbot thường đăng ký tài khoản mới hàng loạt.":
    "Konten, die jünger sind als die unten angegebenen Tage, werden blockiert (0 = aus). Selfbots registrieren meist massenhaft frische Konten.",
  "Khuyến nghị 7–14 ngày để chặn tài khoản dùng một lần.":
    "Empfohlen sind 7–14 Tage, um Wegwerf-Konten zu blockieren.",
  "Tài khoản còn dùng ảnh đại diện mặc định sẽ bị chặn.":
    "Konten, die noch das Standard-Avatar nutzen, werden blockiert.",
  "Tài khoản không có huy hiệu công khai nào (flag = 0) sẽ bị chặn — selfbot mới gần như không bao giờ có huy hiệu.":
    "Konten ganz ohne öffentliches Abzeichen (flag = 0) werden blockiert — frische Selfbots haben fast nie eines.",
  "Chặn người vào khi server đang bị raid":
    "Beitritte blockieren, während der Server geraidet wird",
  "Khi server đang khóa kênh vì raid, mọi thành viên mới đều bị xử lý — cắt đợt tấn công thứ hai.":
    "Solange der Server wegen eines Raids gesperrt ist, wird jedes neue Mitglied bestraft — das stoppt die zweite Welle.",
  "— bật tiêu chí trên thì mọi thành viên mới sẽ bị xử lý ngay lúc này.":
    "— mit der Prüfung oben wird jetzt jedes neue Mitglied bestraft.",
  "Kick = có thể quay lại; Ban = chặn vĩnh viễn (hiệu quả hơn với selfbot).":
    "Kick = sie können zurückkommen; Ban = dauerhaft gesperrt (wirksamer gegen Selfbots).",
  "— tài khoản vi phạm bị chặn vĩnh viễn. Chọn Kick nếu bạn muốn nhẹ tay hơn.":
    "— verstoßende Konten werden dauerhaft gesperrt. Wähle Kick, wenn du milder sein willst.",
  ", bỏ qua mọi tiêu chí — dành cho tài khoản phụ hoặc người bạn tin tưởng.":
    ", überspringen jede Prüfung — für Zweitkonten oder Personen, denen du vertraust.",
  "trạng thái email/số điện thoại đã xác thực, nên Join Gate chỉ dựa vào tín hiệu công khai (tuổi tài khoản, avatar, huy hiệu, trạng thái raid) để nhận diện selfbot.":
    "ob eine E-Mail-Adresse oder Telefonnummer verifiziert ist, daher nutzt Join Gate nur öffentliche Signale (Kontoalter, Avatar, Abzeichen, Raid-Status), um Selfbots zu erkennen.",
  "để xử lý. Muốn một người luôn được vào, hãy thêm ID của họ vào danh sách trắng phía trên.":
    "um zu handeln. Damit jemand immer hineinkommt, füge seine ID oben zur Whitelist hinzu.",
  "Thành viên mới nhận role Unverified và phải xác minh trước khi vào server.":
    "Neue Mitglieder erhalten die Rolle Unverified und müssen sich verifizieren, bevor sie den Server sehen.",
  "Khi bật, thành viên mới nhận role chưa xác minh và phải verify mới vào được server.":
    "Wenn aktiv, erhalten neue Mitglieder die unverifizierte Rolle und müssen sich verifizieren, um den Server zu betreten.",
  "— thành viên bấm nút là xác minh xong ngay.":
    "— Mitglieder klicken einen Button und sind sofort verifiziert.",
  "— bot gửi mã qua DM, thành viên nhập lại mã trong kênh.":
    "— der Bot sendet einen Code per DM und das Mitglied tippt ihn im Kanal ein.",
  "Bot gửi embed chào mừng qua DM ngay khi thành viên xác minh thành công.":
    "Der Bot sendet das Willkommens-Embed per DM, sobald ein Mitglied erfolgreich verifiziert ist.",
  "Role tự gán cho thành viên mới ngay khi vừa vào server.":
    "Rolle wird automatisch vergeben, sobald ein neues Mitglied beitritt.",
  "Role gán sau khi xác minh thành công; role chưa xác minh được gỡ ra.":
    "Rolle wird nach erfolgreicher Verifizierung vergeben; die unverifizierte Rolle wird entfernt.",
  "— thiết lập xác minh ngay trong Discord.": "— richte die Verifizierung direkt in Discord ein.",
  "Chưa có nội dung embed — hãy soạn ở khung bên trái.":
    "Noch kein Embed-Inhalt — schreibe etwas im linken Bereich.",
  "Đã gửi thành công! Kiểm tra kênh Discord.": "Erfolgreich gesendet! Prüfe den Discord-Kanal.",
  "(theo Kênh log trong Cài đặt) · nhận mọi log hình phạt và anti nuke/raid.":
    "(folgt dem Log-Kanal in den Einstellungen) · erhält jeden Straf- und Anti-Nuke/Raid-Log.",
  "tự tạo trong khoảng 1 phút": "erstellt ihn in etwa 1 Minute",
  "chọn Kênh log": "Log-Kanal festlegen",
  "Dán webhook URL từ Discord (Kênh → Tích hợp → Webhook → Tạo webhook), soạn nội dung và embed rồi bấm gửi.":
    "Füge eine Webhook-URL aus Discord ein (Kanal → Integrationen → Webhooks → Neuer Webhook), schreibe Nachricht und Embed und drücke Senden.",
  "Tên người gửi ghi đè (tùy chọn)": "Anzeigename überschreiben (optional)",
  "Hiển thị thời gian hiện tại": "Aktuelle Uhrzeit anzeigen",
  "• Dán URL vào ô trên, soạn embed với tiêu đề, mô tả, màu sắc, field… rồi bấm":
    "• Füge die URL oben ein, erstelle ein Embed mit Titel, Beschreibung, Farbe und Feldern… und drücke",
  "• Webhook mặc định (Protogon Log) ở trên chỉ dùng để nhận log hình phạt và anti nuke từ bot — không liên quan tới trình gửi embed.":
    "• Der Standard-Webhook (Protogon Log) oben empfängt nur Straf- und Anti-Nuke-Logs vom Bot — er hat nichts mit dem Embed-Sender zu tun.",
  "Hãy kiểm tra lại file backup hoặc tải lại file khác.":
    "Prüfe die Backup-Datei erneut oder lade eine andere hoch.",
  "Bot đã dừng giữa chừng. Kiểm tra bot còn trong server và đủ quyền Administrator rồi thử khôi phục lại.":
    "Der Bot hat mittendrin abgebrochen. Prüfe, ob er noch im Server ist und Administratorrechte hat, und starte die Wiederherstellung erneut.",
  "Bot đã dừng giữa chừng. Kiểm tra bot còn trong server và đủ quyền Administrator rồi bấm Backup ngay lại.":
    "Der Bot hat mittendrin abgebrochen. Prüfe, ob er noch im Server ist und Administratorrechte hat, und klicke erneut auf Jetzt sichern.",
  "Bot không gửi heartbeat (offline hơn 3 phút). Hãy khởi động bot trên host (pm2 start protogon-bot / bật lại service) rồi bấm Backup ngay sau khi bot online.":
    "Der Bot sendet keine Heartbeats (länger als 3 Minuten offline). Starte ihn auf deinem Host (pm2 start protogon-bot / Dienst neu starten) und klicke dann auf Jetzt sichern.",
  "Bot không gửi heartbeat. Hãy khởi động bot trên host rồi thử khôi phục lại sau khi bot online.":
    "Der Bot sendet keine Heartbeats. Starte ihn auf deinem Host und versuche die Wiederherstellung danach erneut.",
  "Role, quyền role và kênh sẽ được tạo lại theo backup. Kết quả sẽ hiện ở đây.":
    "Rollen, Rollenrechte und Kanäle werden aus dem Backup neu erstellt. Das Ergebnis erscheint hier.",
  "Sao lưu cấu trúc server (role, quyền role, kênh và quyền kênh) lên":
    "Sichert deine Serverstruktur (Rollen, Rollenrechte, Kanäle und Kanalrechte) in",
  ". Khi server bị nuke/raid phá sập hoàn toàn, hãy mời bot vào":
    ". Wird dein Server durch Nuke oder Raid ausgelöscht, lade den Bot in einen",
  "Đang khôi phục vào server này… server lớn kèm tin nhắn có thể mất vài phút. Kết quả hiện ở đây và trong kênh log.":
    "Wiederherstellung läuft… ein großer Server mit Nachrichten kann einige Minuten brauchen. Das Ergebnis erscheint hier und im Log-Kanal.",
  "Bot sao lưu toàn bộ": "Der Bot sichert alle",
  "Kèm tin nhắn và media (tối đa 50 tin/kênh)":
    "Nachrichten und Medien einschließen (bis zu 50 pro Kanal)",
  "Nếu server bị": "Wenn dein Server von",
  "phá sập mà bạn còn giữ được file backup của nó (định dạng":
    "zerstört wurde und du noch die Backup-Datei hast (Format",
  "(gồm cả media — file lưu trên đám mây, không nhét vào bộ nhớ bot). Bot giữ nguyên role/kênh có sẵn của server hiện tại, chỉ thêm mới theo file chứ không xóa gì.":
    "(inklusive Medien — die Datei bleibt in der Cloud und wird nicht in den Bot-Speicher geladen). Der Bot behält die vorhandenen Rollen und Kanäle des aktuellen Servers und fügt nur hinzu, was in der Datei steht — gelöscht wird nichts.",
  "Bot tự sao lưu và đẩy lên": "Der Bot sichert und lädt hoch zu",
  "). Bot chỉ giữ": "). Der Bot behält nur",
  "trong bot — bản cũ hơn tự bị xóa, còn GitHub giữ bản lưu vĩnh viễn.":
    "im Bot — ältere werden automatisch gelöscht, GitHub behält sie dauerhaft.",
  "Bật lên là bot sao lưu bản đầu tiên trong khoảng 1 phút, sau đó lặp lại theo chu kỳ bạn chọn.":
    "Beim Einschalten erstellt der Bot in etwa einer Minute das erste Backup und wiederholt das im gewählten Zyklus.",
  "(.msc/.json tải lên). Phần tắt sẽ được bỏ qua khi khôi phục (kênh, tin nhắn và media vẫn xử lý bình thường).":
    "(.msc/.json-Uploads). Deaktivierte Teile werden bei der Wiederherstellung übersprungen (Kanäle, Nachrichten und Medien werden weiterhin verarbeitet).",
  "Đã yêu cầu tạo backup — bot thực hiện trong khoảng 20 giây":
    "Backup angefordert — der Bot führt es in etwa 20 Sekunden aus",
  "Đã yêu cầu khôi phục — bot thực hiện trong khoảng 1 phút":
    "Wiederherstellung angefordert — der Bot führt sie in etwa 1 Minute aus",

  /* ==== Lô 4 — viết lại copy panel AutoReply / Welcome & Goodbye / Giveaway / ReactionRoles. */
  "Bot tự trả lời khi tin nhắn chứa từ khóa hoặc tag @bot":
    "Der Bot antwortet automatisch, wenn eine Nachricht ein Stichwort enthält oder @bot markiert",
  "Chưa có rule nào. Tạo rule đầu tiên để bot tự trả lời khi ai đó gõ từ khóa hoặc tag bot.":
    "Noch keine Regel. Erstelle die erste, und der Bot antwortet, sobald jemand ein Stichwort tippt oder ihn markiert.",
  "Bot trả lời thành viên mỗi khi điều kiện kích hoạt bên dưới được thỏa.":
    "Der Bot antwortet einem Mitglied, sobald der Auslöser unten zutrifft.",
  'Đã bật rule "{p0}"': 'Regel "{p0}" aktiviert',
  'Đã tắt rule "{p0}"': 'Regel "{p0}" deaktiviert',
  "Giãn cách giữa các lần trả lời (giây, 0 = không giới hạn)":
    "Abstand zwischen Antworten (Sekunden, 0 = unbegrenzt)",
  "Gửi lời chào vào kênh bạn chọn mỗi khi có thành viên tham gia":
    "Sendet eine Begrüßung in den gewählten Kanal, sobald ein Mitglied beitritt",
  "Gửi lời tạm biệt khi có thành viên rời server":
    "Sendet einen Abschiedsgruß, wenn ein Mitglied den Server verlässt",
  "Mỗi dòng là một câu — bot chọn ngẫu nhiên mỗi lượt vào/rời server để tin nhắn không bị nhàm. Điền vào đây thì phần này thay cho nội dung ở trên.":
    "Eine Aussage pro Zeile — der Bot wählt bei jedem Beitritt oder Austritt zufällig eine, damit der Gruß nie eintönig wird. Ausgefüllt ersetzt dieser Teil die Nachricht oben.",
  "Đã lưu — bot áp dụng trong khoảng 3 phút":
    "Gespeichert — der Bot übernimmt es in etwa 3 Minuten",
  "Đang bật thì phải chọn kênh gửi, hoặc tắt tính năng này.":
    "Solange das aktiv ist, musst du einen Kanal wählen — oder die Funktion abschalten.",
  "Màu phải ở dạng #hex, ví dụ #57f287": "Die Farbe muss #hex sein, zum Beispiel #57f287",
  "Gửi lời chào riêng qua tin nhắn trực tiếp (DM) cho thành viên mới":
    "Sendet eine private Begrüßung per DM an das neue Mitglied",
  "Tự gán role cho thành viên mới ngay khi họ vào server":
    "Vergibt neuen Mitgliedern automatisch eine Rolle, sobald sie beitreten",
  "Role gán tự động": "Automatisch vergebene Rolle",
  "Chờ trước khi gán (giây, 0–120)": "Wartezeit vor der Vergabe (Sekunden, 0–120)",
  "Mặc định tắt — bot mới vào server không nhận role tự động":
    "Standardmäßig aus — beitretende Bots erhalten keine automatische Rolle",
  "Chống raid: khi server đang khóa vì raid, autorole tạm dừng để không gán role cho loạt tài khoản ập vào.":
    "Anti-Raid: Während der Server wegen eines Raids gesperrt ist, pausiert Autorole, damit keine Rollen an eine Kontenflut vergeben werden.",
  "Chào thành viên mới và tạm biệt người rời server: template ngẫu nhiên, embed tùy chỉnh, DM chào riêng và autorole. Bot không chào bot, không bao giờ ping @everyone từ nội dung bạn nhập, và tự im lặng khi server đang khóa chống raid.":
    "Begrüßt neue Mitglieder und verabschiedet gehende: zufällige Vorlagen, eigene Embeds, private DM-Begrüßung und Autorole. Der Bot begrüßt keine Bots, pingt nie @everyone aus deinem Text und bleibt stumm, während der Server gegen Raids gesperrt ist.",
  "Tắt = gửi tin nhắn thường, không có khung embed.": "Aus = einfache Nachricht ohne Embed-Rahmen.",
  "Chào mừng {user} đến {server}!\nRất vui có {username} trong nhà!\nNgười thứ {count} vừa xuất hiện 🎉":
    "Willkommen {user} auf {server}!\nSchön, dass {username} dabei ist!\nMitglied Nummer {count} ist da 🎉",
  "Chọn mẫu tin nhắn, thêm ảnh, viết lời dẫn và cấp role thưởng tự động — bot chọn người thắng rồi thông báo.":
    "Wähle eine Nachrichtenvorlage, füge ein Bild hinzu, schreibe den Einleitungstext und vergib automatisch eine Gewinnrolle — der Bot zieht die Gewinner und verkündet sie.",
  "Đã tạo giveaway — bot gửi trong khoảng 1 phút 🎉":
    "Giveaway erstellt — der Bot postet es in etwa 1 Minute 🎉",
  "⚠️ Bot không gửi được giveaway:": "⚠️ Der Bot konnte das Giveaway nicht posten:",
  "Chưa có giveaway nào. Tạo cái đầu tiên để chúc mừng thành viên 🎀":
    "Noch kein Giveaway. Erstelle das erste, um deine Mitglieder zu feiern 🎀",
  "Bot gửi embed giveaway kèm phản ứng 🎉 theo mẫu bạn chọn (thêm ảnh nếu muốn). Hết giờ, bot tự chọn người thắng, cấp role thưởng (nếu có) và thông báo.":
    "Der Bot postet das Giveaway-Embed mit 🎉-Reaktion in der gewählten Vorlage (auf Wunsch mit Bild). Nach Ablauf zieht er die Gewinner, vergibt die Gewinnrolle (falls gesetzt) und verkündet sie.",
  "Lời dẫn tùy chỉnh (hiện ở đầu embed, để trống = dùng giải thưởng)":
    "Eigener Einleitungstext (oben im Embed; leer lassen = Gewinn wird verwendet)",
  "Bot nhắn riêng kèm giải thưởng cho từng người thắng":
    "Der Bot schreibt jedem Gewinner eine DM mit dem Gewinn",
  "Thành viên bấm emoji dưới tin nhắn để tự nhận hoặc gỡ role. Tùy chỉnh được tên, mô tả, thumbnail và từng cặp emoji → role.":
    "Mitglieder klicken ein Emoji unter der Nachricht, um eine Rolle zu erhalten oder abzugeben. Titel, Beschreibung, Thumbnail und jedes Emoji-→-Rollen-Paar sind anpassbar.",
  "Mỗi dòng cần có emoji và role được chọn": "Jede Zeile braucht ein Emoji und eine Rolle",
  "Đã cập nhật bảng — bot gửi bảng mới trong khoảng 1 phút":
    "Panel aktualisiert — der Bot postet das neue Panel in etwa 1 Minute",
  "Đã tạo bảng — bot gửi tin nhắn trong khoảng 1 phút":
    "Panel erstellt — der Bot postet die Nachricht in etwa 1 Minute",
  "Bot gửi bảng mới với nội dung đã chỉnh trong khoảng 1 phút (tin nhắn cũ vẫn còn).":
    "Der Bot postet dein geändertes Panel in etwa 1 Minute (die alte Nachricht bleibt).",
  "Bot gửi một tin nhắn vào kênh đã chọn kèm các emoji; thành viên bấm emoji để nhận role.":
    "Der Bot postet eine Nachricht mit den Emojis im gewählten Kanal; Mitglieder klicken ein Emoji, um die Rolle zu erhalten.",
};
