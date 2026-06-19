import { app as o, BrowserWindow as i } from "electron";
import n from "path";
let e = null;
function t() {
  e = new i({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: n.join(__dirname, "preload.js"),
      contextIsolation: !0,
      nodeIntegration: !1
    }
  }), process.env.VITE_DEV_SERVER_URL ? (e.loadURL(process.env.VITE_DEV_SERVER_URL), e.webContents.openDevTools()) : e.loadFile(n.join(__dirname, "../dist/index.html"));
}
o.whenReady().then(t);
o.on("window-all-closed", () => {
  process.platform !== "darwin" && o.quit();
});
o.on("activate", () => {
  i.getAllWindows().length === 0 && t();
});
