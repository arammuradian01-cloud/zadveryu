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
const cityInput = form.elements.city;
const addressInput = form.elements.address;
const addressSuggestions = document.querySelector("#address-suggestions");
const addressStatus = document.querySelector("#address-status");
const dadataToken = document.querySelector('meta[name="dadata-token"]')?.content.trim() || "";

const DADATA_ADDRESS_URL = "https://suggestions.dadata.ru/suggestions/api/4_1/rs/suggest/address";
const ADDRESS_SEARCH_DELAY = 320;

let addressSearchTimer;
let addressSearchController;
let addressResults = [];
let activeAddressIndex = -1;

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

function closeAddressSuggestions() {
  addressSuggestions.hidden = true;
  addressSuggestions.replaceChildren();
  addressInput.setAttribute("aria-expanded", "false");
  addressInput.removeAttribute("aria-activedescendant");
  addressResults = [];
  activeAddressIndex = -1;
}

function setActiveAddress(index) {
  const options = [...addressSuggestions.querySelectorAll(".address-suggestion")];
  if (!options.length) return;

  activeAddressIndex = (index + options.length) % options.length;
  options.forEach((option, optionIndex) => {
    const isActive = optionIndex === activeAddressIndex;
    option.classList.toggle("is-active", isActive);
    option.setAttribute("aria-selected", String(isActive));
  });

  const activeOption = options[activeAddressIndex];
  addressInput.setAttribute("aria-activedescendant", activeOption.id);
  activeOption.scrollIntoView({ block: "nearest" });
}

function getSuggestionCity(data) {
  return data.city || data.settlement || data.region || "";
}

function selectAddress(suggestion) {
  addressInput.value = suggestion.value;

  const selectedCity = getSuggestionCity(suggestion.data);
  if (selectedCity) cityInput.value = selectedCity;

  if (!suggestion.data.house) {
    delete addressInput.dataset.dadataSelected;
    delete addressInput.dataset.fullAddress;
    delete addressInput.dataset.fiasId;
    addressInput.value = `${suggestion.value}, `;
    addressStatus.textContent = "Добавьте номер дома и выберите полный адрес.";
    closeAddressSuggestions();
    addressInput.focus();
    return;
  }

  addressInput.dataset.dadataSelected = "true";
  addressInput.dataset.fullAddress = suggestion.unrestricted_value || suggestion.value;
  addressInput.dataset.fiasId = suggestion.data.fias_id || "";
  addressStatus.textContent = "Адрес дома выбран из DaData.";
  closeAddressSuggestions();
}

function renderAddressSuggestions(suggestions) {
  closeAddressSuggestions();
  addressResults = suggestions;

  if (!suggestions.length) {
    addressStatus.textContent = "Адрес не найден. Проверьте улицу и номер дома.";
    return;
  }

  suggestions.forEach((suggestion, index) => {
    const option = document.createElement("button");
    option.type = "button";
    option.id = `address-option-${index}`;
    option.className = "address-suggestion";
    option.tabIndex = -1;
    option.setAttribute("role", "option");
    option.setAttribute("aria-selected", "false");

    const title = document.createElement("strong");
    title.textContent = suggestion.value;
    option.appendChild(title);

    const details = [suggestion.data.postal_code, suggestion.data.region_with_type]
      .filter(Boolean)
      .filter((value, valueIndex, values) => values.indexOf(value) === valueIndex);
    if (details.length) {
      const subtitle = document.createElement("small");
      subtitle.textContent = details.join(" · ");
      option.appendChild(subtitle);
    }

    option.addEventListener("mousedown", (event) => event.preventDefault());
    option.addEventListener("click", () => selectAddress(suggestion));
    option.addEventListener("mouseenter", () => setActiveAddress(index));
    addressSuggestions.appendChild(option);
  });

  addressSuggestions.hidden = false;
  addressInput.setAttribute("aria-expanded", "true");
  addressStatus.textContent = `Найдено вариантов: ${suggestions.length}.`;
}

function buildAddressQuery(value) {
  const city = cityInput.value.trim();
  if (!city || value.toLocaleLowerCase("ru").includes(city.toLocaleLowerCase("ru"))) return value;
  return `${city}, ${value}`;
}

async function searchAddress(value) {
  if (!dadataToken) return;

  addressSearchController?.abort();
  addressSearchController = new AbortController();
  addressStatus.textContent = "Ищем адрес…";

  try {
    const response = await fetch(DADATA_ADDRESS_URL, {
      method: "POST",
      mode: "cors",
      signal: addressSearchController.signal,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Token ${dadataToken}`,
      },
      body: JSON.stringify({
        query: buildAddressQuery(value),
        count: 7,
        to_bound: { value: "house" },
      }),
    });

    if (!response.ok) throw new Error(`dadata_${response.status}`);
    const payload = await response.json();
    renderAddressSuggestions(payload.suggestions || []);
  } catch (searchError) {
    if (searchError.name === "AbortError") return;
    closeAddressSuggestions();
    addressStatus.textContent = "Подсказки временно недоступны — адрес можно ввести вручную.";
  }
}

addressInput.addEventListener("input", () => {
  delete addressInput.dataset.dadataSelected;
  delete addressInput.dataset.fullAddress;
  delete addressInput.dataset.fiasId;
  window.clearTimeout(addressSearchTimer);
  closeAddressSuggestions();

  const value = addressInput.value.trim();
  if (!dadataToken || value.length < 3) {
    addressStatus.textContent = dadataToken && value ? "Введите ещё несколько букв." : "";
    return;
  }

  addressSearchTimer = window.setTimeout(() => searchAddress(value), ADDRESS_SEARCH_DELAY);
});

addressInput.addEventListener("keydown", (event) => {
  if (addressSuggestions.hidden || !addressResults.length) return;

  if (event.key === "ArrowDown") {
    event.preventDefault();
    setActiveAddress(activeAddressIndex + 1);
  } else if (event.key === "ArrowUp") {
    event.preventDefault();
    setActiveAddress(activeAddressIndex - 1);
  } else if (event.key === "Enter" && activeAddressIndex >= 0) {
    event.preventDefault();
    selectAddress(addressResults[activeAddressIndex]);
  } else if (event.key === "Escape") {
    closeAddressSuggestions();
  }
});

addressInput.addEventListener("blur", () => {
  window.setTimeout(closeAddressSuggestions, 150);
});

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
  const rawAddress = data.get("address").trim();
  const fullAddress = addressInput.dataset.dadataSelected === "true"
    ? addressInput.dataset.fullAddress || rawAddress
    : [data.get("city"), rawAddress].filter(Boolean).join(", ");
  const location = [
    `ЖК «${data.get("complex")}»`,
    fullAddress,
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
