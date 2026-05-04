const nodeCrypto = require('node:crypto');

if (!globalThis.crypto || typeof globalThis.crypto.getRandomValues !== 'function') {
  globalThis.crypto = nodeCrypto.webcrypto;
}

if (typeof nodeCrypto.getRandomValues !== 'function') {
  const fallback = (typedArray) => {
    if (nodeCrypto.webcrypto && typeof nodeCrypto.webcrypto.getRandomValues === 'function') {
      return nodeCrypto.webcrypto.getRandomValues(typedArray);
    }
    return nodeCrypto.randomFillSync(typedArray);
  };

  try {
    nodeCrypto.getRandomValues = fallback;
  } catch {
    Object.defineProperty(nodeCrypto, 'getRandomValues', {
      value: fallback,
      configurable: true,
      writable: true,
    });
  }
}
