#!/usr/bin/env python3
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import json, re, time, urllib.parse

HOME = Path.home()
APP = HOME / "Quantus-OneClick"
LOG = APP / "miner.log"
HTML = Path(__file__).with_name("dashboard.html")
PORT = 8787

def parse():
    raw = LOG.read_text(errors="replace") if LOG.exists() else ""
    lines = raw.splitlines()
    imported = len(re.findall(r"🏆 Imported #(\d+)", raw))
    jobs = re.findall(r"⛏️ Broadcasting job (\d+):.*?difficulty=(\d+)", raw)
    # Keep solution detection intentionally conservative: only count explicit miner wording.
    sol_lines = [x for x in lines if re.search(r"(solution found|found solution|winning solution|block found|share accepted)", x, re.I)]
    peers = None
    best = finalized = None
    for line in reversed(lines):
        m = re.search(r"Idle \((\d+) peers\), best: #(\d+).*?finalized #(\d+)", line)
        if m:
            peers, best, finalized = int(m.group(1)), int(m.group(2)), int(m.group(3))
            break
    last_job = jobs[-1][0] if jobs else None
    difficulty = jobs[-1][1] if jobs else None
    activity=[]
    patterns=[
      ("Imported block", r"🏆 Imported #(\d+).*"),
      ("Mining job", r"⛏️ Broadcasting job (\d+):.*difficulty=(\d+)"),
      ("Consensus", r"🙌 Starting consensus session.*\(#(\d+)\)"),
      ("Block rebuilt", r"⛏️ Block template rebuilt while mining job (\d+).*"),
      ("Status", r"💤 Idle \((\d+) peers\), best: #(\d+).*?finalized #(\d+).*"),
    ]
    for line in lines[-80:]:
        tm = re.match(r"(\d{4}-\d\d-\d\d \d\d:\d\d:\d\d)", line)
        t = tm.group(1) if tm else ""
        typ = "Log"
        detail = line
        for name,pat in patterns:
            m=re.search(pat,line)
            if m:
                typ=name
                detail=" ".join(m.groups())
                break
        if typ!="Log":
            activity.append({"time":t,"type":typ,"detail":detail})
    running = bool(lines) and (time.time() - LOG.stat().st_mtime < 15)
    return {
      "running":running, "imported":imported, "jobs":len(jobs), "solutions":len(sol_lines),
      "peers":peers, "best":best, "finalized":finalized, "job":last_job,
      "difficulty":difficulty, "last":lines[-1] if lines else None,
      "activity":activity[-30:], "raw":"\n".join(lines[-40:])
    }

class Handler(BaseHTTPRequestHandler):
    def send(self, code, typ, data):
        b=data.encode() if isinstance(data,str) else data
        self.send_response(code); self.send_header("Content-Type",typ); self.send_header("Cache-Control","no-store")
        self.send_header("Content-Length",str(len(b))); self.end_headers(); self.wfile.write(b)
    def do_GET(self):
        path=urllib.parse.urlparse(self.path).path
        if path=="/":
            self.send(200,"text/html; charset=utf-8",HTML.read_text())
        elif path=="/api/status":
            self.send(200,"application/json; charset=utf-8",json.dumps(parse()))
        else:
            self.send(404,"text/plain","Not found")
    def log_message(self, fmt, *args): pass

if __name__=="__main__":
    APP.mkdir(parents=True,exist_ok=True)
    print(f"Quantus dashboard: http://localhost:{PORT}")
    ThreadingHTTPServer(("127.0.0.1",PORT),Handler).serve_forever()
