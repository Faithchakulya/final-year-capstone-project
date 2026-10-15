import fs from "fs";
import os from "os";
import path from "path";
import forge from "node-forge";

const CERT_DIR = path.join(process.cwd(), ".cert");
const CA_CERT = path.join(CERT_DIR, "ca.crt");
const CA_KEY = path.join(CERT_DIR, "ca.key");
const SERVER_CERT = path.join(CERT_DIR, "server.crt");
const SERVER_KEY = path.join(CERT_DIR, "server.key");
const HOSTS_FILE = path.join(CERT_DIR, "hosts.json");

/** IPv4 addresses other devices on the local network can reach this machine on. */
export function lanAddresses(): string[] {
  return Object.values(os.networkInterfaces())
    .flat()
    .filter((net): net is os.NetworkInterfaceInfo => Boolean(net && net.family === "IPv4" && !net.internal))
    .map((net) => net.address);
}

function newCertificate(publicKey: forge.pki.PublicKey, days: number) {
  const cert = forge.pki.createCertificate();
  cert.publicKey = publicKey;
  cert.serialNumber = "01" + forge.util.bytesToHex(forge.random.getBytesSync(15));
  cert.validity.notBefore = new Date(Date.now() - 60_000);
  cert.validity.notAfter = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  return cert;
}

/** A certificate authority for this machine. Installed once on each test device. */
function loadOrCreateCa() {
  if (fs.existsSync(CA_CERT) && fs.existsSync(CA_KEY)) {
    return {
      cert: forge.pki.certificateFromPem(fs.readFileSync(CA_CERT, "utf-8")),
      key: forge.pki.privateKeyFromPem(fs.readFileSync(CA_KEY, "utf-8")),
    };
  }

  const keys = forge.pki.rsa.generateKeyPair(2048);
  const cert = newCertificate(keys.publicKey, 3650);
  const subject = [
    { name: "commonName", value: `Atarashi Meet local CA (${os.hostname()})` },
    { name: "organizationName", value: "Atarashi Meet development" },
  ];
  cert.setSubject(subject);
  cert.setIssuer(subject);
  cert.setExtensions([
    { name: "basicConstraints", cA: true, critical: true },
    { name: "keyUsage", keyCertSign: true, cRLSign: true, critical: true },
    { name: "subjectKeyIdentifier" },
  ]);
  cert.sign(keys.privateKey, forge.md.sha256.create());

  fs.mkdirSync(CERT_DIR, { recursive: true });
  fs.writeFileSync(CA_CERT, forge.pki.certificateToPem(cert));
  fs.writeFileSync(CA_KEY, forge.pki.privateKeyToPem(keys.privateKey));
  return { cert, key: keys.privateKey };
}

/**
 * Returns an HTTPS certificate for localhost and this machine's LAN addresses,
 * signed by a local CA. Once the CA (served at /ca.crt) is trusted on a phone
 * or laptop, the app loads there without warnings, and secure WebSockets work
 * too, which iOS Safari refuses for plain self-signed certificates.
 *
 * The CA is kept across restarts; the server certificate is regenerated when
 * the network addresses change.
 */
export function getDevCertificate(): { key: string; cert: string } {
  const ca = loadOrCreateCa();
  const hosts = ["localhost", "127.0.0.1", ...lanAddresses()].sort();

  try {
    if (JSON.parse(fs.readFileSync(HOSTS_FILE, "utf-8")).join() === hosts.join()) {
      return { key: fs.readFileSync(SERVER_KEY, "utf-8"), cert: fs.readFileSync(SERVER_CERT, "utf-8") };
    }
  } catch {
    // No server certificate yet.
  }

  const keys = forge.pki.rsa.generateKeyPair(2048);
  // Apple rejects server certificates valid for more than 825 days.
  const cert = newCertificate(keys.publicKey, 365);
  cert.setSubject([{ name: "commonName", value: "Atarashi Meet (local development)" }]);
  cert.setIssuer(ca.cert.subject.attributes);
  cert.setExtensions([
    { name: "basicConstraints", cA: false },
    { name: "keyUsage", digitalSignature: true, keyEncipherment: true, critical: true },
    { name: "extKeyUsage", serverAuth: true },
    {
      name: "subjectAltName",
      altNames: hosts.map((host) => (/^\d+\.\d+\.\d+\.\d+$/.test(host) ? { type: 7, ip: host } : { type: 2, value: host })),
    },
  ]);
  cert.sign(ca.key, forge.md.sha256.create());

  const pem = { key: forge.pki.privateKeyToPem(keys.privateKey), cert: forge.pki.certificateToPem(cert) };
  // Send the CA along with the server certificate so clients can build the chain.
  pem.cert += forge.pki.certificateToPem(ca.cert);
  fs.writeFileSync(SERVER_KEY, pem.key);
  fs.writeFileSync(SERVER_CERT, pem.cert);
  fs.writeFileSync(HOSTS_FILE, JSON.stringify(hosts));
  return pem;
}

/** The CA certificate in DER form, for installing on devices. */
export function caCertificateDer(): Buffer {
  const { cert } = loadOrCreateCa();
  return Buffer.from(forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes(), "binary");
}
