

var LANGS = [
  ["en", "English"], ["ur", "Urdu"], ["ar", "Arabic"], ["hi", "Hindi"],
  ["pa", "Punjabi"], ["ps", "Pashto"], ["fa", "Persian"], ["bn", "Bengali"],
  ["fr", "French"], ["de", "German"], ["es", "Spanish"], ["it", "Italian"],
  ["pt", "Portuguese"], ["ru", "Russian"], ["tr", "Turkish"],
  ["zh-CN", "Chinese (Simplified)"], ["ja", "Japanese"], ["ko", "Korean"],
  ["nl", "Dutch"], ["id", "Indonesian"]
];

var input = document.getElementById("input");
var output = document.getElementById("output");
var statusEl = document.getElementById("status");
var go = document.getElementById("go");
var countEl = document.getElementById("count");
var historyList = document.getElementById("history");
var historyBox = document.getElementById("historyBox");
var items = [];
var hasResult = false;
var pickers = [];
var fromPicker;
var toPicker;

function nameOf(code) {
  for (var i = 0; i < LANGS.length; i++) {
    if (LANGS[i][0] === code) return LANGS[i][1];
  }
  return code;
}

function createPicker(root, labelId, initial, onChange) {
  var current = initial;

  var trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = "trigger";
  trigger.setAttribute("aria-haspopup", "listbox");
  trigger.setAttribute("aria-expanded", "false");
  trigger.setAttribute("aria-labelledby", labelId);

  var valueEl = document.createElement("span");
  valueEl.className = "trigger-value";

  var caret = document.createElement("span");
  caret.className = "caret";
  caret.setAttribute("aria-hidden", "true");

  trigger.appendChild(valueEl);
  trigger.appendChild(caret);

  var panel = document.createElement("div");
  panel.className = "panel";
  panel.hidden = true;

  var search = document.createElement("input");
  search.type = "text";
  search.className = "search";
  search.placeholder = "Search language";
  search.setAttribute("aria-label", "Search language");
  search.autocomplete = "off";

  var list = document.createElement("ul");
  list.className = "list";
  list.setAttribute("role", "listbox");

  panel.appendChild(search);
  panel.appendChild(list);
  root.appendChild(trigger);
  root.appendChild(panel);

  function showValue() {
    valueEl.textContent = nameOf(current);
  }

  function matches(filter) {
    var q = filter.trim().toLowerCase();
    return LANGS.filter(function (l) {
      return l[1].toLowerCase().indexOf(q) !== -1;
    });
  }

  function render(filter) {
    list.innerHTML = "";
    var shown = matches(filter);
    if (shown.length === 0) {
      var none = document.createElement("li");
      none.className = "none";
      none.textContent = "No language found";
      list.appendChild(none);
      return;
    }
    shown.forEach(function (l) {
      var li = document.createElement("li");
      var isCurrent = l[0] === current;
      li.className = "option" + (isCurrent ? " selected" : "");
      li.setAttribute("role", "option");
      li.setAttribute("aria-selected", isCurrent ? "true" : "false");
      li.textContent = l[1];
      li.addEventListener("click", function () {
        choose(l[0]);
      });
      list.appendChild(li);
    });
  }

  function close() {
    panel.hidden = true;
    trigger.setAttribute("aria-expanded", "false");
  }

  function open() {
    pickers.forEach(function (p) {
      if (p !== api) p.close();
    });
    panel.hidden = false;
    trigger.setAttribute("aria-expanded", "true");
    search.value = "";
    render("");
    var selected = list.querySelector(".selected");
    if (selected) selected.scrollIntoView({ block: "nearest" });
    search.focus();
  }

  function choose(code) {
    var old = current;
    current = code;
    showValue();
    close();
    trigger.focus();
    if (onChange && old !== code) onChange(code, old);
  }

  trigger.addEventListener("click", function () {
    if (panel.hidden) open();
    else close();
  });

  search.addEventListener("input", function () {
    render(search.value);
  });

  search.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      close();
      trigger.focus();
    }
    if (e.key === "Enter") {
      e.preventDefault();
      var found = matches(search.value);
      if (found.length) choose(found[0][0]);
    }
  });

  document.addEventListener("click", function (e) {
    if (!root.contains(e.target)) close();
  });

  var api = {
    get: function () {
      return current;
    },
    set: function (code) {
      current = code;
      showValue();
    },
    close: close
  };

  showValue();
  pickers.push(api);
  return api;
}

fromPicker = createPicker(
  document.getElementById("fromPicker"),
  "fromLabel",
  "en",
  function (code, old) {
    if (code === toPicker.get()) toPicker.set(old);
  }
);

toPicker = createPicker(
  document.getElementById("toPicker"),
  "toLabel",
  "ur",
  function (code, old) {
    if (code === fromPicker.get()) fromPicker.set(old);
  }
);

function setOutput(text, kind) {
  output.textContent = text;
  output.className = "result" + (kind ? " " + kind : "");
  hasResult = kind === undefined || kind === "";
}

function renderHistory() {
  historyList.innerHTML = "";
  items.forEach(function (it) {
    var li = document.createElement("li");

    var pair = document.createElement("span");
    pair.className = "pair";
    pair.textContent = nameOf(it.from) + " to " + nameOf(it.to);

    var src = document.createElement("span");
    src.className = "src";
    src.textContent = it.src;

    var out = document.createElement("span");
    out.textContent = it.out;

    li.appendChild(pair);
    li.appendChild(src);
    li.appendChild(out);
    historyList.appendChild(li);
  });
  historyBox.hidden = items.length === 0;
}

async function viaGoogle(text, src, dst) {
  var url =
    "https://translate.googleapis.com/translate_a/single?client=gtx&sl=" +
    encodeURIComponent(src) +
    "&tl=" +
    encodeURIComponent(dst) +
    "&dt=t&q=" +
    encodeURIComponent(text);
  var res = await fetch(url);
  if (!res.ok) throw new Error("Status " + res.status);
  var data = await res.json();
  var out = "";
  data[0].forEach(function (part) {
    if (part[0]) out += part[0];
  });
  if (!out) throw new Error("Empty result");
  return out;
}

async function viaMyMemory(text, src, dst) {
  var url =
    "https://api.mymemory.translated.net/get?q=" +
    encodeURIComponent(text) +
    "&langpair=" +
    encodeURIComponent(src + "|" + dst);
  var res = await fetch(url);
  if (!res.ok) throw new Error("Status " + res.status);
  var data = await res.json();
  if (String(data.responseStatus) !== "200") {
    throw new Error(data.responseDetails || "Translation failed");
  }
  return data.responseData.translatedText;
}

async function fetchTranslation(text, src, dst) {
  try {
    return await viaGoogle(text, src, dst);
  } catch (first) {
    try {
      return await viaMyMemory(text, src, dst);
    } catch (second) {
      throw new Error(first.message + " / " + second.message);
    }
  }
}

async function translate() {
  var text = input.value.trim();
  if (!text) {
    setOutput("Enter some text first.", "error");
    return;
  }
  var src = fromPicker.get();
  var dst = toPicker.get();
  if (src === dst) {
    setOutput("Choose two different languages.", "error");
    return;
  }
  go.disabled = true;
  statusEl.textContent = "Translating...";
  try {
    var result = await fetchTranslation(text, src, dst);
    setOutput(result);
    statusEl.textContent = "";
    items.unshift({ from: src, to: dst, src: text, out: result });
    items = items.slice(0, 5);
    renderHistory();
  } catch (err) {
    setOutput(
      "Could not translate. Check your internet connection and try again. (" +
        err.message +
        ")",
      "error"
    );
    statusEl.textContent = "";
  } finally {
    go.disabled = false;
  }
}

go.addEventListener("click", translate);

input.addEventListener("keydown", function (e) {
  if ((e.ctrlKey || e.metaKey) && e.key === "Enter") translate();
});

input.addEventListener("input", function () {
  countEl.textContent = input.value.length + " / 500";
});

document.getElementById("clear").addEventListener("click", function () {
  input.value = "";
  countEl.textContent = "0 / 500";
  setOutput("The translation appears here.", "empty");
  statusEl.textContent = "";
  input.focus();
});

document.getElementById("swap").addEventListener("click", function () {
  var f = fromPicker.get();
  fromPicker.set(toPicker.get());
  toPicker.set(f);
  if (hasResult) {
    var translated = output.textContent;
    var original = input.value;
    input.value = translated;
    setOutput(original);
    countEl.textContent = input.value.length + " / 500";
  }
});

document.getElementById("copy").addEventListener("click", function () {
  if (!hasResult) return;
  navigator.clipboard.writeText(output.textContent).then(function () {
    statusEl.textContent = "Copied";
    setTimeout(function () {
      statusEl.textContent = "";
    }, 1500);
  });
});

document.getElementById("speak").addEventListener("click", function () {
  if (!hasResult) return;
  if (!("speechSynthesis" in window)) {
    statusEl.textContent = "Speech is not supported in this browser.";
    return;
  }
  var u = new SpeechSynthesisUtterance(output.textContent);
  u.lang = toPicker.get();
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(u);
});
