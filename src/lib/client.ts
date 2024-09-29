import { EventEmitter } from "node:events";
import net from "node:net";
import tls from "node:tls";

import type {
	Callbacks,
	ElectrumRequestBatchParams,
	ElectrumRequestParams,
	Protocol,
} from "../types";
import * as util from "./util.js";

const TIMEOUT = 60000;

export abstract class Client {
	private id: number;
	private callback_message_queue: Map<
		number,
		(err: Error | null, result?: any) => void
	>;
	protected subscribe: EventEmitter;
	private mp: util.MessageParser;
	private status: 0 | 1;
	private readonly protocol: Protocol;
	private conn: net.Socket | tls.TLSSocket | undefined;
	private readonly host: string;
	private readonly port: number;
	private readonly onErrorCallback: ((e: Error) => void) | null;

	protected constructor(
		port: number,
		host: string,
		protocol: Protocol,
		callbacks?: Callbacks,
	) {
		this.id = 0;
		this.host = host;
		this.port = port;
		this.status = 0;
		this.protocol = protocol;
		this.callback_message_queue = new Map();
		this.subscribe = new EventEmitter();
		this.mp = new util.MessageParser((body: string | undefined, n: number) => {
			this.onMessage(body, n);
		});

		if (protocol !== "tcp" && protocol !== "tls" && protocol !== "ssl") {
			throw new Error("unknown protocol");
		}

		this.onErrorCallback = callbacks?.onError ?? null;

		this.initSocket();
	}

	protected initSocket(): void {
		this.conn =
			this.protocol === "tls" || this.protocol === "ssl"
				? // @ts-expect-error
					new tls.TLSSocket()
				: new net.Socket();
		this.conn.setTimeout(TIMEOUT);
		this.conn.setEncoding("utf8");
		this.conn.setKeepAlive(true, 0);
		this.conn.setNoDelay(true);
		this.conn.on("connect", () => {
			this.conn?.setTimeout(0);
			this.onConnect();
		});
		this.conn.on("close", () => {
			this.onClose();
		});
		this.conn.on("data", (chunk: Buffer) => {
			this.conn?.setTimeout(0);
			this.onRecv(chunk);
		});
		this.conn.on("error", (e: Error) => {
			this.onError(e);
		});
		this.status = 0;
	}

	protected connect(): Promise<void> {
		if (this.conn) {
			if (this.status === 1) {
				return Promise.resolve();
			}
			this.status = 1;
			return this.connectSocket(this.conn, this.port, this.host);
		}

		return Promise.reject(
			new Error("There is no socket to initialize connection on."),
		);
	}

	private connectSocket(
		conn: net.Socket | tls.TLSSocket,
		port: number,
		host: string,
	): Promise<void> {
		return new Promise<void>((resolve, reject) => {
			const errorHandler = (e: Error) => reject(e);

			conn.on("error", errorHandler);

			conn.connect(port, host, () => {
				conn.removeListener("error", errorHandler);

				resolve();
			});
		});
	}

	close(): void {
		if (this.status === 0) {
			return;
		}
		this.conn?.end();
		this.conn?.destroy();
	}

	protected request<T>(method: string, params: ElectrumRequestParams<T>) {
		if (this.status === 0) {
			return Promise.reject(
				new Error("Connection to server lost, please retry"),
			);
		}
		return new Promise((resolve, reject) => {
			const id = ++this.id;
			const content = util.makeRequest<T>(method, params, id);
			this.callback_message_queue.set(
				id,
				util.createPromiseResult(resolve, reject),
			);
			this.conn?.write(`${content}\n`);
		});
	}

	protected requestBatch<T>(
		method: string,
		params: ElectrumRequestParams<T>,
		secondParam: ElectrumRequestBatchParams,
	) {
		if (this.status === 0) {
			return Promise.reject(
				new Error("Connection to server lost, please retry"),
			);
		}
		return new Promise((resolve, reject) => {
			const arguments_far_calls: Record<number, any> = {};
			const contents = [];
			for (const param of params) {
				const id = ++this.id;
				if (secondParam == null) {
					contents.push(util.makeRequest(method, [param], id));
				} else {
					contents.push(util.makeRequest(method, [param, secondParam], id));
				}
				arguments_far_calls[id] = param;
			}
			const content = `[${contents.join(",")}]`;
			this.callback_message_queue.set(
				this.id,
				util.createPromiseResultBatch(resolve, reject, arguments_far_calls),
			);
			// callback will exist only for max id
			this.conn?.write(`${content}\n`);
		});
	}

	private response(msg: any) {
		let callback: undefined | ((err: Error | null, result?: any) => void);
		if (!msg.id && msg[0] && msg[0].id) {
			// this is a response from batch request
			for (const m of msg) {
				if (m.id && this.callback_message_queue.has(m.id)) {
					callback = this.callback_message_queue.get(m.id);
					this.callback_message_queue.delete(m.id);
				}
			}
		} else {
			callback = this.callback_message_queue.get(msg.id);
		}

		if (callback) {
			this.callback_message_queue.delete(msg.id);
			if (msg.error) {
				callback(msg.error);
			} else {
				callback(null, msg.result || msg);
			}
		} else {
			console.log(msg);
			throw new Error("Error getting callback while handling response");
		}
	}

	private onMessage(body: string | undefined, n: number): void {
		const msg = JSON.parse(body || "");
		if (Array.isArray(msg)) {
			this.response(msg);
		} else if (msg.id == null) {
			this.subscribe.emit(msg.method, msg.params);
		} else {
			this.response(msg);
		}
	}

	private onConnect(): void {}

	protected onClose(): void {
		for (const [key, fn] of this.callback_message_queue.entries()) {
			fn(new Error("close connect"));
			this.callback_message_queue.delete(key);
		}
	}

	private onRecv(chunk: Buffer): void {
		this.mp.run(chunk);
	}

	protected onError(e: Error): void {
		if (this.onErrorCallback != null) {
			this.onErrorCallback(e);
		}
	}
}
