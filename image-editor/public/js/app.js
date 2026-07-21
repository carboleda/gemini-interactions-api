const dropzone = document.getElementById("dropzone");
const dropzoneEmpty = document.getElementById("dropzoneEmpty");
const fileInput = document.getElementById("fileInput");
const thumbnail = document.getElementById("thumbnail");
const promptInput = document.getElementById("prompt");
const chipsContainer = document.getElementById("chips");
const modelSelect = document.getElementById("modelSelect");
const editButton = document.getElementById("editButton");
const consoleEl = document.getElementById("console");
const compareContainer = document.getElementById("compareContainer");
const resultPlaceholder = document.getElementById("resultPlaceholder");
const beforeImage = document.getElementById("beforeImage");
const afterImage = document.getElementById("afterImage");
const afterWrapper = document.getElementById("afterWrapper");
const compareHandle = document.getElementById("compareHandle");
const downloadButton = document.getElementById("downloadButton");
const historyList = document.getElementById("historyList");
const resetAllButton = document.getElementById("resetAllButton");

let currentFile = null;
let currentEventSource = null;
let sessionId = null;
let sessionEstablished = false;

let history = [];
let activeVersion = 0;
let isEditing = false;

function logToConsole(message, isError = false) {
  const empty = consoleEl.querySelector(".console-empty");
  if (empty) empty.remove();

  const line = document.createElement("div");
  line.className = "console-line" + (isError ? " error" : "");

  const ts = document.createElement("span");
  ts.className = "ts";
  ts.textContent = new Date().toLocaleTimeString();

  const text = document.createElement("span");
  text.textContent = message;

  line.append(ts, text);
  consoleEl.appendChild(line);
  consoleEl.scrollTop = consoleEl.scrollHeight;
}

function updateEditButtonState() {
  editButton.disabled = !currentFile || !promptInput.value.trim();
}

function setLoading(isLoading) {
  editButton.disabled = isLoading || !currentFile || !promptInput.value.trim();
  editButton.querySelector(".btn-label").textContent = isLoading
    ? "Procesando..."
    : "Editar imagen";
  editButton.querySelector(".spinner").hidden = !isLoading;
}

function handleFile(file) {
  if (!file || !file.type.startsWith("image/")) return;

  currentFile = file;
  sessionId = crypto.randomUUID();
  sessionEstablished = false;
  const url = URL.createObjectURL(file);

  dropzoneEmpty.hidden = true;
  thumbnail.src = url;
  thumbnail.hidden = false;

  clearHistory();
  addHistoryEntry({
    version: 0,
    url,
    label: "Subida original",
    isOriginal: true,
  });

  updateEditButtonState();
  fetchSuggestions(file);
}

function resetComparator(message) {
  compareContainer.hidden = true;
  downloadButton.hidden = true;
  resultPlaceholder.hidden = false;
  resultPlaceholder.textContent =
    message || "La imagen editada aparecerá aquí.";
}

function clearHistory() {
  history.forEach((entry) => URL.revokeObjectURL(entry.url));
  history = [];
  activeVersion = 0;
}

function addHistoryEntry({ version, url, label, isOriginal }) {
  history.push({ version, url, label, isOriginal });
  activeVersion = version;
  renderHistory();
}

function truncateLabel(text, max = 40) {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

function renderHistory() {
  historyList.innerHTML = "";

  if (!history.length) {
    const empty = document.createElement("p");
    empty.className = "history-empty";
    empty.textContent = "Carga una imagen para empezar.";
    historyList.appendChild(empty);
    return;
  }

  history.forEach((entry) => {
    const item = document.createElement("div");
    item.className =
      "history-item" + (entry.version === activeVersion ? " active" : "");
    if (isEditing) item.classList.add("disabled");
    item.dataset.version = entry.version;
    item.title = entry.label;

    const thumb = document.createElement("img");
    thumb.className = "history-thumb";
    thumb.src = entry.url;
    thumb.alt = entry.label;

    const meta = document.createElement("div");
    meta.className = "history-meta";

    const label = document.createElement("span");
    label.className = "history-label";
    label.textContent = `Version #${entry.version}`;

    const view = document.createElement("span");
    view.className = "history-view";
    view.textContent = "👁 Ver en lienzo";

    meta.append(label, view);
    item.append(thumb, meta);
    historyList.appendChild(item);
  });
}

function restoreVersion(version) {
  if (isEditing) return;
  const entry = history.find((e) => e.version === version);
  if (!entry) return;

  activeVersion = version;
  thumbnail.src = entry.url;
  thumbnail.hidden = false;
  dropzoneEmpty.hidden = true;

  resetComparator(
    "Rama activa en la versión seleccionada. Edita para continuar.",
  );
  chipsContainer.hidden = true;

  renderHistory();
}

function resetAll() {
  if (isEditing || !history.length) return;
  const original = history[0];
  history.slice(1).forEach((entry) => URL.revokeObjectURL(entry.url));
  history = [original];
  restoreVersion(original.version);
}

historyList.addEventListener("click", (e) => {
  const item = e.target.closest(".history-item");
  if (!item) return;
  restoreVersion(Number(item.dataset.version));
});

resetAllButton.addEventListener("click", resetAll);

async function fetchSuggestions(file) {
  renderChipsLoading();

  try {
    const formData = new FormData();
    formData.append("image", file);

    const response = await fetch("/api/suggest-prompts", {
      method: "POST",
      body: formData,
    });
    if (!response.ok) throw new Error("No se pudieron obtener sugerencias.");

    const { suggestions } = await response.json();
    if (suggestions?.length) {
      renderChips(suggestions);
    } else {
      renderChipsMessage("No se generaron sugerencias para esta imagen.");
    }
  } catch (error) {
    console.warn("Sugerencias no disponibles:", error);
    renderChipsMessage(
      "No se pudieron generar sugerencias. Escribe tu propio prompt.",
      true,
    );
  }
}

function renderChipsLoading() {
  chipsContainer.innerHTML = "";
  chipsContainer.classList.add("chips-loading");
  for (let i = 0; i < 4; i++) {
    const skeleton = document.createElement("span");
    skeleton.className = "chip chip-skeleton";
    chipsContainer.appendChild(skeleton);
  }
  chipsContainer.hidden = false;
}

function renderChipsMessage(message, isError = false) {
  chipsContainer.classList.remove("chips-loading");
  chipsContainer.innerHTML = "";
  const messageEl = document.createElement("span");
  messageEl.className = "chips-message" + (isError ? " error" : "");
  messageEl.textContent = message;
  chipsContainer.appendChild(messageEl);
  chipsContainer.hidden = false;
}

function renderChips(suggestions) {
  chipsContainer.classList.remove("chips-loading");
  chipsContainer.innerHTML = "";
  suggestions.forEach((text) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "chip";
    chip.textContent = text;
    chip.addEventListener("click", () => {
      promptInput.value = text;
      updateEditButtonState();
    });
    chipsContainer.appendChild(chip);
  });
  chipsContainer.hidden = false;
}

["dragenter", "dragover"].forEach((evt) =>
  dropzone.addEventListener(evt, (e) => {
    e.preventDefault();
    dropzone.classList.add("dragover");
  }),
);

["dragleave", "drop"].forEach((evt) =>
  dropzone.addEventListener(evt, (e) => {
    e.preventDefault();
    dropzone.classList.remove("dragover");
  }),
);

dropzone.addEventListener("drop", (e) => {
  const file = e.dataTransfer.files?.[0];
  handleFile(file);
});

dropzone.addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", () => handleFile(fileInput.files?.[0]));
promptInput.addEventListener("input", updateEditButtonState);

editButton.addEventListener("click", async () => {
  if (!currentFile || !promptInput.value.trim()) return;

  const requestId = crypto.randomUUID();
  isEditing = true;
  renderHistory();
  setLoading(true);
  consoleEl.innerHTML = "";
  logToConsole("Iniciando edición...");

  if (currentEventSource) currentEventSource.close();
  currentEventSource = new EventSource(`/api/edit/events/${requestId}`);
  currentEventSource.addEventListener("phase", (e) => {
    const { phase } = JSON.parse(e.data);
    logToConsole(phase);
  });
  currentEventSource.addEventListener("error", (e) => {
    try {
      const { message } = JSON.parse(e.data);
      logToConsole(message, true);
    } catch {
      /* ignore malformed/close events */
    }
  });
  currentEventSource.addEventListener("done", () => {
    currentEventSource?.close();
    currentEventSource = null;
  });

  try {
    const formData = new FormData();
    if (!sessionEstablished) {
      formData.append("image", currentFile);
    } else {
      formData.append("baseVersion", activeVersion);
    }
    formData.append("prompt", promptInput.value.trim());
    formData.append("model", modelSelect.value);
    formData.append("requestId", requestId);
    formData.append("sessionId", sessionId);

    const response = await fetch("/api/edit", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error || "Error al editar la imagen.");
    }

    sessionEstablished = true;
    const version = Number(response.headers.get("X-Edit-Version"));
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);

    beforeImage.src = thumbnail.src;
    afterImage.src = url;
    thumbnail.src = url;
    resultPlaceholder.hidden = true;
    compareContainer.hidden = false;
    resetCompareSlider();

    downloadButton.href = url;
    downloadButton.hidden = false;

    addHistoryEntry({
      version,
      url,
      label: truncateLabel(promptInput.value.trim()),
      isOriginal: false,
    });

    logToConsole("Edición completada.");
  } catch (error) {
    logToConsole(error.message, true);
  } finally {
    isEditing = false;
    renderHistory();
    setLoading(false);
    if (currentEventSource) {
      currentEventSource.close();
      currentEventSource = null;
    }
  }
});

function resetCompareSlider() {
  setComparePosition(50);
}

function setComparePosition(percent) {
  const clamped = Math.min(100, Math.max(0, percent));
  afterWrapper.style.clipPath = `inset(0 ${100 - clamped}% 0 0)`;
  compareHandle.style.left = `${clamped}%`;
}

let isDraggingHandle = false;

function positionFromEvent(e) {
  const rect = compareContainer.getBoundingClientRect();
  const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
  return (x / rect.width) * 100;
}

compareHandle.addEventListener("pointerdown", () => {
  isDraggingHandle = true;
});

window.addEventListener("pointerup", () => {
  isDraggingHandle = false;
});

compareContainer.addEventListener("pointerdown", (e) => {
  isDraggingHandle = true;
  setComparePosition(positionFromEvent(e));
});

window.addEventListener("pointermove", (e) => {
  if (!isDraggingHandle) return;
  setComparePosition(positionFromEvent(e));
});
