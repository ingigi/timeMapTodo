const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");

const isDev = process.env.NODE_ENV === "development";

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false
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
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on("activate", function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", function () {
  if (process.platform !== "darwin") app.quit();
});

const dataFilePath = path.join(app.getPath("userData"), "timeMapTodoData.json");

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

ipcMain.handle("load-data", async () => {
  try {
    if (fs.existsSync(dataFilePath)) {
      const data = await fs.promises.readFile(dataFilePath, "utf8");
      return normalizeStoredData(JSON.parse(data));
    }
  } catch (error) {
    console.error("Failed to load data", error);
  }
  return null;
});

ipcMain.handle("save-data", async (event, data) => {
  try {
    await fs.promises.writeFile(dataFilePath, JSON.stringify(normalizeStoredData(data)), "utf8");
    return { success: true };
  } catch (error) {
    console.error("Failed to save data", error);
    return { success: false, error: error.message };
  }
});
