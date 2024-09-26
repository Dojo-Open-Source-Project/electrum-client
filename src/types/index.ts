import type { ElectrumClient } from "../index.js";

export type Protocol = "tcp" | "tls" | "ssl";

export type Callbacks = {
	onConnect?: (client: ElectrumClient, versionInfo: [string, string]) => void;
	onClose?: (client: ElectrumClient) => void;
	onLog?: (str: string) => void;
	onError?: (e: Error) => void;
};

export type PersistencePolicy = {
	retryPeriod?: number;
	maxRetry?: number;
	pingPeriod?: number;
	callback?: (() => void) | null;
};

export type ElectrumConfig = {
	client: string;
	version: string | [string, string];
};

export type ElectrumRequestParams<T> = Array<
	number | string | boolean | Array<T>
>;

export type ElectrumRequestBatchParams = number | string | boolean | undefined;
