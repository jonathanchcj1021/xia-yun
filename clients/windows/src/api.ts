import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";

export type PublicUser = {
  id: string;
  email: string;
  createdAt: string;
};

export type Item = {
  id: string;
  ownerId: string;
  type: "file" | "image" | "text" | string;
  name: string;
  size: number;
  mimeType: string | null;
  createdAt: string;
  excerpt: string | null;
  body: string | null;
};

export type Status = {
  baseUrl: string;
  helloAvailable: boolean;
  helloReason: string;
  savedEmail: string | null;
  hasSavedSession: boolean;
  user: PublicUser | null;
};

export type SessionView = {
  baseUrl: string;
  user: PublicUser;
  authMethod: string;
  persistError: string | null;
};

export type Preview = {
  mime: string;
  dataUrl: string;
};

export function appStatus() {
  return invoke<Status>("app_status");
}

export function setBaseUrl(baseUrl: string) {
  return invoke<string>("set_base_url", { baseUrl });
}

export function registerAccount(email: string, password: string) {
  return invoke<SessionView>("register_account", { email, password });
}

export function loginAccount(email: string, password: string) {
  return invoke<SessionView>("login_account", { email, password });
}

export function passkeyLogin(email: string) {
  return invoke<SessionView>("passkey_login", { email });
}

export function registerPasskey() {
  return invoke<void>("register_passkey");
}

export function unlockSession() {
  return invoke<SessionView>("unlock_session");
}

export function logoutAccount() {
  return invoke<void>("logout_account");
}

export function listItems() {
  return invoke<Item[]>("list_items");
}

export function createNote(title: string, body: string) {
  return invoke<Item>("create_note", { title, body });
}

export function uploadFile(path: string, name: string, kind: string) {
  return invoke<Item>("upload_file", { path, name, kind: kind || null });
}

export function getItem(id: string) {
  return invoke<Item>("get_item", { id });
}

export function previewImage(id: string) {
  return invoke<Preview>("preview_image", { id });
}

export function downloadItem(id: string, dest: string) {
  return invoke<void>("download_item", { id, dest });
}

export function deleteItem(id: string) {
  return invoke<void>("delete_item", { id });
}

export async function pickUpload(): Promise<string | null> {
  const selected = await open({
    multiple: false,
    directory: false,
    title: "選擇要放進匣雲的檔案",
  });
  if (typeof selected === "string") return selected;
  return null;
}

export async function pickDownload(defaultName: string): Promise<string | null> {
  const selected = await save({
    title: "下載到這台電腦",
    defaultPath: defaultName,
  });
  return selected;
}
