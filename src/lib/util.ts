import {ElectrumRequestParams} from '../types'

export const makeRequest = (method: string, params: ElectrumRequestParams, id: number) => {
    return JSON.stringify({
        jsonrpc: '2.0',
        method: method,
        params: params,
        id: id,
    })
}

export const createRecursiveParser = (max_depth: number, delimiter: string) => {
    const MAX_DEPTH = max_depth
    const DELIMITER = delimiter
    const recursiveParser = (n: number, buffer: string, callback: (xs: string | undefined, n: number) => void): { code: number, buffer: string } => {
        if (buffer.length === 0) {
            return {code: 0, buffer: buffer}
        }
        if (n > MAX_DEPTH) {
            return {code: 1, buffer: buffer}
        }
        const xs = buffer.split(DELIMITER)
        if (xs.length === 1) {
            return {code: 0, buffer: buffer}
        }
        callback(xs.shift(), n)
        return recursiveParser(n + 1, xs.join(DELIMITER), callback)
    }
    return recursiveParser
}

export const createPromiseResult = (resolve: (value?: any) => void, reject: (reason?: any) => void) => {
    return (err: Error | null, result?: any) => {
        if (err) reject(err)
        else resolve(result)
    }
}

export const createPromiseResultBatch = (resolve: (value?: any) => void, reject: (reason?: any) => void, argz: Record<number, any>) => {
    return (err: Error | null, result?: Array<any>) => {
        if (result && result[0] && result[0].id) {
            // this is a batch request response
            for (const r of result) {
                r.param = argz[r.id]
            }
        }
        if (err) reject(err)
        else resolve(result)
    }
}

type MessageParserCallback = (body: string | undefined, n: number) => void;

export class MessageParser {
    private buffer: string
    private callback: MessageParserCallback
    private recursiveParser = createRecursiveParser(20, '\n')

    constructor(callback: MessageParserCallback) {
        this.buffer = ''
        this.callback = callback
        this.recursiveParser = createRecursiveParser(20, '\n')
    }

    run(chunk: Buffer) {
        this.buffer += chunk
        /* eslint-disable-next-line no-constant-condition */
        while (true) {
            const res = this.recursiveParser(0, this.buffer, this.callback)
            this.buffer = res.buffer
            if (res.code === 0) {
                break
            }
        }
    }
}
