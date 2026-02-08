/**
 * Browser shim for isomorphic-ws.
 *
 * The @midnight-ntwrk/midnight-js-indexer-public-data-provider does:
 *   import * as ws from 'isomorphic-ws';
 *   ... ws.WebSocket ...
 *
 * The real isomorphic-ws browser.js only has `export default WebSocket`,
 * but the indexer needs a named `WebSocket` export. This shim bridges
 * the gap by re-exporting the browser's native WebSocket as both
 * named and default exports.
 */

const _WebSocket =
  typeof WebSocket !== "undefined"
    ? WebSocket
    : typeof globalThis !== "undefined"
      ? globalThis.WebSocket
      : undefined;

export { _WebSocket as WebSocket };
export default _WebSocket;
