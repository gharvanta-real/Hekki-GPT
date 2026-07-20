"""MARIANO — Entry point. Boots all systems."""
from __future__ import annotations

import argparse
import asyncio
import sys
from pathlib import Path

# Ensure project root on path
sys.path.insert(0, str(Path(__file__).parent))

import structlog
from dotenv import load_dotenv

load_dotenv()

log = structlog.get_logger()


async def boot(mode: str) -> None:
    """Boot MARIANO: initialize all systems, then launch TUI or Telegram."""
    from mariano.config import get_settings
    from mariano.gemini.client import GeminiClient
    from mariano.skills._registry.registry import SkillRegistry
    from mariano.skills._registry.discovery import SkillDiscovery
    from mariano.memory.memory_manager import MemoryManager
    from mariano.core.agent import MarianoAgent
    import structlog.stdlib

    # Configure logging
    structlog.configure(
        processors=[
            structlog.stdlib.add_log_level,
            structlog.stdlib.add_logger_name,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.JSONRenderer(),
        ],
        logger_factory=structlog.stdlib.LoggerFactory(),
    )

    settings = get_settings()
    settings.mariano_data_dir.mkdir(parents=True, exist_ok=True)
    settings.logs_dir.mkdir(parents=True, exist_ok=True)
    settings.evolved_skills_dir.mkdir(parents=True, exist_ok=True)

    log.info("mariano.boot", version="1.0.0", model=settings.mariano_model, mode=mode)

    # Memory
    memory = MemoryManager.get_instance()
    await memory.initialize()
    log.info("memory.ready")

    # Skills
    registry = SkillRegistry.get_instance()
    discovery = SkillDiscovery(registry, settings.evolved_skills_dir)
    result = await discovery.discover_all()
    log.info("skills.ready", loaded=len(result["loaded"]), failed=len(result["failed"]))

    # Gemini
    gemini = GeminiClient()
    log.info("gemini.ready", model=settings.mariano_model)

    # Agent
    agent = MarianoAgent(gemini=gemini, registry=registry, memory=memory)
    log.info("agent.ready")

    # Start Sentinel Observer Daemon
    from mariano.core.sentinel import SentinelObserver
    SentinelObserver.get_instance().start()

    if mode == "telegram":
        from mariano.tui.telegram_gateway import TelegramGateway
        gateway = TelegramGateway(agent=agent)
        await gateway.start()
    else:
        from mariano.tui.app import MarianoApp
        app = MarianoApp(agent=agent)
        await app.run_async()


def main() -> None:
    parser = argparse.ArgumentParser(description="MARIANO Autonomous AI Agent")
    parser.add_argument(
        "--mode",
        choices=["tui", "telegram"],
        default="tui",
        help="Run mode: tui (terminal UI) or telegram (Telegram bot gateway)",
    )
    args = parser.parse_args()

    try:
        asyncio.run(boot(args.mode))
    except KeyboardInterrupt:
        print("\nMARIANO offline.")


if __name__ == "__main__":
    main()
