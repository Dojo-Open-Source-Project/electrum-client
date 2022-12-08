import * as dns from 'node:dns'
import tls, {TLSSocket} from 'node:tls'
import net from 'node:net'

interface OnReadOpts {
    buffer: Uint8Array | (() => Uint8Array);
    /**
     * This function is called for every chunk of incoming data.
     * Two arguments are passed to it: the number of bytes written to buffer and a reference to buffer.
     * Return false from this function to implicitly pause() the socket.
     */
    callback(bytesWritten: number, buf: Uint8Array): boolean;
}

type LookupFunction = (hostname: string, options: dns.LookupOneOptions, callback: (err: NodeJS.ErrnoException | null, address: string, family: number) => void) => void;

interface ConnectOpts {
    /**
     * If specified, incoming data is stored in a single buffer and passed to the supplied callback when data arrives on the socket.
     * Note: this will cause the streaming functionality to not provide any data, however events like 'error', 'end', and 'close' will
     * still be emitted as normal and methods like pause() and resume() will also behave as expected.
     */
    onread?: OnReadOpts | undefined;
}

interface TcpSocketConnectOpts extends ConnectOpts {
    port: number;
    host?: string | undefined;
    localAddress?: string | undefined;
    localPort?: number | undefined;
    hints?: number | undefined;
    family?: number | undefined;
    lookup?: LookupFunction | undefined;
    noDelay?: boolean | undefined;
    keepAlive?: boolean | undefined;
    keepAliveInitialDelay?: number | undefined;
}
interface IpcSocketConnectOpts extends ConnectOpts {
    path: string;
}
type SocketConnectOpts = TcpSocketConnectOpts | IpcSocketConnectOpts;

const isIpcSocketConnectOpts = (opts: SocketConnectOpts): opts is IpcSocketConnectOpts => 'path' in opts

/**
 * Simple wrapper to mimick Socket class from NET package, since TLS package has slightly different API.
 * We implement several methods that TCP sockets are expected to have. We will proxy call them as soon as
 * real TLS socket will be created (TLS socket created after connection).
 */
export class TlsSocketWrapper extends net.Socket {
    private _socket: TLSSocket | null
    private _timeout: number
    private _encoding: BufferEncoding
    private _keepAliveEneblad: boolean
    private _keepAliveinitialDelay: number
    private _noDelay: boolean

    constructor() {
        super()
        this._socket = null
        // defaults:
        this._timeout = 5000
        this._encoding = 'utf8'
        this._keepAliveEneblad = true
        this._keepAliveinitialDelay = 0
        this._noDelay = true
    }

    setTimeout(timeout: number, callback?: () => void): this {
        if (this._socket) this._socket.setTimeout(timeout)
        this._timeout = timeout

        if (callback) callback()

        return this
    }

    setEncoding(encoding: BufferEncoding): this {
        if (this._socket) this._socket.setEncoding(encoding)
        this._encoding = encoding

        return this
    }

    setKeepAlive(enabled: boolean, initialDelay: number): this {
        if (this._socket) this._socket.setKeepAlive(enabled, initialDelay)
        this._keepAliveEneblad = enabled
        this._keepAliveinitialDelay = initialDelay

        return this
    }

    setNoDelay(noDelay: boolean): this {
        if (this._socket) this._socket.setNoDelay(noDelay)
        this._noDelay = noDelay

        return this
    }

    connect(optionsOrPathOrPort: number | string | SocketConnectOpts, hostOrConnectionListener?: string | (() => void), connectionListener?: () => void): this {
        if (typeof optionsOrPathOrPort === 'string') throw new Error('Not implemented')

        let port: number
        let host: string
        let callback: () => void

        if (typeof optionsOrPathOrPort === 'object') {
            if (isIpcSocketConnectOpts(optionsOrPathOrPort)) throw new Error('Not implemented')

            port = optionsOrPathOrPort.port
            host = optionsOrPathOrPort.host ?? 'localhost'
        } else {
            port = optionsOrPathOrPort
            host = typeof hostOrConnectionListener === 'string' ? hostOrConnectionListener : 'localhost'
        }

        if (typeof hostOrConnectionListener === 'function') {
            callback = hostOrConnectionListener
        } else if (typeof connectionListener === 'function') {
            callback = connectionListener
        }

        // resulting TLSSocket extends <net.Socket>
        this._socket = tls.connect({ port: port, host: host, rejectUnauthorized: false }, () => {
            if (callback) callback()
        })

        // setting everything that was set to this proxy class

        this._socket.setTimeout(this._timeout)
        this._socket.setEncoding(this._encoding)
        this._socket.setKeepAlive(this._keepAliveEneblad, this._keepAliveinitialDelay)
        this._socket.setNoDelay(this._noDelay)

        // resubscribing to events on newly created socket so we could proxy them to already established listeners

        this._socket.on('data', data => {
            this.emit('data', data)
        })
        this._socket.on('error', data => {
            this.emit('error', data)
        })
        this._socket.on('close', data => {
            this.emit('close', data)
        })
        this._socket.on('connect', data => {
            this.emit('connect', data)
        })
        this._socket.on('connection', data => {
            this.emit('connection', data)
        })

        return this
    }

    end(): this {
        this._socket && this._socket.end()

        return this
    }

    destroy(): this {
        this._socket && this._socket.destroy()

        return this
    }

    write(data: string | Uint8Array): boolean {
        return this._socket ? this._socket.write(data) : false
    }
}
