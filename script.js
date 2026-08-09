const form = document.querySelector("#reserve-form");
const dialog = document.querySelector("#demo-dialog");
const summary = document.querySelector("#dialog-summary");
const error = document.querySelector("#form-error");
const planSelect = document.querySelector("#plan-select");

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
  summary.textContent = `${data.get("building")}, ${data.get("slot")}. Вы выбрали тариф «${data.get("plan")}».`;
  dialog.showModal();
});

document.querySelectorAll(".dialog-close, .dialog-done").forEach((button) => {
  button.addEventListener("click", () => dialog.close());
});

dialog.addEventListener("click", (event) => {
  if (event.target === dialog) dialog.close();
});

document.querySelectorAll(".legal-link").forEach((button) => {
  button.addEventListener("click", () => {
    summary.textContent = "Юридические документы будут добавлены после регистрации продавца и проверки юристом.";
    dialog.showModal();
  });
});
