// main.js
const { app, BrowserWindow, ipcMain, session } = require("electron");
const path = require("path");
const fs = require("fs");

function loadPresets() {
  const presetsPath = path.join(__dirname, "stream-presets.json");
  try {
    const raw = fs.readFileSync(presetsPath, "utf-8");
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
  } catch (err) {
    // ignore and fall through
  }
  // If file missing/invalid, return empty so renderer fallback can decide.
  return [];
}

let store = null;
async function ensureStore() {
  if (store) return store;
  // electron-store v9 is ESM-only; load via dynamic import
  const Store = (await import("electron-store")).default;
  store = new Store({
    defaults: {
      appTitle: "RTI Display Manager",
      logoText: "RTI",
      gridColumns: 3,
      sources: [
        { name: "PC 1", url: "https://example.com", weight: 1 },
        { name: "PC 2", url: "https://example.com", weight: 1 },
        { name: "PC 3", url: "https://example.com", weight: 1 },
      ],
    },
  });
  return store;
}

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1920,
    height: 1080,
    backgroundColor: "#000000",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      // Allow autoplay for embedded streams
      autoplayPolicy: "no-user-gesture-required",
    },
    autoHideMenuBar: true,
  });

  mainWindow.maximize();
  mainWindow.loadFile("index.html");

  // Uncomment kalau mau devtools
  // mainWindow.webContents.openDevTools();
}

app.whenReady().then(async () => {
  await ensureStore();

  // Auto-allow camera/microphone/WebRTC and media keys for embedded pages
  session.defaultSession.setPermissionRequestHandler(
    (_webContents, permission, callback) => {
      if (permission === "media" || permission === "mediaKeySystemAccess") {
        return callback(true);
      }
      callback(false);
    }
  );

  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

// IPC untuk config
ipcMain.handle("config:get", async () => {
  const s = await ensureStore();
  return {
    ...s.store,
    streamPresets: loadPresets(),
  };
});

ipcMain.handle("config:set", async (event, newConfig) => {
  const s = await ensureStore();
  const toSave = { ...newConfig };
  delete toSave.streamPresets; // keep presets external
  s.set(toSave);
  return {
    ...s.store,
    streamPresets: loadPresets(),
  };
});
