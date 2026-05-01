const { app, BrowserWindow, Menu, ipcMain, powerMonitor, safeStorage, shell } = require("electron");
const path = require("path");
const fs = require("fs");
const http = require("http");
const crypto = require("crypto");

const isDev = process.env.NODE_ENV === "development";
const STATIC_SERVER_PORT = 41730;
const GOOGLE_OAUTH_TIMEOUT_MS = 90 * 1000;

let mainWindow;
let staticServer;
const googleCalendarTokensFileName = "googleCalendarTokens.json";

function notifyRendererAppResumed() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send("app-resumed");
}

const base64UrlEncode = (buffer) =>
  buffer.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");

const createCodeVerifier = () => base64UrlEncode(crypto.randomBytes(64));

const createCodeChallenge = (verifier) => base64UrlEncode(crypto.createHash("sha256").update(verifier).digest());

const getContentType = (filePath) => {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === ".html") return "text/html; charset=utf-8";
  if (extension === ".js") return "text/javascript; charset=utf-8";
  if (extension === ".css") return "text/css; charset=utf-8";
  if (extension === ".svg") return "image/svg+xml";
  if (extension === ".json") return "application/json; charset=utf-8";
  return "application/octet-stream";
};

function createStaticServer(rootDir, preferredPort = 0) {
  const server = http.createServer((request, response) => {
    const requestUrl = new URL(request.url, "http://127.0.0.1");
    const requestedPath = decodeURIComponent(requestUrl.pathname);
    const relativePath = requestedPath === "/" ? "index.html" : requestedPath.slice(1);
    const filePath = path.resolve(rootDir, relativePath);
    const resolvedRoot = path.resolve(rootDir);

    if (!filePath.startsWith(resolvedRoot)) {
      response.writeHead(403);
      response.end("Forbidden");
      return;
    }

    fs.promises
      .readFile(filePath)
      .catch(() => fs.promises.readFile(path.join(rootDir, "index.html")))
      .then((content) => {
        response.writeHead(200, {
          "Content-Type": getContentType(filePath),
          "Cache-Control": "no-store"
        });
        response.end(content);
      })
      .catch(() => {
        response.writeHead(404);
        response.end("Not found");
      });
  });

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(preferredPort, "127.0.0.1", () => {
      server.off("error", reject);
      resolve(server);
    });
  });
}

async function createWindow() {
  const windowIconPath = path.join(__dirname, "assets/icon.png");

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 980,
    minHeight: 680,
    frame: false,
    backgroundColor: "#06080A",
    icon: windowIconPath,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      nativeWindowOpen: true
    }
  });

  if (isDev) {
    mainWindow.loadURL("http://localhost:5173");
    setTimeout(() => {
      if (!mainWindow.isDestroyed()) {
        mainWindow.webContents.openDevTools();
      }
    }, 1000);
  } else {
    staticServer = await createStaticServer(path.join(__dirname, "../dist"), STATIC_SERVER_PORT);
    const address = staticServer.address();
    mainWindow.loadURL(`http://127.0.0.1:${address.port}/`);
  }

  mainWindow.on("focus", notifyRendererAppResumed);
  mainWindow.on("show", notifyRendererAppResumed);
  mainWindow.on("restore", notifyRendererAppResumed);
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);

  createWindow().catch((error) => {
    console.error("Failed to create window", error);
    app.quit();
  });

  app.on("activate", function () {
    notifyRendererAppResumed();

    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow().catch((error) => {
        console.error("Failed to create window", error);
        app.quit();
      });
    }
  });

  powerMonitor.on("resume", notifyRendererAppResumed);
});

ipcMain.handle("window-minimize", () => {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.minimize();
});

ipcMain.handle("window-toggle-maximize", () => {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.isMaximized()) {
    mainWindow.unmaximize();
    return;
  }

  mainWindow.maximize();
});

ipcMain.handle("window-close", () => {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.close();
});

app.on("window-all-closed", function () {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", function () {
  if (staticServer) {
    staticServer.close();
    staticServer = null;
  }
});

function createOAuthCallbackServer(expectedState) {
  let server;
  let rejectCallback;
  let timeoutId;

  const closeServer = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }

    if (server?.listening) {
      server.close();
    }
  };

  const codePromise = new Promise((resolve, reject) => {
    rejectCallback = reject;
    server = http.createServer((request, response) => {
      const requestUrl = new URL(request.url, "http://127.0.0.1");

      if (requestUrl.pathname !== "/oauth2callback") {
        response.writeHead(404);
        response.end("Not found");
        return;
      }

      const error = requestUrl.searchParams.get("error");
      const code = requestUrl.searchParams.get("code");
      const state = requestUrl.searchParams.get("state");

      if (state !== expectedState) {
        response.writeHead(400, { "Content-Type": "text/html; charset=utf-8" });
        response.end("<h1>Sign-in failed</h1><p>Invalid state. You can close this tab.</p>");
        reject(new Error("Invalid OAuth state."));
        closeServer();
        return;
      }

      if (error || !code) {
        response.writeHead(400, { "Content-Type": "text/html; charset=utf-8" });
        response.end("<h1>Sign-in failed</h1><p>You can close this tab and return to TimeMapTodo.</p>");
        reject(new Error(error || "Missing OAuth authorization code."));
        closeServer();
        return;
      }

      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      response.end("<h1>Sign-in complete</h1><p>You can close this tab and return to TimeMapTodo.</p>");
      resolve({ code });
      closeServer();
    });

    timeoutId = setTimeout(() => {
      reject(new Error("Google sign-in timed out. Please try again."));
      closeServer();
    }, GOOGLE_OAUTH_TIMEOUT_MS);
  });

  const readyPromise = new Promise((resolve, reject) => {
    const onError = (error) => {
      rejectCallback(error);
      reject(error);
    };
    server.once("error", onError);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", onError);
      resolve({ port: server.address().port });
    });
  });

  return {
    ready: readyPromise,
    code: codePromise,
    close: closeServer
  };
}

async function exchangeOAuthCode({ clientId, clientSecret, code, codeVerifier, redirectUri }) {
  const tokenParams = new URLSearchParams({
    client_id: clientId,
    code,
    code_verifier: codeVerifier,
    grant_type: "authorization_code",
    redirect_uri: redirectUri
  });

  if (clientSecret) {
    tokenParams.set("client_secret", clientSecret);
  }

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: tokenParams
  });

  const body = await response.json();

  if (!response.ok) {
    throw new Error(body.error_description || body.error || "Failed to exchange Google OAuth code.");
  }

  return {
    accessToken: body.access_token,
    idToken: body.id_token,
    refreshToken: body.refresh_token || null,
    expiresIn: body.expires_in || null
  };
}

async function refreshOAuthAccessToken({ clientId, clientSecret, refreshToken }) {
  const tokenParams = new URLSearchParams({
    client_id: clientId,
    refresh_token: refreshToken,
    grant_type: "refresh_token"
  });

  if (clientSecret) {
    tokenParams.set("client_secret", clientSecret);
  }

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: tokenParams
  });

  const body = await response.json();

  if (!response.ok) {
    throw new Error(body.error_description || body.error || "Failed to refresh Google Calendar token.");
  }

  return {
    accessToken: body.access_token,
    expiresIn: body.expires_in || null
  };
}

const getGoogleCalendarTokensPath = () => path.join(app.getPath("userData"), googleCalendarTokensFileName);

const encodeSecret = (value) => {
  if (!value) return null;
  if (safeStorage.isEncryptionAvailable()) {
    return {
      encrypted: true,
      value: safeStorage.encryptString(value).toString("base64")
    };
  }

  return {
    encrypted: false,
    value
  };
};

const decodeSecret = (record) => {
  if (!record?.value) return null;
  if (record.encrypted) {
    return safeStorage.decryptString(Buffer.from(record.value, "base64"));
  }

  return record.value;
};

async function readGoogleCalendarTokens() {
  try {
    const filePath = getGoogleCalendarTokensPath();
    if (!fs.existsSync(filePath)) return {};
    return JSON.parse(await fs.promises.readFile(filePath, "utf8"));
  } catch (error) {
    console.error("Failed to read Google Calendar tokens", error);
    return {};
  }
}

async function writeGoogleCalendarTokens(tokens) {
  await fs.promises.writeFile(getGoogleCalendarTokensPath(), JSON.stringify(tokens), "utf8");
}

ipcMain.handle("google-oauth-sign-in", async (event, { clientId, clientSecret }) => {
  if (!clientId) {
    throw new Error("Missing Google desktop OAuth client ID.");
  }

  const codeVerifier = createCodeVerifier();
  const codeChallenge = createCodeChallenge(codeVerifier);
  const state = base64UrlEncode(crypto.randomBytes(24));
  const callbackServer = createOAuthCallbackServer(state);
  const { port } = await callbackServer.ready;
  const redirectUri = `http://127.0.0.1:${port}/oauth2callback`;

  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", "openid email profile https://www.googleapis.com/auth/calendar.readonly");
  authUrl.searchParams.set("code_challenge", codeChallenge);
  authUrl.searchParams.set("code_challenge_method", "S256");
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("access_type", "offline");
  authUrl.searchParams.set("prompt", "consent select_account");
  authUrl.searchParams.set("include_granted_scopes", "true");

  await shell.openExternal(authUrl.toString());

  try {
    const { code } = await callbackServer.code;
    return exchangeOAuthCode({ clientId, clientSecret, code, codeVerifier, redirectUri });
  } catch (error) {
    callbackServer.close();
    throw error;
  }
});

ipcMain.handle("google-calendar-save-token", async (event, { uid, refreshToken, accessToken, expiresAt }) => {
  if (!uid) {
    throw new Error("Missing Firebase user ID for Google Calendar token.");
  }

  const tokens = await readGoogleCalendarTokens();
  const existing = tokens[uid] || {};
  tokens[uid] = {
    ...existing,
    refreshToken: refreshToken ? encodeSecret(refreshToken) : existing.refreshToken || null,
    accessToken: accessToken ? encodeSecret(accessToken) : existing.accessToken || null,
    expiresAt: expiresAt || existing.expiresAt || 0,
    updatedAt: new Date().toISOString()
  };
  await writeGoogleCalendarTokens(tokens);
  return { success: true };
});

ipcMain.handle("google-calendar-refresh-token", async (event, { uid, clientId, clientSecret }) => {
  if (!uid) {
    throw new Error("Missing Firebase user ID for Google Calendar token.");
  }

  const tokens = await readGoogleCalendarTokens();
  const tokenRecord = tokens[uid];
  if (!tokenRecord) return { accessToken: null };

  const now = Date.now();
  const storedAccessToken = decodeSecret(tokenRecord.accessToken);
  if (storedAccessToken && tokenRecord.expiresAt && tokenRecord.expiresAt - now > 60 * 1000) {
    return {
      accessToken: storedAccessToken,
      expiresAt: tokenRecord.expiresAt
    };
  }

  const refreshToken = decodeSecret(tokenRecord.refreshToken);
  if (!refreshToken) return { accessToken: null };

  const refreshed = await refreshOAuthAccessToken({ clientId, clientSecret, refreshToken });
  const expiresAt = refreshed.expiresIn ? Date.now() + refreshed.expiresIn * 1000 : 0;
  tokens[uid] = {
    ...tokenRecord,
    accessToken: encodeSecret(refreshed.accessToken),
    expiresAt,
    updatedAt: new Date().toISOString()
  };
  await writeGoogleCalendarTokens(tokens);

  return {
    accessToken: refreshed.accessToken,
    expiresAt
  };
});

const dataFilePath = path.join(app.getPath("userData"), "timeMapTodoData.json");

function getScopedDataFilePath(storageKey) {
  if (!storageKey) return dataFilePath;

  const safeStorageKey = String(storageKey).replace(/[^a-zA-Z0-9_-]/g, "_");
  return path.join(app.getPath("userData"), `timeMapTodoData-${safeStorageKey}.json`);
}

function migrateScheduledTasks(tasks = [], boardState = {}) {
  const assignmentMap = new Map();

  Object.entries(boardState || {}).forEach(([dateKey, assignments]) => {
    (assignments || []).forEach((assignment) => {
      const current = assignmentMap.get(assignment.taskId);
      const candidate = {
        scheduledDate: dateKey,
        completed: Boolean(assignment.completed)
      };

      if (!current || candidate.scheduledDate < current.scheduledDate) {
        assignmentMap.set(assignment.taskId, candidate);
      }
    });
  });

  return tasks.map((task) => {
    const migrated = assignmentMap.get(task.id);
    return {
      id: task.id,
      title: task.title || "",
      color: task.color || "#94a3b8",
      tags: Array.isArray(task.tags) ? task.tags : [],
      deadline: task.deadline || null,
      description: task.description || "",
      scheduledDate: task.scheduledDate ?? migrated?.scheduledDate ?? null,
      completed: task.completed ?? migrated?.completed ?? false,
      sourceWorkflowId: task.sourceWorkflowId || null,
      workflowRunKey: task.workflowRunKey || null
    };
  });
}

function normalizeStoredData(data) {
  if (!data || typeof data !== "object") {
    return data;
  }

  const normalizedTasks = Array.isArray(data.tasks) ? migrateScheduledTasks(data.tasks, data.boardState || {}) : [];

  return {
    tasks: normalizedTasks,
    tagOptions: Array.isArray(data.tagOptions)
      ? data.tagOptions
      : Array.from(new Set(normalizedTasks.flatMap((task) => task.tags || []))).sort((a, b) => a.localeCompare(b)),
    workflows: Array.isArray(data.workflows)
      ? data.workflows.map((workflow) => ({
          id: workflow.id,
          name: workflow.name || workflow.title || "新しいワークフロー",
          enabled: workflow.enabled !== false,
          schedule: {
            frequency: workflow.schedule?.frequency || "weekly",
            startDate: workflow.schedule?.startDate || null,
            weekdays: Array.isArray(workflow.schedule?.weekdays)
              ? Array.from(new Set(workflow.schedule.weekdays.filter((day) => Number.isInteger(day) && day >= 0 && day <= 6))).sort((a, b) => a - b)
              : typeof workflow.schedule?.weekday === "number"
                ? [workflow.schedule.weekday]
                : [1],
            weekday: typeof workflow.schedule?.weekday === "number" ? workflow.schedule.weekday : 1,
            dayOfMonth: typeof workflow.schedule?.dayOfMonth === "number" ? workflow.schedule.dayOfMonth : 1
          },
          template: {
            title: workflow.template?.title || workflow.title || "",
            description: workflow.template?.description || workflow.description || "",
            tags: Array.isArray(workflow.template?.tags) ? workflow.template.tags : [],
            color: workflow.template?.color || workflow.color || "#94a3b8",
            dueOffsetDays: typeof workflow.template?.dueOffsetDays === "number" ? workflow.template.dueOffsetDays : 0
          },
          generatedRunKeys: Array.isArray(workflow.generatedRunKeys) ? workflow.generatedRunKeys : []
        }))
      : []
  };
}

ipcMain.handle("load-data", async (event, payload = {}) => {
  const storageKey = payload.storageKey || null;
  const includeLegacy = Boolean(payload.options?.includeLegacy);
  const scopedDataFilePath = getScopedDataFilePath(storageKey);

  try {
    if (fs.existsSync(scopedDataFilePath)) {
      const data = await fs.promises.readFile(scopedDataFilePath, "utf8");
      return normalizeStoredData(JSON.parse(data));
    }

    if (includeLegacy && scopedDataFilePath !== dataFilePath && fs.existsSync(dataFilePath)) {
      const data = await fs.promises.readFile(dataFilePath, "utf8");
      return normalizeStoredData(JSON.parse(data));
    }
  } catch (error) {
    console.error("Failed to load data", error);
  }
  return null;
});

ipcMain.handle("save-data", async (event, payload = {}) => {
  const data = payload.data;
  const storageKey = payload.storageKey || null;
  const scopedDataFilePath = getScopedDataFilePath(storageKey);

  try {
    await fs.promises.writeFile(scopedDataFilePath, JSON.stringify(normalizeStoredData(data)), "utf8");
    return { success: true };
  } catch (error) {
    console.error("Failed to save data", error);
    return { success: false, error: error.message };
  }
});
