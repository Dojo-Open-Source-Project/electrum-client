import {Client} from './lib/client.js'
import {
    Callbacks,
    ElectrumConfig,
    ElectrumRequestBatchParams,
    ElectrumRequestParams,
    PersistencePolicy,
    Protocol
} from './types'

export class ElectrumClient extends Client {
    private onConnectCallback: ((client: ElectrumClient, versionInfo: [string, string]) => void) | null
    private onCloseCallback: ((client: ElectrumClient) => void) | null
    private onLogCallback: (str: string) => void
    private timeLastCall: number
    private persistencePolicy: Required<PersistencePolicy>
    private electrumConfig: ElectrumConfig | null
    private timeout: NodeJS.Timeout | null
    versionInfo: [string, string]

    constructor(port: number, host: string, protocol: Protocol, callbacks?: Callbacks) {
        super(port, host, protocol, callbacks)

        this.onConnectCallback = (callbacks && callbacks.onConnect) ? callbacks.onConnect : null
        this.onCloseCallback = (callbacks && callbacks.onClose) ? callbacks.onClose : null
        this.onLogCallback = (callbacks && callbacks.onLog) ? callbacks.onLog : (str: string) => {
            console.log(str)
        }

        this.timeLastCall = 0

        this.persistencePolicy = {
            retryPeriod: 10000,
            maxRetry: 1000,
            pingPeriod: 120000,
            callback: null,
        }
        this.electrumConfig = null
        this.timeout = null
        this.versionInfo = ['', '']
    }

    async initElectrum(electrumConfig: ElectrumConfig, persistencePolicy?: PersistencePolicy): Promise<ElectrumClient> {
        this.persistencePolicy = {
            ...this.persistencePolicy,
            ...persistencePolicy
        }
        this.electrumConfig = electrumConfig
        this.timeLastCall = 0

        await this.connect()

        this.versionInfo = (await this.server_version(this.electrumConfig?.client ?? '', this.electrumConfig?.version ?? ['', ''])) as [string, string]

        if (this.onConnectCallback != null) {
            this.onConnectCallback(this, this.versionInfo)
        }

        return this
    }

    // Override parent
    protected async request(method: string, params: ElectrumRequestParams) {
        this.timeLastCall = Date.now()

        const response = await super.request(method, params)

        this.keepAlive()

        return response
    }

    protected async requestBatch(method: string, params: ElectrumRequestParams, secondParam?: ElectrumRequestBatchParams) {
        this.timeLastCall = Date.now()

        const response = await super.requestBatch(method, params, secondParam)

        this.keepAlive()

        return response
    }

    protected onClose(): void {
        super.onClose()

        const list = [
            'server.peers.subscribe',
            'blockchain.numblocks.subscribe',
            'blockchain.headers.subscribe',
            'blockchain.address.subscribe',
        ]

        for (const event of list) this.subscribe.removeAllListeners(event)

        let retryPeriod = 10000
        if (this.persistencePolicy.retryPeriod > 0) {
            retryPeriod = this.persistencePolicy.retryPeriod
        }

        if (this.onCloseCallback != null) {
            this.onCloseCallback(this)
        }

        setTimeout(() => {
            if (this.persistencePolicy.maxRetry > 0) {
                this.reconnect().catch((error) => {
                    this.onError(error)
                })

                this.persistencePolicy.maxRetry -= 1

            } else if (this.persistencePolicy.callback != null) {
                this.persistencePolicy.callback()
            }
        }, retryPeriod)
    }

    // ElectrumX persistancy
    private keepAlive(): void {
        if (this.timeout != null) {
            clearTimeout(this.timeout)
        }

        let pingPeriod = 120000
        if (this.persistencePolicy.pingPeriod > 0) {
            pingPeriod = this.persistencePolicy.pingPeriod
        }

        this.timeout = setTimeout(() => {
            if (this.timeLastCall !== 0 && Date.now() > this.timeLastCall + pingPeriod) {
                this.server_ping().catch((error) => {
                    this.log(`Keep-Alive ping failed: ${error}`)
                })
            }
        }, pingPeriod)
    }

    close(): void {
        super.close()

        if (this.timeout != null) {
            clearTimeout(this.timeout)
        }

        // eslint-disable-next-line no-multi-assign
        this.reconnect = this.reconnect = this.onClose = this.keepAlive = () => Promise.resolve(this) // dirty hack to make it stop reconnecting
    }

    private reconnect(): Promise<ElectrumClient> {
        this.log('Electrum attempting reconnect...')

        this.initSocket()

        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        return this.persistencePolicy == null ? this.initElectrum(this.electrumConfig!) : this.initElectrum(this.electrumConfig!, this.persistencePolicy)
    }

    private log(str: string): void {
        this.onLogCallback(str)
    }

    // ElectrumX API
    server_version(client_name: string, protocol_version: string[]) {
        return this.request('server.version', [client_name, protocol_version])
    }

    server_banner() {
        return this.request('server.banner', [])
    }

    server_features() {
        return this.request('server.features', [])
    }

    server_ping() {
        return this.request('server.ping', [])
    }

    server_addPeer(features: any) {
        return this.request('server.add_peer', [features])
    }

    serverDonation_address() {
        return this.request('server.donation_address', [])
    }

    serverPeers_subscribe() {
        return this.request('server.peers.subscribe', [])
    }

    blockchainAddress_getProof(address: string) {
        return this.request('blockchain.address.get_proof', [address])
    }

    blockchainScripthash_getBalance(scripthash: string) {
        return this.request('blockchain.scripthash.get_balance', [scripthash])
    }

    blockchainScripthash_getBalanceBatch(scripthashes: string[]) {
        return this.requestBatch('blockchain.scripthash.get_balance', scripthashes)
    }

    blockchainScripthash_listunspentBatch(scripthashes: string[]) {
        return this.requestBatch('blockchain.scripthash.listunspent', scripthashes)
    }

    blockchainScripthash_getHistory(scripthash: string) {
        return this.request('blockchain.scripthash.get_history', [scripthash])
    }

    blockchainScripthash_getHistoryBatch(scripthashes: string[]) {
        return this.requestBatch('blockchain.scripthash.get_history', scripthashes)
    }

    blockchainScripthash_getMempool(scripthash: string) {
        return this.request('blockchain.scripthash.get_mempool', [scripthash])
    }

    blockchainScripthash_listunspent(scripthash: string) {
        return this.request('blockchain.scripthash.listunspent', [scripthash])
    }

    blockchainScripthash_subscribe(scripthash: string) {
        return this.request('blockchain.scripthash.subscribe', [scripthash])
    }

    blockchainBlock_getHeader(height: number) {
        return this.request('blockchain.block.get_header', [height])
    }

    blockchainBlock_headers(start_height: number, count: number) {
        return this.request('blockchain.block.headers', [start_height, count])
    }

    blockchainEstimatefee(number: number) {
        return this.request('blockchain.estimatefee', [number])
    }

    blockchainHeaders_subscribe(raw = false) {
        return this.request('blockchain.headers.subscribe', [raw])
    }

    blockchain_relayfee() {
        return this.request('blockchain.relayfee', [])
    }

    blockchainTransaction_broadcast(rawtx: string) {
        return this.request('blockchain.transaction.broadcast', [rawtx])
    }

    blockchainTransaction_get(tx_hash: string, verbose = false) {
        return this.request('blockchain.transaction.get', [tx_hash, verbose])
    }

    blockchainTransaction_getBatch(tx_hashes: string[], verbose = false) {
        return this.requestBatch('blockchain.transaction.get', tx_hashes, verbose)
    }

    blockchainTransaction_getMerkle(tx_hash: string, height: number) {
        return this.request('blockchain.transaction.get_merkle', [tx_hash, height])
    }

    mempool_getFeeHistogram() {
        return this.request('mempool.get_fee_histogram', [])
    }

    // ---------------------------------
    // protocol 1.1 deprecated method
    // ---------------------------------
    blockchainUtxo_getAddress(tx_hash: string, index: number) {
        return this.request('blockchain.utxo.get_address', [tx_hash, index])
    }

    blockchainNumblocks_subscribe() {
        return this.request('blockchain.numblocks.subscribe', [])
    }

    // ---------------------------------
    // protocol 1.2 deprecated method
    // ---------------------------------
    blockchainBlock_getChunk(index: number) {
        return this.request('blockchain.block.get_chunk', [index])
    }

    blockchainAddress_getBalance(address: string) {
        return this.request('blockchain.address.get_balance', [address])
    }

    blockchainAddress_getHistory(address: string) {
        return this.request('blockchain.address.get_history', [address])
    }

    blockchainAddress_getMempool(address: string) {
        return this.request('blockchain.address.get_mempool', [address])
    }

    blockchainAddress_listunspent(address: string) {
        return this.request('blockchain.address.listunspent', [address])
    }

    blockchainAddress_subscribe(address: string) {
        return this.request('blockchain.address.subscribe', [address])
    }
}