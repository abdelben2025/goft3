import { app, BrowserWindow, shell } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Check if we are in development mode
const isDev = !app.isPackaged;

function createWindow() {
  // Create the browser window.
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      // Attach the preload script
      preload: path.join(__dirname, 'preload.js'),
      // Security best practices
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Load the React app.
  if (isDev) {
    // In development, load from the Vite dev server.
    win.loadURL('http://localhost:3000');
    // Open the DevTools automatically.
    win.webContents.openDevTools();
  } else {
    // In production, load the built index.html file.
    win.loadFile(path.join(__dirname, 'dist', 'index.html'));
    // إخفاء شريط القائمة في الإنتاج فقط
    win.setMenu(null);
  }

  // Ensure app quits when main window is closed
  win.on('closed', () => {
    app.quit();
  });

  // Ensure app quits if renderer process crashes
  win.webContents.on('render-process-gone', () => {
    app.quit();
  });

  // Handle external links to open in default browser
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https:') || url.startsWith('http:')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
app.whenReady().then(createWindow);

// Quit when all windows are closed.
app.on('window-all-closed', () => {
  app.quit();
});

app.on('activate', () => {
  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});