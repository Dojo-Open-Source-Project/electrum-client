import { assert, afterEach, beforeEach, describe, expect, it } from "vitest";

import { ElectrumClient } from "../src";

let tcpClient: ElectrumClient;

beforeEach(async () => {
	tcpClient = await ElectrumClient.createClient({
		port: 60001,
		host: "btc.electroncash.dk",
		protocol: "tcp",
		electrumConfig: { client: "electrum-client-js", version: ["1.2", "1.4"] },
		persistencePolicy: { retryPeriod: 2000 },
	});
});

afterEach(() => {
	tcpClient.close();
});

describe("ElectrumClient TCP", () => {
	it("successfully connects to Electrum server", async () => {
		assert.ok(tcpClient.versionInfo);
	});

	it("successfully makes a standard request", async () => {
		const response = await tcpClient.blockchainTransaction_get(
			"b270b8a113c048ed0024e470e3c7794565c2b3e18c600d20410ec8f454b7d25a",
		);

		assert.strictEqual(
			response,
			"02000000016016c6d039cbdeefa655e4b5ac61ec2b5fe16920529f086a2439f59a5994bed6200000006a4730440220421b5daf5f72e514075d256121d6b66e1d9a8993d37ceb0532baca11f6964da502205333d1c4b9be749180bfa8da4da6a07c0e9e2d853c809a75c4b60ef717a628b20121029139c783aa8f31707a67248a6a6b643855e9d1484dbd53cfe7d9e3adf3ce7098ffffffff02c19a01000000000017a9146eda8b447af853746f04b902fea5b2cd959d866d87692c0200000000001976a914443674ce759f8fa2fe83a6608339da782b890c1988ac00000000",
		);
	});

	it("successfully makes a batch request", async () => {
		const response = await tcpClient.blockchainTransaction_getBatch([
			"b270b8a113c048ed0024e470e3c7794565c2b3e18c600d20410ec8f454b7d25a",
			"f08474320cb16c34bb6ccbd8ca77b41168589155e8cf0af787d8d8b2a975af0b",
		]);

		expect(response).toEqual(
			expect.arrayContaining([
				{
					id: 2,
					jsonrpc: "2.0",
					param:
						"b270b8a113c048ed0024e470e3c7794565c2b3e18c600d20410ec8f454b7d25a",
					result:
						"02000000016016c6d039cbdeefa655e4b5ac61ec2b5fe16920529f086a2439f59a5994bed6200000006a4730440220421b5daf5f72e514075d256121d6b66e1d9a8993d37ceb0532baca11f6964da502205333d1c4b9be749180bfa8da4da6a07c0e9e2d853c809a75c4b60ef717a628b20121029139c783aa8f31707a67248a6a6b643855e9d1484dbd53cfe7d9e3adf3ce7098ffffffff02c19a01000000000017a9146eda8b447af853746f04b902fea5b2cd959d866d87692c0200000000001976a914443674ce759f8fa2fe83a6608339da782b890c1988ac00000000",
				},
				{
					id: 3,
					jsonrpc: "2.0",
					param:
						"f08474320cb16c34bb6ccbd8ca77b41168589155e8cf0af787d8d8b2a975af0b",
					result:
						"01000000000101536c64334a7e7c49713d836ef9230054e6c38b8c086a3e2068d054781aae89050100000000ffffffff025d9200000000000017a91415035c6225abdf351aa90e6a60726f5e2653839f8728751900000000002200209054b26aafa22ff9bff790d0ed9cc9c84079d7e237e1b617042df9a9734d8aec0400473044022059913f1526f2bfd5a236f86ada8f68b4943632ef9d306d44e482935774059aa60220360d783ca765299c114e28dd0304df913315e5297d9f78fd89319c1ddc6177260147304402204a135548f460dd96e3ea7f981c69d52773cec1475c278631a2180a8010b5dd7802206e090c9c6b1734a9757c76f9a1d5e576bf7b805d12e2d50d344800628dde4f420147522102254d4655d0cae8ad2d96a6789d08ac63982171f10795a5146d03a8369ffd51b921029009039142b4de669fe67507bb3a6b17ff38f7798ae4d7bb3826a3cc2527d62252ae00000000",
				},
			]),
		);
	});

	it("should make a request after reconnection", async () => {
		// @ts-ignore Hijack Typescript to call method on private field in order to simulate connection close
		tcpClient.conn?.end();
		const promise = await new Promise((resolve) => {
			setTimeout(async () => {
				const res = await tcpClient.server_banner();

				resolve(res);
			}, 10000);
		});

		assert.ok(promise);
	});
});
