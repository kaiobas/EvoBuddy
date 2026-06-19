import { contextBridge as n, ipcRenderer as r } from "electron";
n.exposeInMainWorld("electronAPI", {
  // Database operations will be exposed here
  invoke: (e, ...o) => r.invoke(e, ...o)
});
