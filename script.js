const form = document.querySelector("#reserve-form");
const dialog = document.querySelector("#demo-dialog");
const summary = document.querySelector("#dialog-summary");
const error = document.querySelector("#form-error");
const planSelect = document.querySelector("#plan-select");
const dialogKicker = document.querySelector("#dialog-kicker");
const dialogTitle = document.querySelector("#dialog-title");
const dialogReceipt = document.querySelector("#dialog-receipt");
const dialogNote = document.querySelector("#dialog-note");
const shareButton = document.querySelector("#share-application");
const shareStatus = document.querySelector("#share-status");

let applicationText = "";

const sourceParams = new URLSearchParams(window.location.search);

function cleanSource(value) {
  return value ? value.trim().slice(0, 120) : "";
}

function getSourceLabel() {
  const parts = [
    cleanSource(sourceParams.get("source") || sourceParams.get("utm_source")),
    cleanSource(sourceParams.get("utm_campaign")),
    cleanSource(sourceParams.get("utm_content") || sourceParams.get("qr")),
  ].filter(Boolean);

  return parts.length ? parts.join(" / ") : "прямой переход";
}

function copyText(text) {
  if (navigator.clipboard && window.isSecureContext) {
    return navigator.clipboard.writeText(text);
  }

  const field = document.createElement("textarea");
  field.value = text;
  field.setAttribute("readonly", "");
  field.style.position = "fixed";
  field.style.opacity = "0";
  document.body.appendChild(field);
  field.select();
  const copied = document.execCommand("copy");
  field.remove();

  return copied ? Promise.resolve() : Promise.reject(new Error("copy_failed"));
}

document.querySelectorAll(".select-plan").forEach((button) => {
  button.addEventListener("click", () => {
    planSelect.value = button.dataset.plan;
    document.querySelector("#reserve").scrollIntoView({ behavior: "smooth" });
    window.setTimeout(() => document.querySelector("#reserve-form input").focus(), 500);
  });
});

form.addEventListener("submit", (event) => {
  event.preventDefault();
  error.textContent = "";

  if (!form.checkValidity()) {
    error.textContent = "Заполните обязательные поля и подтвердите условия.";
    form.reportValidity();
    return;
  }

  const data = new FormData(form);
  const source = getSourceLabel();
  const entrance = data.get("entrance").trim();
  const location = [
    data.get("city"),
    `ЖК «${data.get("complex")}»`,
    data.get("address"),
    entrance ? `подъезд/секция ${entrance}` : "",
  ].filter(Boolean);

  applicationText = [
    "Заявка на пилот «За дверью»",
    `Имя: ${data.get("name")}`,
    `Телефон: ${data.get("phone")}`,
    `Адрес: ${location.join(", ")}`,
    `Время: ${data.get("slot")}`,
    `Тариф: ${data.get("plan")}`,
    `Источник: ${source}`,
  ].join("\n");

  dialogKicker.textContent = "Заявка готова";
  dialogTitle.textContent = "Отправьте её автору публикации";
  summary.textContent = `ЖК «${data.get("complex")}», ${data.get("address")}; удобное время — ${data.get("slot")}.`;
  dialogReceipt.hidden = false;
  dialogNote.hidden = false;
  shareButton.hidden = false;
  shareStatus.textContent = "";
  shareButton.textContent = navigator.share ? "Отправить заявку" : "Скопировать заявку";
  dialog.showModal();
});

shareButton.addEventListener("click", async () => {
  shareStatus.textContent = "";

  try {
    if (navigator.share) {
      await navigator.share({
        title: "Заявка на пилот «За дверью»",
        text: applicationText,
      });
      shareStatus.textContent = "Заявка передана выбранному получателю.";
      return;
    }

    await copyText(applicationText);
    shareStatus.textContent = "Заявка скопирована. Отправьте её автору публикации.";
  } catch (shareError) {
    if (shareError.name === "AbortError") {
      shareStatus.textContent = "Отправка отменена. Заявка осталась в форме.";
      return;
    }

    shareStatus.textContent = "Не удалось подготовить отправку. Скопируйте данные из формы вручную.";
  }
});

document.querySelectorAll(".dialog-close, .dialog-done").forEach((button) => {
  button.addEventListener("click", () => dialog.close());
});

dialog.addEventListener("click", (event) => {
  if (event.target === dialog) dialog.close();
});

document.querySelectorAll(".legal-link").forEach((button) => {
  button.addEventListener("click", () => {
    dialogKicker.textContent = "Документы";
    dialogTitle.textContent = "Юридические условия готовятся";
    summary.textContent = "Полные условия и политика конфиденциальности будут добавлены до подключения прямого сбора заявок и оплаты. Текущая форма не хранит данные на сайте.";
    dialogReceipt.hidden = true;
    dialogNote.hidden = true;
    shareButton.hidden = true;
    shareStatus.textContent = "";
    dialog.showModal();
  });
});
