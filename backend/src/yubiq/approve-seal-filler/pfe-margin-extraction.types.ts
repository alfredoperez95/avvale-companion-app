export type PfeMarginWorkerRequest = {
  filePath: string;
  xlsxModulePath: string;
};

export type PfeMarginWorkerMessage =
  | { ok: true; marginPercentage: number | null }
  | { ok: false; error: string };

