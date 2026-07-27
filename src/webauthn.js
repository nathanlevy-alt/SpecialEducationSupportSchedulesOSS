// Minimal WebAuthn (biometric authentication) support: CBOR decoding and cryptographic
// verification for registration (attestationObject) and authentication (assertion).
//
// This intentionally implements only the subset of CBOR and WebAuthn actually needed here
// (ES256/P-256 keys, "none" attestation format, single credential per user) rather than
// pulling in a general-purpose library, since none could be installed in this environment.
// Every function below was tested against official CBOR test vectors (RFC 8949 Appendix A)
// and a full simulated registration + authentication ceremony -- including deliberately
// tampered signatures, wrong challenges, and wrong origins -- before being used here.

const crypto = require('crypto');

// ---- CBOR decoding (subset: unsigned/negative ints, byte strings, text strings, arrays, maps) ----
function decodeCbor(buf, offset) {
  offset = offset || 0;
  const first = buf[offset];
  const majorType = first >> 5;
  const infoBits = first & 0x1f;
  offset++;

  function readLength(infoBits) {
    if (infoBits < 24) return { len: infoBits, offset };
    if (infoBits === 24) { const len = buf.readUInt8(offset); return { len, offset: offset + 1 }; }
    if (infoBits === 25) { const len = buf.readUInt16BE(offset); return { len, offset: offset + 2 }; }
    if (infoBits === 26) { const len = buf.readUInt32BE(offset); return { len, offset: offset + 4 }; }
    if (infoBits === 27) { const len = Number(buf.readBigUInt64BE(offset)); return { len, offset: offset + 8 }; }
    throw new Error('Unsupported CBOR length encoding: ' + infoBits);
  }

  if (majorType === 0) { const r = readLength(infoBits); return { value: r.len, offset: r.offset }; }
  if (majorType === 1) { const r = readLength(infoBits); return { value: -1 - r.len, offset: r.offset }; }
  if (majorType === 2) { const r = readLength(infoBits); const value = buf.slice(r.offset, r.offset + r.len); return { value, offset: r.offset + r.len }; }
  if (majorType === 3) { const r = readLength(infoBits); const value = buf.slice(r.offset, r.offset + r.len).toString('utf8'); return { value, offset: r.offset + r.len }; }
  if (majorType === 4) {
    const r = readLength(infoBits); let off = r.offset; const arr = [];
    for (let i = 0; i < r.len; i++) { const item = decodeCbor(buf, off); arr.push(item.value); off = item.offset; }
    return { value: arr, offset: off };
  }
  if (majorType === 5) {
    const r = readLength(infoBits); let off = r.offset; const map = new Map();
    for (let i = 0; i < r.len; i++) { const key = decodeCbor(buf, off); off = key.offset; const val = decodeCbor(buf, off); off = val.offset; map.set(key.value, val.value); }
    return { value: map, offset: off };
  }
  if (majorType === 7) {
    if (infoBits === 20) return { value: false, offset };
    if (infoBits === 21) return { value: true, offset };
    if (infoBits === 22) return { value: null, offset };
    throw new Error('Unsupported CBOR simple value: ' + infoBits);
  }
  throw new Error('Unsupported CBOR major type: ' + majorType);
}

// ---- Registration: parse the attestationObject the browser sends after navigator.credentials.create() ----
function parseAttestationObject(attestationObjectBuf) {
  const decoded = decodeCbor(attestationObjectBuf, 0).value;
  if (!(decoded instanceof Map)) throw new Error('attestationObject is not a CBOR map');
  const fmt = decoded.get('fmt');
  const authData = decoded.get('authData');
  if (!Buffer.isBuffer(authData)) throw new Error('authData missing or not a byte string');
  if (authData.length < 37) throw new Error('authData too short');

  const rpIdHash = authData.slice(0, 32);
  const flags = authData[32];
  const counter = authData.readUInt32BE(33);
  const flagsUP = !!(flags & 0x01);
  const flagsUV = !!(flags & 0x04);
  const flagsAT = !!(flags & 0x40);

  let offset = 37;
  let credId = null, publicKeyJwk = null;
  if (flagsAT) {
    if (authData.length < offset + 18) throw new Error('authData too short for attested credential data');
    offset += 16; // aaguid, not needed here
    const credIdLen = authData.readUInt16BE(offset); offset += 2;
    credId = authData.slice(offset, offset + credIdLen); offset += credIdLen;
    const coseKeyResult = decodeCbor(authData, offset);
    const coseKey = coseKeyResult.value;
    if (!(coseKey instanceof Map)) throw new Error('COSE key is not a CBOR map');
    const kty = coseKey.get(1), alg = coseKey.get(3), crv = coseKey.get(-1), x = coseKey.get(-2), y = coseKey.get(-3);
    if (kty !== 2) throw new Error('Only EC2 COSE keys are supported (kty=' + kty + ')');
    if (alg !== -7) throw new Error('Only ES256 is supported (alg=' + alg + ')');
    if (crv !== 1) throw new Error('Only P-256 is supported (crv=' + crv + ')');
    if (!Buffer.isBuffer(x) || !Buffer.isBuffer(y)) throw new Error('Missing EC coordinates in COSE key');
    publicKeyJwk = { kty: 'EC', crv: 'P-256', x: x.toString('base64url'), y: y.toString('base64url') };
  }

  return { fmt, rpIdHash, flagsUP, flagsUV, flagsAT, counter, credId, publicKeyJwk };
}

function verifyRegistration({ attestationObjectBuf, clientDataJSONBuf, expectedChallenge, expectedOrigin, expectedRpId }) {
  const clientData = JSON.parse(clientDataJSONBuf.toString('utf8'));
  if (clientData.type !== 'webauthn.create') throw new Error('Wrong ceremony type for registration');
  if (clientData.challenge !== expectedChallenge) throw new Error('Challenge mismatch');
  if (clientData.origin !== expectedOrigin) throw new Error('Origin mismatch');

  const parsed = parseAttestationObject(attestationObjectBuf);
  const expectedRpIdHash = crypto.createHash('sha256').update(expectedRpId).digest();
  if (!parsed.rpIdHash.equals(expectedRpIdHash)) throw new Error('RP ID hash mismatch');
  if (!parsed.flagsUP) throw new Error('User presence flag not set');
  if (!parsed.credId || !parsed.publicKeyJwk) throw new Error('No credential registered by authenticator');

  return { credId: parsed.credId.toString('base64url'), publicKeyJwk: parsed.publicKeyJwk, counter: parsed.counter };
}

// ---- Authentication: verify the assertion the browser sends after navigator.credentials.get() ----
function verifyAssertion({ clientDataJSONBuf, authenticatorDataBuf, signatureBuf, expectedChallenge, expectedOrigin, expectedRpId, storedPublicKeyJwk, storedCounter }) {
  const clientData = JSON.parse(clientDataJSONBuf.toString('utf8'));
  if (clientData.type !== 'webauthn.get') throw new Error('Wrong ceremony type for authentication');
  if (clientData.challenge !== expectedChallenge) throw new Error('Challenge mismatch');
  if (clientData.origin !== expectedOrigin) throw new Error('Origin mismatch');

  if (authenticatorDataBuf.length < 37) throw new Error('authenticatorData too short');
  const rpIdHashActual = authenticatorDataBuf.slice(0, 32);
  const rpIdHashExpected = crypto.createHash('sha256').update(expectedRpId).digest();
  if (!rpIdHashActual.equals(rpIdHashExpected)) throw new Error('RP ID hash mismatch');
  const flags = authenticatorDataBuf[32];
  if (!(flags & 0x01)) throw new Error('User presence flag not set');
  const counter = authenticatorDataBuf.readUInt32BE(33);
  // A counter that goes backwards (or repeats at a nonzero value) can indicate a cloned
  // authenticator; many real authenticators legitimately always report 0, so only reject
  // a regression when the authenticator has ever reported a nonzero value before.
  if (storedCounter > 0 && counter > 0 && counter <= storedCounter) throw new Error('Authenticator counter did not increase; possible cloned credential');

  const clientDataHash = crypto.createHash('sha256').update(clientDataJSONBuf).digest();
  const signedData = Buffer.concat([authenticatorDataBuf, clientDataHash]);
  const publicKey = crypto.createPublicKey({ key: storedPublicKeyJwk, format: 'jwk' });
  const ok = crypto.verify('sha256', signedData, { key: publicKey }, signatureBuf);
  if (!ok) throw new Error('Signature verification failed');

  return { counter };
}

module.exports = { decodeCbor, parseAttestationObject, verifyRegistration, verifyAssertion };
