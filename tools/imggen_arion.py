#!/usr/bin/env python3
"""Генерация картинок сайта КонсулКар через Arion HUB (OpenAI-совместимый).

Ключ: ~/.claude/secrets/arionhub.env (в репозиторий не коммитится).
  python3 tools/imggen.py one "prompt" --out site/img/photo/x.png [--model gpt-image-2] [--size 1536x1024]
  python3 tools/imggen.py batch tasks.json [--skip-existing]     # [{"name":..,"prompt":..,"size":..}]
"""
import os, sys, json, base64, argparse, urllib.request, urllib.error, time

SECRETS = os.path.expanduser("~/.claude/secrets/arionhub.env")

def cfg():
    key, base = os.environ.get("ARIONHUB_KEY", ""), "https://arionhub.pro/v1"
    if os.path.exists(SECRETS):
        for line in open(SECRETS, encoding="utf-8"):
            line = line.strip()
            if line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            v = v.strip().strip('"').strip("'")
            if k.strip().endswith("API_KEY") and v:
                key = v
            if k.strip().endswith("BASE_URL") and v:
                base = v.rstrip("/")
    if not key:
        sys.exit("Нет ключа: заполни " + SECRETS)
    return key, base

def gen(prompt, out, model="gpt-image-2", size="1536x1024", tries=3):
    key, base = cfg()
    body = json.dumps({"model": model, "prompt": prompt, "size": size, "n": 1}).encode()
    req = urllib.request.Request(base + "/images/generations", data=body, headers={
        "Authorization": "Bearer " + key, "Content-Type": "application/json"})
    last = ""
    for attempt in range(tries):
        try:
            with urllib.request.urlopen(req, timeout=420) as r:
                data = json.load(r)
            item = data["data"][0]
            os.makedirs(os.path.dirname(out) or ".", exist_ok=True)
            if item.get("b64_json"):
                open(out, "wb").write(base64.b64decode(item["b64_json"]))
            else:
                with urllib.request.urlopen(item["url"], timeout=420) as im:
                    open(out, "wb").write(im.read())
            return out
        except urllib.error.HTTPError as e:
            last = f"HTTP {e.code}: {e.read()[:300].decode('utf-8', 'replace')}"
        except Exception as e:                                  # таймаут, сеть
            last = f"{type(e).__name__}: {e}"
        time.sleep(4 * (attempt + 1))
    raise RuntimeError(last)

def main():
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    o = sub.add_parser("one"); o.add_argument("prompt"); o.add_argument("--out", required=True)
    o.add_argument("--model", default="gpt-image-2"); o.add_argument("--size", default="1536x1024")
    b = sub.add_parser("batch"); b.add_argument("tasks"); b.add_argument("--outdir", default="site/img/photo")
    b.add_argument("--model", default="gpt-image-2"); b.add_argument("--skip-existing", action="store_true")
    a = ap.parse_args()

    if a.cmd == "one":
        print(gen(a.prompt, a.out, a.model, a.size))
        return

    tasks = json.load(open(a.tasks, encoding="utf-8"))
    ok = fail = skip = 0
    for t in tasks:
        out = os.path.join(a.outdir, t["name"] + ".png")
        if a.skip_existing and os.path.exists(out) and os.path.getsize(out) > 5000:
            skip += 1; print("skip", t["name"]); continue
        try:
            gen(t["prompt"], out, t.get("model", a.model), t.get("size", "1536x1024"))
            ok += 1; print("ok  ", t["name"], os.path.getsize(out) // 1024, "КБ", flush=True)
        except Exception as e:
            fail += 1; print("FAIL", t["name"], e, flush=True)
    print(f"\nготово: {ok} новых, {skip} пропущено, {fail} ошибок")

if __name__ == "__main__":
    main()
