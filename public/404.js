(() => {
  const copy = {
    vi: {
      title: "Trang này đi lệch hướng.",
      body: "Liên kết có thể đã cũ hoặc địa chỉ bị sai. Quay lại Protogon và thử lại.",
      home: "Về trang chủ",
    },
    en: {
      title: "This page took a wrong turn.",
      body: "The link may be outdated or the address may contain a typo. Head back to Protogon and try again.",
      home: "Back to home",
    },
    de: {
      title: "Diese Seite ist falsch abgebogen.",
      body: "Der Link ist möglicherweise veraltet oder die Adresse enthält einen Fehler. Zurück zu Protogon und erneut versuchen.",
      home: "Zur Startseite",
    },
  };

  let lang = "";
  try {
    lang = window.localStorage.getItem("protogon-lang") || window.navigator.language.slice(0, 2);
  } catch {
    lang = window.navigator.language.slice(0, 2);
  }
  const selected = copy[lang] || copy.en;
  document.documentElement.lang = lang === "vi" || lang === "de" ? lang : "en";
  document.querySelector("[data-404-title]")?.replaceChildren(selected.title);
  document.querySelector("[data-404-body]")?.replaceChildren(selected.body);
  const home = document.querySelector("[data-404-home]");
  if (home) {
    home.textContent = selected.home;
  }
})();
