import fs from "fs";
import os from "os";
import path from "path";
import selfsigned from "selfsigned";

const CERT_DIR = path.join(process.cwd(), ".cert");

/** IPv4 addresses other devices on the local network can reach this machine on. */
export function lanAddresses(): string[] {
  return Object.values(os.networkInterfaces())
    .flat()
    .filter((net): net is os.NetworkInterfaceInfo => Boolean(net && net.family === "IPv4" && !net.internal))
    .map((net) => net.address);
}

/**
 * Returns a self-signed certificate valid for localhost and this machine's LAN
 * addresses, so the app can be opened over HTTPS from another device. Browsers
 * only allow the camera and microphone on secure origins.
 *
 * The certificate is cached in .cert/ and only regenerated when the
 * addresses change, so the browser warning only has to be accepted once.
 */
export function getDevCertificate(): { key: string; cert: string } {
  const hosts = ["localhost", "127.0.0.1", ...lanAddresses()].sort();
  const certFile = path.join(CERT_DIR, "cert.pem");
  const keyFile = path.join(CERT_DIR, "key.pem");
  const hostsFile = path.join(CERT_DIR, "hosts.json");

  try {
    if (JSON.parse(fs.readFileSync(hostsFile, "utf-8")).join() === hosts.join()) {
      return { key: fs.readFileSync(keyFile, "utf-8"), cert: fs.readFileSync(certFile, "utf-8") };
    }
  } catch {
    // No cached certificate yet.
  }

  const altNames = hosts.map((host) =>
    /^\d+\.\d+\.\d+\.\d+$/.test(host) ? { type: 7, ip: host } : { type: 2, value: host }
  );
  const pems = selfsigned.generate([{ name: "commonName", value: "Atarashi Meet (local development)" }], {
    days: 365,
    keySize: 2048,
    algorithm: "sha256",
    extensions: [
      { name: "basicConstraints", cA: false },
      { name: "keyUsage", digitalSignature: true, keyEncipherment: true },
      { name: "extKeyUsage", serverAuth: true },
      { name: "subjectAltName", altNames },
    ],
  });

  fs.mkdirSync(CERT_DIR, { recursive: true });
  fs.writeFileSync(keyFile, pems.private);
  fs.writeFileSync(certFile, pems.cert);
  fs.writeFileSync(hostsFile, JSON.stringify(hosts));
  return { key: pems.private, cert: pems.cert };
}
