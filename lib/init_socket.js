'use strict'
/**
 * expecting NET to be injected from outside:
 * for RN it should be in shim.js:
 *     global.net = require('react-native-tcp');
 *
 * for nodejs tests it should be provided before tests:
 *     global.net = require('net');
 * */
let net = global.net;

const TIMEOUT = 10000

const getSocket = (protocol, options) => {
    switch (protocol) {
    case 'tcp':
        return new net.Socket();
    case 'tls':
    case 'ssl':
        let tls;
        try {
            // I'm in react-native
            // we dont have TLS here at all :-(
            throw new Error();
        } catch (e) {
            throw new Error('tls package could not be loaded');
        }
        return new tls.TLSSocket(options);
    }
    throw new Error('unknown protocol')
}

const initSocket = (self, protocol, options) => {
    const conn = getSocket(protocol, options);
    conn.setTimeout(TIMEOUT)
    conn.setEncoding('utf8')
    conn.setKeepAlive(true, 0)
    conn.setNoDelay(true)
    conn.on('connect', () => {
        conn.setTimeout(0)
        self.onConnect()
    })
    conn.on('close', (e) => {
        self.onClose(e)
    })
    conn.on('timeout', () => {
        const e = new Error('ETIMEDOUT')
        e.errorno = 'ETIMEDOUT'
        e.code = 'ETIMEDOUT'
        e.connect = false
        conn.emit('error', e)
    })
    conn.on('data', (chunk) => {
        conn.setTimeout(0)
        self.onRecv(chunk)
    })
    conn.on('end', (e) => {
        conn.setTimeout(0)
        self.onEnd(e)
    })
    conn.on('error', (e) => {
        self.onError(e)
    })
    return conn
}

module.exports = initSocket
