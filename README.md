# electrum-client

Electrum Protocol Client for node.js.

# based on

* https://github.com/you21979/node-electrum-client
* https://github.com/7kharov/node-electrum-client
* https://github.com/BlueWallet/rn-electrum-client

# features

* persistence (ping strategy and reconnection)
* batch requests
* works in RN and nodejs

## protocol spec

* https://electrumx.readthedocs.io/en/latest/PROTOCOL.html

## usage

Relies on `react-native-tcp` so it should be already installed and linked in RN project. `net` should be provided from outside, this library wont do `require('net')`.
For RN it should be in `shim.js`:

```javascript
  global.net = require('react-native-tcp');
```

For nodejs it should be provided before usage:

```javascript
  global.net = require('net');
```
