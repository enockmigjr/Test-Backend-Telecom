export type AntivirusScanResult = { readonly clean: true } | { readonly clean: false; readonly signature: string };

export interface AntivirusScanner {
  scan(buffer: Buffer): Promise<AntivirusScanResult>;
  health(): Promise<boolean>;
}

export const ANTIVIRUS_SCANNER = Symbol('ANTIVIRUS_SCANNER');
