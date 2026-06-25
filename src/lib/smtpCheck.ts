import "server-only";
import net from "node:net";
import tls from "node:tls";

// Verifies the Supabase→SendPulse SMTP login actually authenticates (the exact
// thing that broke: a 535 from a stale password). Does a real SMTP handshake
// up to AUTH LOGIN — no email is sent. Returns the server's auth response.
export async function checkSmtpAuth(): Promise<{ ok: boolean; detail: string }> {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 2525);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) {
    return { ok: false, detail: "SMTP_HOST/USER/PASS env not set" };
  }

  return new Promise((resolve) => {
    let done = false;
    const finish = (ok: boolean, detail: string) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      try { sock.destroy(); } catch { /* ignore */ }
      resolve({ ok, detail });
    };
    const timer = setTimeout(() => finish(false, "timeout"), 15000);

    const readLine = (s: net.Socket | tls.TLSSocket, cb: (line: string) => void) => {
      let buf = "";
      const onData = (d: Buffer) => {
        buf += d.toString();
        if (/\r\n$/.test(buf)) {
          s.removeListener("data", onData);
          cb(buf.trim());
        }
      };
      s.on("data", onData);
    };

    const sock = net.createConnection(port, host);
    sock.on("error", (e) => finish(false, `connect: ${e.message}`));
    sock.once("connect", () => {
      readLine(sock, () => {
        sock.write("EHLO healthcheck\r\n");
        readLine(sock, () => {
          sock.write("STARTTLS\r\n");
          readLine(sock, () => {
            const sec = tls.connect(
              { socket: sock, servername: host, rejectUnauthorized: false },
              () => {
                sec.write("EHLO healthcheck\r\n");
                readLine(sec, () => {
                  sec.write("AUTH LOGIN\r\n");
                  readLine(sec, () => {
                    sec.write(Buffer.from(user).toString("base64") + "\r\n");
                    readLine(sec, () => {
                      sec.write(Buffer.from(pass).toString("base64") + "\r\n");
                      readLine(sec, (resp) => {
                        try { sec.write("QUIT\r\n"); sec.end(); } catch { /* ignore */ }
                        finish(/^235/.test(resp), resp);
                      });
                    });
                  });
                });
              }
            );
            sec.on("error", (e) => finish(false, `tls: ${e.message}`));
          });
        });
      });
    });
  });
}
