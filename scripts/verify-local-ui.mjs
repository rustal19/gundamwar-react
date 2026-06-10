import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const EDGE_PATH = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const DEBUG_PORT = 9223;
const BASE_URL = process.env.LOCAL_UI_BASE_URL || "http://localhost:3000";
const ROOT_DIR = process.cwd();
const TMP_DIR = path.join(ROOT_DIR, "tmp", "local-ui-check");
const PROFILE_DIR = path.join(TMP_DIR, "edge-profile");

const MOCK_RESULTS = {
  page: 1,
  pageSize: 10,
  total: 2,
  data: [
    {
      cardId: 900001,
      card_type_name: "UNIT",
      sp_power_color1_name: "青",
      sp_power_color2_name: "",
      spPowerCost1: 2,
      spPowerCost2: "",
      totalCost: 4,
      resourceCost: 1,
      modelNumber1: "RX-78-2",
      modelNumber2: "",
      name: "ガンダム",
      text_normal: "サンプルのテキストです。\n画像がない場合はプレースホルダーを表示します。",
      melee1: 4,
      melee2: "",
      shooting1: 2,
      shooting2: "",
      defense1: 4,
      defense2: "",
      space: 1,
      earth: 1,
      altName: "",
      alt_card_type_name: "",
      text_alt: "",
      altMelee1: "",
      altMelee2: "",
      altShooting1: "",
      altShooting2: "",
      altDefense1: "",
      altDefense2: "",
      traits: ["ガンダム系", "試作機"],
      traits2: ["地球連邦"],
      aliases: "白い悪魔",
      exclusivePilots: "アムロ・レイ",
      sets: ["1st", "BB3"],
      cardNumber1: "U-001",
      cardNumber2: "",
    },
    {
      cardId: 900002,
      card_type_name: "CHARACTER",
      sp_power_color1_name: "白",
      sp_power_color2_name: "",
      spPowerCost1: 2,
      spPowerCost2: "",
      totalCost: 1,
      resourceCost: 0,
      modelNumber1: "CH-001",
      modelNumber2: "",
      name: "アムロ・レイ",
      text_normal: "デッキ追加の確認用カードです。",
      melee1: 1,
      melee2: "",
      shooting1: 2,
      shooting2: "",
      defense1: 1,
      defense2: "",
      space: 1,
      earth: 1,
      altName: "",
      alt_card_type_name: "",
      text_alt: "",
      altMelee1: "",
      altMelee2: "",
      altShooting1: "",
      altShooting2: "",
      altDefense1: "",
      altDefense2: "",
      traits: ["男性", "子供"],
      traits2: ["地球連邦"],
      aliases: "",
      exclusivePilots: "",
      sets: ["1st"],
      cardNumber1: "CH-001",
      cardNumber2: "",
    },
  ],
};

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function ensureCleanDir(dirPath) {
  await fs.rm(dirPath, { recursive: true, force: true });
  await fs.mkdir(dirPath, { recursive: true });
}

async function waitForJson(url, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return response;
    } catch (error) {
      void error;
    }
    await delay(250);
  }
  throw new Error(`Timed out waiting for ${url}`);
}

class CdpClient {
  constructor(webSocketUrl) {
    this.socket = new WebSocket(webSocketUrl);
    this.nextId = 1;
    this.pending = new Map();
    this.eventListeners = new Map();
    this.connected = new Promise((resolve, reject) => {
      this.socket.addEventListener("open", resolve, { once: true });
      this.socket.addEventListener("error", reject, { once: true });
    });
    this.socket.addEventListener("message", (event) => {
      const payload = JSON.parse(event.data);
      if (payload.id) {
        const pending = this.pending.get(payload.id);
        if (!pending) return;
        this.pending.delete(payload.id);
        if (payload.error) {
          pending.reject(new Error(payload.error.message || "CDP error"));
        } else {
          pending.resolve(payload.result || {});
        }
        return;
      }

      if (!payload.method) return;
      const listeners = this.eventListeners.get(payload.method);
      if (!listeners) return;
      listeners.forEach((listener) => listener(payload.params || {}));
    });
  }

  async send(method, params = {}) {
    await this.connected;
    const id = this.nextId++;
    const message = JSON.stringify({ id, method, params });
    const result = new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
    });
    this.socket.send(message);
    return result;
  }

  waitForEvent(method, timeoutMs = 30000) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        unsubscribe();
        reject(new Error(`Timed out waiting for ${method}`));
      }, timeoutMs);

      const listeners = this.eventListeners.get(method) || [];
      const handler = (params) => {
        clearTimeout(timeout);
        unsubscribe();
        resolve(params);
      };

      const unsubscribe = () => {
        const current = this.eventListeners.get(method) || [];
        this.eventListeners.set(
          method,
          current.filter((listener) => listener !== handler)
        );
      };

      listeners.push(handler);
      this.eventListeners.set(method, listeners);
    });
  }

  async evaluate(expression) {
    const response = await this.send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    return response.result?.value;
  }

  async navigate(url, extraWaitMs = 1200) {
    const loadEvent = this.waitForEvent("Page.loadEventFired", 30000);
    await this.send("Page.navigate", { url });
    await loadEvent;
    await delay(extraWaitMs);
  }

  async screenshot(filePath) {
    const response = await this.send("Page.captureScreenshot", {
      format: "png",
      fromSurface: true,
      captureBeyondViewport: true,
    });
    await fs.writeFile(filePath, Buffer.from(response.data, "base64"));
  }

  async close() {
    this.socket.close();
  }
}

async function waitForExpression(client, expression, timeoutMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const value = await client.evaluate(expression);
    if (value) return value;
    await delay(250);
  }
  throw new Error(`Timed out waiting for expression: ${expression}`);
}

async function createTarget(url) {
  const response = await fetch(
    `http://127.0.0.1:${DEBUG_PORT}/json/new?${encodeURIComponent(url)}`,
    { method: "PUT" }
  );
  if (!response.ok) {
    throw new Error(`Failed to create target: ${response.status}`);
  }
  return response.json();
}

const injectMockFetchScript = `
  if (!window.localStorage.getItem("__codex_local_check_initialized")) {
    window.localStorage.removeItem("gundamwar.deck.v1");
    window.localStorage.removeItem("gundamwar.auth.mockUser.v1");
    Object.keys(window.localStorage)
      .filter((key) => key.startsWith("gundamwar.savedDecks.v1:"))
      .forEach((key) => window.localStorage.removeItem(key));
    window.localStorage.setItem("__codex_local_check_initialized", "1");
  }

  const mockResponse = ${JSON.stringify(MOCK_RESULTS)};
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (...args) => {
    const requestUrl = typeof args[0] === "string" ? args[0] : args[0]?.url || "";
    if (requestUrl.includes("/api/search") || requestUrl.includes("gundamwar.net/api/search")) {
      return new Response(JSON.stringify(mockResponse), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }
    return originalFetch(...args);
  };

  window.confirm = () => true;
`;

let edgeProcess;

try {
  await ensureCleanDir(TMP_DIR);

  edgeProcess = spawn(
    EDGE_PATH,
    [
      "--headless=new",
      "--disable-gpu",
      `--remote-debugging-port=${DEBUG_PORT}`,
      `--user-data-dir=${PROFILE_DIR}`,
      "about:blank",
    ],
    {
      stdio: "ignore",
      windowsHide: true,
    }
  );

  await waitForJson(`http://127.0.0.1:${DEBUG_PORT}/json/version`);
  const target = await createTarget(`${BASE_URL}/`);
  const client = new CdpClient(target.webSocketDebuggerUrl);

  await client.send("Page.enable");
  await client.send("Runtime.enable");
  await client.send("Page.addScriptToEvaluateOnNewDocument", {
    source: injectMockFetchScript,
  });

  await client.navigate(`${BASE_URL}/`);
  const rootCheck = await client.evaluate(`(() => ({
    title: document.title,
    hasHeader: Boolean(document.querySelector('.app-header')),
    hasDeckLink: Boolean(document.querySelector('a[href="/deck"]')),
    hasSearchForm: Boolean(document.querySelector('form'))
  }))()`);
  await client.screenshot(path.join(TMP_DIR, "root.png"));

  await client.navigate(`${BASE_URL}/deck`, 1200);
  const emptyDeckCheck = await client.evaluate(`(() => ({
    hasDeckSearchForm: Boolean(document.querySelector('.deck-search-form-panel form')),
    hasMockLogin: Boolean(document.querySelector('.google-mock-button')),
    hasEmptyState: Boolean(document.querySelector('.deck-empty-card')),
    hasSearchEmptyState: Boolean(document.querySelector('.deck-search-results-panel .results-empty-state'))
  }))()`);

  await client.navigate(
    `${BASE_URL}/deck?name=${encodeURIComponent("ガンダム")}&page=1&pageSize=10`,
    1800
  );
  await waitForExpression(client, "document.querySelectorAll('.deck-search-results-panel .result-card').length >= 2");
  const searchCheck = await client.evaluate(`(() => ({
    resultCards: document.querySelectorAll('.deck-search-results-panel .result-card').length,
    placeholderCount: document.querySelectorAll('.deck-search-results-panel .card-image-placeholder').length,
    cardNames: Array.from(document.querySelectorAll('.deck-search-results-panel .card-model-name strong')).map((node) => node.textContent.trim())
  }))()`);
  await client.screenshot(path.join(TMP_DIR, "deck-search.png"));

  await client.evaluate(`(() => {
    const button = document.querySelector('.deck-search-results-panel .card-actions .deck-action-button.primary');
    if (button) button.click();
    return Boolean(button);
  })()`);
  await waitForExpression(client, "document.querySelectorAll('.deck-current-panel .deck-card-row').length >= 1");

  await client.evaluate(`(() => {
    const button = document.querySelector('.google-mock-button');
    if (button) button.click();
    return Boolean(button);
  })()`);
  await waitForExpression(client, "Boolean(document.querySelector('.deck-user-name'))");

  await client.evaluate(`(() => {
    const input = document.querySelector('#deck-title-input');
    if (!input) return false;
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
    if (!setter) return false;
    setter.call(input, 'デッキページ検索テスト');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  })()`);

  await client.evaluate(`(() => {
    const saveButton = document.querySelector('.deck-primary-button');
    if (saveButton) saveButton.click();
    return Boolean(saveButton);
  })()`);
  await waitForExpression(client, "document.querySelectorAll('.saved-deck-item').length >= 1");

  const afterSaveCheck = await client.evaluate(`(() => ({
    userName: document.querySelector('.deck-user-name')?.textContent || '',
    saveMessage: document.querySelector('.deck-copy-message')?.textContent || '',
    savedDeckTitles: Array.from(document.querySelectorAll('.saved-deck-title')).map((node) => node.textContent.trim()),
    currentTitle: document.querySelector('#deck-title-input')?.value || '',
    currentDeckRows: document.querySelectorAll('.deck-current-panel .deck-card-row').length
  }))()`);
  await client.screenshot(path.join(TMP_DIR, "deck-builder.png"));

  await client.navigate(`${BASE_URL}/deck`, 1000);
  const reloadCheck = await client.evaluate(`(() => ({
    hasPersistedLogin: Boolean(document.querySelector('.deck-user-name')),
    savedDeckCount: document.querySelectorAll('.saved-deck-item').length,
    currentDeckRows: document.querySelectorAll('.deck-current-panel .deck-card-row').length,
    searchPanelStillPresent: Boolean(document.querySelector('.deck-search-form-panel form'))
  }))()`);

  await client.close();

  console.log(
    JSON.stringify(
      {
        screenshots: {
          root: path.join(TMP_DIR, "root.png"),
          deckSearch: path.join(TMP_DIR, "deck-search.png"),
          deckBuilder: path.join(TMP_DIR, "deck-builder.png"),
        },
        checks: {
          root: rootCheck,
          emptyDeck: emptyDeckCheck,
          search: searchCheck,
          afterSave: afterSaveCheck,
          reload: reloadCheck,
        },
      },
      null,
      2
    )
  );
} finally {
  if (edgeProcess && !edgeProcess.killed) {
    edgeProcess.kill();
  }
}
