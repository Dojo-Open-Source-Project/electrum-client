# Changelog

## 1.5.0 (2024-09-27)
- Removed unnecessary boilerplate (TlsSocketWrapper)
- Added static `createClient` method for more convenience
- Updated dependencies

- (DEV) - Updated to Node.js v18
- (DEV) - Swtiched to PNPM
- (DEV) - Switched from eslint to biome

## 1.4.0 (2023-05-24)
- Updated keepAlive to use interval instead of timeout
- Fixed setTimeout on TlsSocketWrapper
- Updated dependencies

## 1.3.0 (2022-12-08)
- Updated TLS wrapper
- Updated dependencies
- Switched from mocha to vitest

## 1.2.4 (2022-03-11)
- Fixed type of protocol version in config

## 1.2.3 (2022-03-02)
- Removed faulty parameter from `blockchain.headers.subscribe` call

## 1.2.2 (2022-03-02)
- Fixed ES module definition

## 1.2.0 (2022-03-01)
- Complete rewrite to Typescript
- Added mocha tests
- Added ESlint
- Minor changes and fixes
