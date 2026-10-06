import os
from pathlib import Path


_ENV_PATH = Path(__file__).resolve().parents[2] / ".env"


def _load_env_file(path: Path = _ENV_PATH) -> None:
    """Load root .env values without overriding variables already set by the OS."""
    if not path.exists():
        return

    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue

        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip()

        if not key:
            continue

        if len(value) >= 2 and value[0] == value[-1] and value[0] in {"'", '"'}:
            value = value[1:-1]

        os.environ.setdefault(key, value)


def require_env(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise RuntimeError(
            f"Required environment variable {name} is not configured. "
            f"Set it in the process environment or {_ENV_PATH}."
        )
    return value


_load_env_file()
