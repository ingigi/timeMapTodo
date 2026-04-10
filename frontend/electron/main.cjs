const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

const isDev = process.env.NODE_ENV === 'development';

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    // 起動時の負荷を分散させるため、少し遅らせてDevToolsを開く
    setTimeout(() => {
      if (!mainWindow.isDestroyed()) {
        mainWindow.webContents.openDevTools();
      }
    }, 1000);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

// IPC ハンドラ - データ保存/読み込み
const dataFilePath = path.join(app.getPath('userData'), 'timeMapTodoData.json');

function normalizeStoredData(data) {
  if (!data || typeof data !== 'object') {
    return data;
  }

  const normalizedTasks = Array.isArray(data.tasks)
    ? data.tasks.map((task) => ({
        ...task,
        placementType: task?.placementType === 'recurring' || task?.placementType === 'auto' ? 'recurring' : 'manual',
        recurrence: task?.placementType === 'recurring' || task?.placementType === 'auto' ? task.recurrence || null : null
      }))
    : [];

  const normalizedBoardState = Object.fromEntries(
    Object.entries(data.boardState || {}).map(([dateKey, assignments]) => [
      dateKey,
      Array.isArray(assignments)
        ? assignments.map((assignment) => ({
            ...assignment,
            source: assignment?.source === 'auto' ? 'auto' : assignment?.source === 'recurring' ? 'recurring' : 'manual',
            recurrenceTaskId: assignment?.recurrenceTaskId || null,
            recurrenceKey: assignment?.recurrenceKey || null
          }))
        : []
    ])
  );

  return {
    ...data,
    tasks: normalizedTasks,
    boardState: normalizedBoardState
  };
}

ipcMain.handle('load-data', async () => {
  try {
    if (fs.existsSync(dataFilePath)) {
      const data = await fs.promises.readFile(dataFilePath, 'utf8');
      return normalizeStoredData(JSON.parse(data));
    }
  } catch (error) {
    console.error('Failed to load data', error);
  }
  return null;
});

// 保存処理を handle (async) に変更し、非同期で書き込むようにする
ipcMain.handle('save-data', async (event, data) => {
  try {
    await fs.promises.writeFile(dataFilePath, JSON.stringify(normalizeStoredData(data)), 'utf8');
    return { success: true };
  } catch (error) {
    console.error('Failed to save data', error);
    return { success: false, error: error.message };
  }
});
