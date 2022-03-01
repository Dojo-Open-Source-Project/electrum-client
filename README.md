# @samouraiwallet/electrum-client

Electrum Protocol client for Node.js.

This library uses ESModules, Node.js v14 or higher is required.

# Based on

* https://github.com/mempool/electrum-client
* https://github.com/you21979/node-electrum-client
* https://github.com/7kharov/node-electrum-client
* https://github.com/BlueWallet/rn-electrum-client

# Features

* Persistence (ping strategy and reconnection)
* Batch requests
* Promise API
* Fully typed (Typescript)

## Protocol spec

* https://electrumx.readthedocs.io/en/latest/PROTOCOL.html

## Usage

```js
import {ElectrumClient} from "@samouraiwallet/electrum-client";

const run = async () => {
    tcpClient = new ElectrumClient(60001, 'btc.electroncash.dk', 'tcp');

    await tcpClient.initElectrum({client: 'electrum-client-js', version: ['1.2', '1.4']}, {
        retryPeriod: 5000,
        maxRetry: 10,
        pingPeriod: 5000,
    });
    
    const rawTx = await tcpClient.blockchainTransaction_get('b270b8a113c048ed0024e470e3c7794565c2b3e18c600d20410ec8f454b7d25a');
    
    return rawTx;
    // result: 02000000016016c6d039cbdeefa655e4b5ac61ec2b5fe16920529f086a2439f59a5994bed6200000006a4730440220421b5daf5f72e514075d256121d6b66e1d9a8993d37ceb0532baca11f6964da502205333d1c4b9be749180bfa8da4da6a07c0e9e2d853c809a75c4b60ef717a628b20121029139c783aa8f31707a67248a6a6b643855e9d1484dbd53cfe7d9e3adf3ce7098ffffffff02c19a01000000000017a9146eda8b447af853746f04b902fea5b2cd959d866d87692c0200000000001976a914443674ce759f8fa2fe83a6608339da782b890c1988ac00000000
}

```
