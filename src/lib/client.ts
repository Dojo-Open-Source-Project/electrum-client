import net from 'node:net'
import tls from 'node:tls'
import {EventEmitter} from 'node:events'

import * as util from './util.js'
import type {Protocol, Callbacks, ElectrumRequestBatchParams, ElectrumRequestParams} from '../types'

const TIMEOUT = 5000

export abstract class Client {
    private id: number
    private callback_message_queue: Map<number, (err: Error | null, result?: any) => void>
    protected subscribe: EventEmitter
    private mp: util.MessageParser
    private readonly protocol: Protocol
    private conn: net.Socket | tls.TLSSocket | undefined
    private readonly host: string
    private readonly port: number
    private readonly onErrorCallback: ((e: Error) => void) | null

    protected constructor(port: number, host: string, protocol: Protocol, callbacks?: Callbacks) {
        this.id = 0
        this.host = host
        this.port = port
        this.protocol = protocol
        this.callback_message_queue = new Map()
        this.subscribe = new EventEmitter()
        this.mp = new util.MessageParser((body: string | undefined, n: number) => {
            this.onMessage(body, n)
        })

        if (protocol !== 'tcp' && protocol !== 'tls' && protocol !== 'ssl') {
            throw new Error('unknown protocol')
        }

        this.onErrorCallback = callbacks?.onError ?? null

        this.initSocket()
    }

    protected initSocket(): void {
        this.conn = this.protocol === 'tls' || this.protocol === 'ssl'
            ? tls.connect({ host: this.host, port: this.port, rejectUnauthorized: false }, () => {
                this.conn && this.conn.setTimeout(0)
                this.onConnect()
            })
            : net.connect({ host: this.host, port: this.port }, () => {
                this.conn && this.conn.setTimeout(0)
                this.onConnect()
            })
        this.conn.setTimeout(TIMEOUT)
        this.conn.setEncoding('utf8')
        this.conn.setKeepAlive(true, 0)
        this.conn.setNoDelay(true)
        this.conn.on('close', () => {
            this.onClose()
        })
        this.conn.on('data', (chunk: Buffer) => {
            this.conn && this.conn.setTimeout(0)
            this.onRecv(chunk)
        })
        this.conn.on('error', (e: Error) => {
            this.onError(e)
        })
    }

    protected connect(): Promise<void> {
        return new Promise<void>((resolve) => {
            if (this.conn && this.conn.readyState === 'open') {
                resolve()
            }
            this.protocol === 'tcp'
                ? this.conn && this.conn.once('connect', () => {
                    resolve()
                })
                : this.conn && this.conn.once('secureConnect', () => {
                    resolve()
                })
        })
    }

    close(): void {
        if (this.conn && this.conn.readyState === 'closed') {
            return
        }
        this.conn && this.conn.end()
        this.conn && this.conn.destroy()
    }

    protected request(method: string, params: ElectrumRequestParams) {
        if (this.conn && this.conn.readyState === 'closed') {
            return Promise.reject(new Error('Connection to server lost, please retry'))
        }
        return new Promise((resolve, reject) => {
            const id = ++this.id
            const content = util.makeRequest(method, params, id)
            this.callback_message_queue.set(id, util.createPromiseResult(resolve, reject))
            this.conn && this.conn.write(`${content}\n`)
        })
    }

    protected requestBatch(method: string, params: ElectrumRequestParams, secondParam: ElectrumRequestBatchParams) {
        if (this.conn && this.conn.readyState === 'closed') {
            return Promise.reject(new Error('Connection to server lost, please retry'))
        }
        return new Promise((resolve, reject) => {
            const arguments_far_calls: Record<number, any> = {}
            const contents = []
            for (const param of params) {
                const id = ++this.id
                if (secondParam == null) {
                    contents.push(util.makeRequest(method, [param], id))
                } else {
                    contents.push(util.makeRequest(method, [param, secondParam], id))
                }
                arguments_far_calls[id] = param
            }
            const content = `[${  contents.join(',')  }]`
            this.callback_message_queue.set(this.id, util.createPromiseResultBatch(resolve, reject, arguments_far_calls))
            // callback will exist only for max id
            this.conn && this.conn.write(`${content  }\n`)
        })
    }

    private response(msg: any) { // FIXME
        let callback
        if (!msg.id && msg[0] && msg[0].id) {
            // this is a response from batch request
            for (const m of msg) {
                if (m.id && this.callback_message_queue.has(m.id)) {
                    callback = this.callback_message_queue.get(m.id)
                    this.callback_message_queue.delete(m.id)
                }
            }
        } else {
            callback = this.callback_message_queue.get(msg.id)
        }

        if (callback) {
            this.callback_message_queue.delete(msg.id)
            if (msg.error) {
                callback(msg.error)
            } else {
                callback(null, msg.result || msg)
            }
        } else {
            console.log(msg)
            throw new Error('Error getting callback while handling response')
        }
    }

    private onMessage(body: string | undefined, n: number): void {
        const msg = JSON.parse(body || '')
        if (Array.isArray(msg)) {
            this.response(msg)
        } else if (msg.id == null) {
            this.subscribe.emit(msg.method, msg.params)
        } else {
            this.response(msg)
        }
    }

    // eslint-disable-next-line @typescript-eslint/no-empty-function
    private onConnect(): void {}

    protected onClose(): void {
        for (const [key, fn] of this.callback_message_queue.entries()) {
            fn(new Error('close connect'))
            this.callback_message_queue.delete(key)
        }
    }

    private onRecv(chunk: Buffer): void {
        this.mp.run(chunk)
    }

    protected onError(e: Error): void {
        if (this.onErrorCallback != null) {
            this.onErrorCallback(e)
        }
    }
}
