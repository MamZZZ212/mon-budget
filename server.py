"""Serveur local de Mon Budget : sert l'appli et relaie le chat vers Claude.

Moteur du chat, choisi automatiquement :
  1. API Anthropic   si ANTHROPIC_API_KEY est défini (variable d'environnement ou fichier .env ici)
                     et que le paquet `anthropic` est installé (pip install anthropic) ;
  2. Claude Code CLI si `claude` est installé et connecté (claude auth login) — utilise ton abonnement.
Écoute uniquement sur 127.0.0.1 : rien n'est exposé sur le réseau.
"""
import functools
import http.server
import json
import os
import shutil
import subprocess
import tempfile
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent
PORT = int(os.environ.get("BUDGET_PORT", "5178"))
API_MODEL = os.environ.get("BUDGET_CHAT_MODEL", "claude-opus-5-5")
CLI_MODEL = os.environ.get("BUDGET_CLI_MODEL", "opus")
CLI_TIMEOUT = 240
_status_cache = {"at": 0, "value": None}


def load_dotenv():
    env_file = ROOT / ".env"
    if not env_file.exists():
        return
    for line in env_file.read_text(encoding="utf-8").splitlines():
        if "=" in line and not line.strip().startswith("#"):
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip().strip('"'))


def api_available():
    if not os.environ.get("ANTHROPIC_API_KEY"):
        return False
    try:
        import anthropic  # noqa: F401
        return True
    except ImportError:
        return False


def cli_logged_in(claude):
    try:
        out = subprocess.run([claude, "auth", "status"], capture_output=True, text=True, timeout=20, encoding="utf-8")
        return json.loads(out.stdout or "{}").get("loggedIn", False)
    except (subprocess.SubprocessError, json.JSONDecodeError, OSError):
        return False


def engine_status():
    """Moteur disponible, mis en cache 30 s (la vérification du CLI prend ~1 s)."""
    if time.time() - _status_cache["at"] < 30 and _status_cache["value"]:
        return _status_cache["value"]
    if api_available():
        value = {"mode": "api", "label": f"API Anthropic ({API_MODEL})"}
    elif (claude := shutil.which("claude")) and cli_logged_in(claude):
        value = {"mode": "cli", "label": "Claude Code (ton abonnement)"}
    elif shutil.which("claude"):
        value = {"mode": "none", "label": "Claude Code installé mais non connecté", "help": "Ouvre un terminal et lance : claude auth login — puis recharge la page."}
    else:
        value = {"mode": "none", "label": "Aucun moteur de chat", "help": "Installe Claude Code et lance « claude auth login », ou crée un fichier .env avec ANTHROPIC_API_KEY=… et lance « pip install anthropic »."}
    _status_cache.update(at=time.time(), value=value)
    return value


def chat_via_api(system, messages):
    import anthropic
    client = anthropic.Anthropic()
    try:
        response = client.beta.messages.create(
            model=API_MODEL,
            max_tokens=16000,
            betas=["server-side-fallback-2026-07-01"],
            fallbacks="default",
            output_config={"effort": "low"},
            system=system,
            messages=messages,
        )
    except anthropic.AuthenticationError:
        raise RuntimeError("Clé API invalide (ANTHROPIC_API_KEY).")
    except anthropic.RateLimitError:
        raise RuntimeError("Trop de requêtes : réessaie dans une minute.")
    except anthropic.APIStatusError as e:
        raise RuntimeError(f"Erreur de l'API ({e.status_code}) : {e.message}")
    except anthropic.APIConnectionError:
        raise RuntimeError("Impossible de joindre l'API Anthropic : vérifie ta connexion.")
    if response.stop_reason == "refusal":
        raise RuntimeError("Claude a décliné cette demande.")
    return "".join(block.text for block in response.content if block.type == "text")


def transcript(messages):
    """Le CLI reçoit un seul prompt : on y replie l'historique de la conversation."""
    *history, last = messages
    lines = [f"[{'Moi' if m['role'] == 'user' else 'Assistant'}] {m['content']}" for m in history]
    past = "Historique de la conversation :\n" + "\n\n".join(lines) + "\n\n" if lines else ""
    return f"{past}Nouveau message :\n{last['content']}"


def chat_via_cli(system, messages):
    claude = shutil.which("claude")
    with tempfile.TemporaryDirectory(prefix="budget-chat-") as tmp:
        prompt_file = Path(tmp) / "system.txt"
        prompt_file.write_text(system, encoding="utf-8")
        cmd = [claude, "-p", "--output-format", "json", "--no-session-persistence", "--tools", "",
               "--setting-sources", "", "--strict-mcp-config", "--model", CLI_MODEL, "--effort", "low",
               "--system-prompt-file", str(prompt_file)]
        try:
            out = subprocess.run(cmd, input=transcript(messages), capture_output=True, text=True,
                                 encoding="utf-8", timeout=CLI_TIMEOUT, cwd=tmp)
        except subprocess.TimeoutExpired:
            raise RuntimeError("Claude Code met trop de temps à répondre.")
    try:
        data = json.loads(out.stdout)
    except json.JSONDecodeError:
        raise RuntimeError(f"Réponse illisible de Claude Code : {(out.stderr or out.stdout)[:300]}")
    if data.get("is_error"):
        raise RuntimeError(f"Claude Code : {data.get('result') or data.get('terminal_reason')}")
    return data.get("result", "")


class Handler(http.server.SimpleHTTPRequestHandler):
    def send_json(self, code, payload):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_GET(self):
        if self.path == "/api/chat/status":
            return self.send_json(200, engine_status())
        if self.path.startswith("/.env") or self.path.endswith(".py"):
            return self.send_error(404)
        return super().do_GET()

    def do_POST(self):
        if self.path != "/api/chat":
            return self.send_error(404)
        try:
            payload = json.loads(self.rfile.read(int(self.headers.get("Content-Length", 0))) or b"{}")
            system, messages = payload["system"], payload["messages"]
            if not messages or messages[-1]["role"] != "user":
                raise ValueError("Le dernier message doit venir de l'utilisateur.")
        except (ValueError, KeyError, TypeError) as e:
            return self.send_json(400, {"error": f"Requête invalide : {e}"})
        status = engine_status()
        try:
            if status["mode"] == "api":
                reply = chat_via_api(system, messages)
            elif status["mode"] == "cli":
                reply = chat_via_cli(system, messages)
            else:
                return self.send_json(503, {"error": status["label"], "help": status.get("help")})
        except RuntimeError as e:
            return self.send_json(502, {"error": str(e)})
        return self.send_json(200, {"reply": reply, "engine": status["label"]})

    def log_message(self, fmt, *args):
        if "/api/" in str(args[0] if args else ""):
            super().log_message(fmt, *args)


if __name__ == "__main__":
    load_dotenv()
    handler = functools.partial(Handler, directory=str(ROOT))
    # Sous Windows, la réutilisation d'adresse laisserait deux serveurs sur le même port :
    # une seconde instance (démarrage automatique + lanceur) doit échouer et s'arrêter.
    http.server.ThreadingHTTPServer.allow_reuse_address = False
    try:
        server = http.server.ThreadingHTTPServer(("127.0.0.1", PORT), handler)
    except OSError:
        raise SystemExit(f"Le port {PORT} est déjà utilisé : Mon Budget tourne sans doute déjà.")
    print(f"Mon Budget : http://localhost:{PORT}  —  chat : {engine_status()['label']}")
    server.serve_forever()
