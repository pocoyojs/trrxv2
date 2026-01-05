export interface IElectronAPI {
  onUpdateAvailable: (callback: (event: any, version: string) => void) => void;
  onUpdateProgress: (callback: (event: any, percent: number) => void) => void;
  onUpdateDownloaded: (callback: (event: any) => void) => void;
}

declare global {
  interface Window {
    electronAPI: IElectronAPI;
  }
}