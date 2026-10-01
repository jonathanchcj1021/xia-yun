import {
  appStatus,
  createNote,
  deleteItem,
  downloadItem,
  getItem,
  listItems,
  loginAccount,
  logoutAccount,
  passkeyLogin,
  pickDownload,
  pickUpload,
  previewImage,
  registerAccount,
  registerPasskey,
  setBaseUrl,
  unlockSession,
  uploadFile,
  type Item,
  type PublicUser,
  type Status,
} from "./api";

type Mode = "login" | "register";

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) throw new Error("找不到畫面");

const state: {
  status: Status | null;
  mode: Mode;
  user: PublicUser | null;
  items: Item[];
  selected: Item | null;
  preview: string;
  error: string;
  info: string;
  busy: boolean;
  noteOpen: boolean;
  screen: "loading" | "auth" | "unlock" | "library";
} = {
  status: null,
  mode: "login",
  user: null,
  items: [],
  selected: null,
  preview: "",
  error: "",
  info: "",
  busy: false,
  noteOpen: false,
  screen: "loading",
};

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function field(label: string, input: HTMLInputElement | HTMLTextAreaElement) {
  const wrap = document.createElement("div");
  const name = el("label", undefined, label);
  name.htmlFor = input.id;
  wrap.append(name, input);
  return wrap;
}

function banner(message: string) {
  return message ? el("div", "banner", message) : document.createElement("span");
}

function formatBytes(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-Hant", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function kindLabel(kind: string) {
  if (kind === "image") return "圖片";
  if (kind === "text") return "筆記";
  return "檔案";
}

function messageOf(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

async function boot() {
  state.screen = "loading";
  render();
  try {
    state.status = await appStatus();
    state.user = state.status.user;
    if (state.user) {
      state.screen = "library";
      await refreshItems();
    } else if (state.status.hasSavedSession) {
      state.screen = "unlock";
    } else {
      state.screen = "auth";
    }
  } catch (error) {
    state.error = messageOf(error);
    state.screen = "auth";
  }
  render();
}

async function refreshItems() {
  state.items = await listItems();
  if (state.selected) {
    state.selected = state.items.find((item) => item.id === state.selected?.id) ?? null;
  }
}

function render() {
  app!.replaceChildren();
  if (state.screen === "loading") {
    const screen = el("section", "screen");
    screen.append(el("p", "lede", "正在打開匣子…"));
    app!.append(screen);
    return;
  }
  if (state.screen === "auth") renderAuth();
  else if (state.screen === "unlock") renderUnlock();
  else renderLibrary();
}

function renderAuth() {
  const screen = el("section", "screen");
  const card = el("section", "card");
  const brand = el("div", "brand");
  brand.append(el("div", "seal", "匣"), (() => {
    const text = el("div");
    text.append(el("h1", undefined, "匣雲"), el("p", undefined, "檔案、圖片與筆記，放在自己的雲裡。"));
    return text;
  })());

  const tabs = el("div", "tabs");
  const loginTab = el("button", undefined, "登入");
  const registerTab = el("button", undefined, "註冊");
  loginTab.type = "button";
  registerTab.type = "button";
  loginTab.setAttribute("aria-selected", String(state.mode === "login"));
  registerTab.setAttribute("aria-selected", String(state.mode === "register"));
  loginTab.onclick = () => {
    state.mode = "login";
    state.error = "";
    render();
  };
  registerTab.onclick = () => {
    state.mode = "register";
    state.error = "";
    render();
  };
  tabs.append(loginTab, registerTab);

  const email = document.createElement("input");
  email.id = "email";
  email.type = "email";
  email.autocomplete = "username";
  email.required = true;
  email.value = state.status?.savedEmail ?? "";
  const password = document.createElement("input");
  password.id = "password";
  password.type = "password";
  password.autocomplete = state.mode === "register" ? "new-password" : "current-password";
  password.required = true;
  const base = document.createElement("input");
  base.id = "base-url";
  base.value = state.status?.baseUrl ?? "http://127.0.0.1:43123";
  base.spellcheck = false;

  const form = document.createElement("form");
  form.append(
    field("電子郵件", email),
    field("密碼", password),
  );
  const submit = el("button", "primary", state.mode === "register" ? "建立帳號" : "登入");
  submit.type = "submit";
  submit.disabled = state.busy;
  const hello = el("button", "ghost", "使用 Windows Hello 登入");
  hello.type = "button";
  hello.disabled = state.busy || state.mode === "register";
  const actions = el("div", "actions");
  actions.append(submit);
  if (state.mode === "login") actions.append(hello);
  form.append(actions);
  form.onsubmit = (event) => {
    event.preventDefault();
    void submitPassword(email.value, password.value, base.value);
  };
  hello.onclick = () => {
    void submitPasskey(email.value, base.value);
  };

  const server = el("div", "server");
  server.append(field("伺服器", base));
  const saveServer = el("button", "textish", "儲存伺服器位址");
  saveServer.type = "button";
  saveServer.disabled = state.busy;
  saveServer.onclick = () => {
    void saveServerUrl(base.value);
  };
  server.append(saveServer);

  card.append(brand, tabs, form, server, banner(state.error));
  const hint = el(
    "p",
    "note",
    state.status?.helloReason ||
      "通行密鑰需要主機名稱。本機請把伺服器改成 http://localhost:43123，不要用 IP。",
  );
  card.append(hint);
  screen.append(card);
  app!.append(screen);
  email.focus();
}

function renderUnlock() {
  const screen = el("section", "screen");
  const card = el("section", "card");
  const brand = el("div", "brand");
  brand.append(el("div", "seal", "匣"), (() => {
    const text = el("div");
    const title = el("h1", undefined, "匣雲");
    const who = el("p", undefined, state.status?.savedEmail ?? "已儲存的登入");
    text.append(title, who);
    return text;
  })());
  const copy = el("p", "lede", "這台電腦留著上次的登入。用 Windows Hello 打開，或改用密碼。");
  const unlock = el("button", "primary", "以 Windows Hello 解鎖");
  unlock.type = "button";
  unlock.disabled = state.busy;
  unlock.onclick = () => {
    void runUnlock();
  };
  const password = el("button", "ghost", "改用密碼登入");
  password.type = "button";
  password.onclick = () => {
    state.screen = "auth";
    state.error = "";
    render();
  };
  const actions = el("div", "actions");
  actions.append(unlock, password);
  card.append(brand, copy, actions, banner(state.error));
  if (state.status?.helloReason) card.append(el("p", "note", state.status.helloReason));
  screen.append(card);
  app!.append(screen);
}

function renderLibrary() {
  const shell = el("div", "library");
  const rail = el("aside", "rail");
  const brand = el("div", "brand");
  brand.append(el("div", "seal", "匣"), el("h1", undefined, "匣雲"));
  const who = el("div", "who", state.user?.email ?? "");
  const hello = el("button", undefined, "登記 Windows Hello");
  hello.type = "button";
  hello.disabled = state.busy;
  hello.onclick = () => {
    void runRegisterPasskey();
  };
  const logout = el("button", undefined, "登出");
  logout.type = "button";
  logout.disabled = state.busy;
  logout.onclick = () => {
    void runLogout();
  };
  const spacer = el("div", "spacer");
  rail.append(brand, who, spacer, hello, logout);

  const list = el("section", "list");
  const toolbar = el("div", "toolbar");
  const heading = el("div");
  heading.append(el("h2", undefined, "我的匣子"), el("p", "lede", `${state.items.length} 個項目`));
  const buttons = el("div", "actions");
  const upload = el("button", "primary", "上傳檔案");
  upload.type = "button";
  upload.disabled = state.busy;
  upload.onclick = () => {
    void runUpload();
  };
  const note = el("button", "ghost", "新增筆記");
  note.type = "button";
  note.disabled = state.busy;
  note.onclick = () => {
    state.noteOpen = true;
    state.error = "";
    render();
  };
  buttons.append(upload, note);
  toolbar.append(heading, buttons);
  const items = el("div", "items");
  if (state.items.length === 0) {
    items.append(el("div", "empty", "匣子還是空的。上傳一個檔案，或寫下第一則筆記。"));
  }
  for (const item of state.items) {
    const button = el("button", "item");
    button.type = "button";
    button.setAttribute("aria-current", String(state.selected?.id === item.id));
    const badge = el("span", `kind ${item.type}`, kindLabel(item.type));
    const text = el("span");
    text.append(el("strong", undefined, item.name));
    const excerpt = item.excerpt ? ` · ${item.excerpt}` : "";
    text.append(el("small", undefined, `${kindLabel(item.type)} · ${formatBytes(item.size)}${excerpt}`));
    button.append(badge, text, el("small", undefined, formatTime(item.createdAt)));
    button.onclick = () => {
      void selectItem(item);
    };
    items.append(button);
  }
  list.append(toolbar, banner(state.error || state.info), items);

  const detail = el("aside", "detail");
  if (!state.selected) {
    detail.append(el("h3", undefined, "還沒選項目"), el("p", "meta", "從左邊挑一個檔案、圖片或筆記。"));
  } else {
    const item = state.selected;
    detail.append(el("h3", undefined, item.name));
    detail.append(
      el(
        "p",
        "meta",
        `${kindLabel(item.type)} · ${formatBytes(item.size)} · ${formatTime(item.createdAt)}`,
      ),
    );
    if (state.preview) {
      const image = document.createElement("img");
      image.className = "preview";
      image.alt = item.name;
      image.src = state.preview;
      detail.append(image);
    }
    if (item.type === "text") {
      detail.append(el("div", "prose", item.body ?? ""));
    }
    const actions = el("div", "actions");
    const download = el("button", "primary", "下載");
    download.type = "button";
    download.disabled = state.busy;
    download.onclick = () => {
      void runDownload(item);
    };
    const remove = el("button", "danger", "刪除");
    remove.type = "button";
    remove.disabled = state.busy;
    remove.onclick = () => {
      void runDelete(item);
    };
    actions.append(download, remove);
    detail.append(actions);
  }

  shell.append(rail, list, detail);
  app!.append(shell);
  if (state.noteOpen) renderNoteDialog();
}

function renderNoteDialog() {
  const back = el("div", "dialog-back");
  const dialog = el("form", "dialog");
  dialog.append(el("h3", undefined, "新的筆記"));
  const title = document.createElement("input");
  title.id = "note-title";
  title.required = true;
  title.maxLength = 200;
  const body = document.createElement("textarea");
  body.id = "note-body";
  dialog.append(field("標題", title), field("內文", body));
  const actions = el("div", "actions");
  const save = el("button", "primary", "放進匣子");
  save.type = "submit";
  save.disabled = state.busy;
  const cancel = el("button", "ghost", "取消");
  cancel.type = "button";
  cancel.onclick = () => {
    state.noteOpen = false;
    render();
  };
  actions.append(save, cancel);
  dialog.append(actions, banner(state.error));
  dialog.onsubmit = (event) => {
    event.preventDefault();
    void runCreateNote(title.value, body.value);
  };
  back.append(dialog);
  back.addEventListener("click", (event) => {
    if (event.target === back) {
      state.noteOpen = false;
      render();
    }
  });
  app!.append(back);
  title.focus();
}

async function saveServerUrl(value: string) {
  state.busy = true;
  state.error = "";
  render();
  try {
    const baseUrl = await setBaseUrl(value);
    if (state.status) state.status.baseUrl = baseUrl;
    state.info = "";
  } catch (error) {
    state.error = messageOf(error);
  } finally {
    state.busy = false;
    render();
  }
}

async function submitPassword(email: string, password: string, baseUrl: string) {
  state.busy = true;
  state.error = "";
  render();
  try {
    await setBaseUrl(baseUrl);
    const session =
      state.mode === "register"
        ? await registerAccount(email, password)
        : await loginAccount(email, password);
    await enter(session.user, session.persistError);
  } catch (error) {
    state.error = messageOf(error);
    state.busy = false;
    render();
  }
}

async function submitPasskey(email: string, baseUrl: string) {
  state.busy = true;
  state.error = "";
  render();
  try {
    await setBaseUrl(baseUrl);
    const session = await passkeyLogin(email);
    await enter(session.user, session.persistError);
  } catch (error) {
    state.error = messageOf(error);
    state.busy = false;
    render();
  }
}

async function runUnlock() {
  state.busy = true;
  state.error = "";
  render();
  try {
    const session = await unlockSession();
    await enter(session.user, session.persistError);
  } catch (error) {
    state.error = messageOf(error);
    state.busy = false;
    render();
  }
}

async function enter(user: PublicUser, persistError: string | null) {
  state.user = user;
  state.screen = "library";
  state.info = persistError ? `已登入，但沒能記住這次登入：${persistError}` : "";
  state.error = "";
  await refreshItems();
  state.busy = false;
  render();
}

async function runLogout() {
  state.busy = true;
  render();
  try {
    await logoutAccount();
    state.user = null;
    state.items = [];
    state.selected = null;
    state.preview = "";
    state.screen = "auth";
    state.status = await appStatus();
  } catch (error) {
    state.error = messageOf(error);
  } finally {
    state.busy = false;
    render();
  }
}

async function runRegisterPasskey() {
  state.busy = true;
  state.error = "";
  state.info = "";
  render();
  try {
    await registerPasskey();
    state.info = "這台電腦的 Windows Hello 已登記為通行密鑰。下次可以用它登入。";
  } catch (error) {
    state.error = messageOf(error);
  } finally {
    state.busy = false;
    render();
  }
}

async function runUpload() {
  state.error = "";
  try {
    const path = await pickUpload();
    if (!path) return;
    state.busy = true;
    render();
    const name = path.split(/[/\\]/).pop() ?? "";
    await uploadFile(path, name, "");
    await refreshItems();
  } catch (error) {
    state.error = messageOf(error);
  } finally {
    state.busy = false;
    render();
  }
}

async function runCreateNote(title: string, body: string) {
  state.busy = true;
  state.error = "";
  render();
  try {
    const item = await createNote(title, body);
    state.noteOpen = false;
    await refreshItems();
    state.selected = await getItem(item.id);
  } catch (error) {
    state.error = messageOf(error);
  } finally {
    state.busy = false;
    render();
  }
}

async function selectItem(item: Item) {
  state.selected = item;
  state.preview = "";
  state.error = "";
  render();
  try {
    if (item.type === "text") {
      state.selected = await getItem(item.id);
    } else if (item.type === "image") {
      const preview = await previewImage(item.id);
      state.preview = preview.dataUrl;
    }
  } catch (error) {
    state.error = messageOf(error);
  }
  render();
}

async function runDownload(item: Item) {
  try {
    const name = item.type === "text" && !item.name.toLowerCase().endsWith(".txt")
      ? `${item.name}.txt`
      : item.name;
    const dest = await pickDownload(name);
    if (!dest) return;
    state.busy = true;
    render();
    await downloadItem(item.id, dest);
    state.info = "已下載到這台電腦。";
  } catch (error) {
    state.error = messageOf(error);
  } finally {
    state.busy = false;
    render();
  }
}

async function runDelete(item: Item) {
  if (!window.confirm(`刪除「${item.name}」？此動作無法復原。`)) return;
  state.busy = true;
  state.error = "";
  render();
  try {
    await deleteItem(item.id);
    if (state.selected?.id === item.id) {
      state.selected = null;
      state.preview = "";
    }
    await refreshItems();
  } catch (error) {
    state.error = messageOf(error);
  } finally {
    state.busy = false;
    render();
  }
}

void boot();
