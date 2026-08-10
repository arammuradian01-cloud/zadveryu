const COOKIE_CONSENT_NAME = "zd_cookie_consent";
const COOKIE_CONSENT_VERSION = "1.0";
const COOKIE_CONSENT_MAX_AGE = 60 * 60 * 24 * 180;

function readCookieConsent() {
  const prefix = `${COOKIE_CONSENT_NAME}=`;
  const cookie = document.cookie
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith(prefix));

  if (!cookie) return null;

  try {
    const record = JSON.parse(decodeURIComponent(cookie.slice(prefix.length)));
    return record.version === COOKIE_CONSENT_VERSION ? record : null;
  } catch {
    return null;
  }
}

function writeCookieConsent(choice) {
  const record = {
    version: COOKIE_CONSENT_VERSION,
    choice,
    necessary: true,
    analytics: false,
    marketing: false,
    selectedAt: new Date().toISOString(),
  };
  const secure = window.location.protocol === "https:" ? "; Secure" : "";

  document.cookie = `${COOKIE_CONSENT_NAME}=${encodeURIComponent(JSON.stringify(record))}; Path=/; Max-Age=${COOKIE_CONSENT_MAX_AGE}; SameSite=Lax${secure}`;
  window.dispatchEvent(new CustomEvent("zd:cookie-consent", { detail: record }));
  return record;
}

function createCookieBanner() {
  const banner = document.createElement("section");
  banner.className = "cookie-banner";
  banner.id = "cookie-banner";
  banner.hidden = true;
  banner.setAttribute("role", "dialog");
  banner.setAttribute("aria-label", "Настройки cookie");
  banner.setAttribute("aria-live", "polite");
  banner.innerHTML = `
    <div>
      <h2 class="cookie-banner__title">Cookie на сайте</h2>
      <p class="cookie-banner__text">
        Мы используем только необходимый cookie, чтобы сохранить ваш выбор. Аналитические и рекламные cookie сейчас отключены.
        При отказе сохраним минимальную техническую отметку, чтобы не спрашивать повторно.
        <a href="cookies.html">Подробнее</a>
      </p>
    </div>
    <div class="cookie-banner__actions">
      <button class="cookie-choice cookie-choice--decline" type="button" data-cookie-choice="declined">Отклонить</button>
      <button class="cookie-choice cookie-choice--accept" type="button" data-cookie-choice="accepted">Принять cookie</button>
    </div>
  `;

  banner.querySelectorAll("[data-cookie-choice]").forEach((button) => {
    button.addEventListener("click", () => {
      writeCookieConsent(button.dataset.cookieChoice);
      banner.hidden = true;
    });
  });

  document.body.appendChild(banner);
  return banner;
}

function openCookieBanner(banner) {
  banner.hidden = false;
  banner.querySelector(".cookie-choice--accept").focus({ preventScroll: true });
}

document.addEventListener("DOMContentLoaded", () => {
  const banner = createCookieBanner();
  const consent = readCookieConsent();

  if (!consent) openCookieBanner(banner);

  document.querySelectorAll("[data-cookie-settings]").forEach((button) => {
    button.addEventListener("click", () => openCookieBanner(banner));
  });
});
