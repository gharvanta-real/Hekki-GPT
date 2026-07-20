"""MARIANO — Telegram Bot Gateway for Mobile/Remote access."""
from __future__ import annotations

import asyncio
import io
import os
from pathlib import Path
import httpx
import structlog

from mariano.config import get_settings
from mariano.core.agent import MarianoAgent
from mariano.skills._registry.registry import SkillRegistry
from mariano.memory.memory_manager import MemoryManager

log = structlog.get_logger(__name__)


class TelegramGateway:
    """Gateway that exposes MARIANO via a private Telegram Bot."""

    def __init__(self, agent: MarianoAgent) -> None:
        self.agent = agent
        self.token = os.getenv("TELEGRAM_BOT_TOKEN", "")
        allowed_id = os.getenv("TELEGRAM_ALLOWED_USER_ID", "")
        self.allowed_user_id = int(allowed_id) if allowed_id.isdigit() else None
        self.api_url = f"https://api.telegram.org/bot{self.token}"
        self.offset = 0

    async def start(self) -> None:
        if not self.token:
            log.error("telegram.missing_token", error="TELEGRAM_BOT_TOKEN not found in .env")
            print("[ERROR] Please set TELEGRAM_BOT_TOKEN in your .env file.")
            return

        if not self.allowed_user_id:
            log.warning("telegram.no_restricted_id", warning="No TELEGRAM_ALLOWED_USER_ID set. Anyone can access.")
            print("[WARNING] No TELEGRAM_ALLOWED_USER_ID set. Anyone who finds your bot can use your PC!")

        print(f"🤖 MARIANO Telegram Gateway Online!")
        print(f"Waiting for messages on Telegram...")

        async with httpx.AsyncClient(timeout=30) as client:
            while True:
                try:
                    updates = await self.poll_updates(client)
                    for update in updates:
                        await self.handle_update(client, update)
                except asyncio.CancelledError:
                    break
                except Exception as exc:
                    log.error("telegram.poll_error", error=str(exc))
                    await asyncio.sleep(5)

    async def poll_updates(self, client: httpx.AsyncClient) -> list[dict]:
        url = f"{self.api_url}/getUpdates"
        resp = await client.get(url, params={"offset": self.offset, "timeout": 20})
        if resp.status_code != 200:
            return []
        data = resp.json()
        updates = data.get("result", [])
        if updates:
            self.offset = updates[-1]["update_id"] + 1
        return updates

    async def handle_update(self, client: httpx.AsyncClient, update: dict) -> None:
        message = update.get("message")
        if not message:
            return

        chat_id = message["chat"]["id"]
        user_id = message["from"]["id"]

        # Security Check
        if self.allowed_user_id and user_id != self.allowed_user_id:
            log.warning("telegram.unauthorized_access", user_id=user_id)
            await self.send_message(client, chat_id, "🔒 Access Denied. You are not authorized to use this MARIANO system.")
            return

        # Handle text message
        text = message.get("text", "")
        photo = message.get("photo")

        # Visual input (Photo)
        if photo:
            await self.send_message(client, chat_id, "⏳ Image received. Downloading and analyzing...")
            file_id = photo[-1]["file_id"]  # get largest size
            img_path = await self.download_photo(client, file_id)
            if img_path:
                caption = message.get("caption", "Describe this image in detail.")
                text = f"Analyze the image at '{img_path}'. Prompt: {caption}"
            else:
                await self.send_message(client, chat_id, "❌ Failed to download image.")
                return

        if not text:
            return

        # Show typing status
        await self.send_chat_action(client, chat_id, "typing")

        # Process via Agent
        log.info("telegram.message_received", text=text)
        response_text = ""
        current_tool = ""

        try:
            async for event in self.agent.run(text):
                if event.kind == "tool_call":
                    current_tool = event.data
                    await self.send_message(client, chat_id, f"⚡ *Using Tool:* `{current_tool}`")
                elif event.kind == "tool_result" and not event.metadata.get("success", True):
                    await self.send_message(client, chat_id, f"⚠️ *Tool Failed:* `{current_tool}`\n`{event.data[:200]}`")
                elif event.kind == "response":
                    response_text = event.data

            if response_text:
                await self.send_message(client, chat_id, response_text)
            else:
                await self.send_message(client, chat_id, "⚠️ I executed the tools but no final response was generated.")

        except Exception as exc:
            await self.send_message(client, chat_id, f"❌ Error during execution: {exc}")

    async def download_photo(self, client: httpx.AsyncClient, file_id: str) -> str | None:
        try:
            file_resp = await client.get(f"{self.api_url}/getFile", params={"file_id": file_id})
            file_path = file_resp.json()["result"]["file_path"]
            download_url = f"https://api.telegram.org/file/bot{self.token}/{file_path}"
            
            img_resp = await client.get(download_url)
            save_path = Path(get_settings().mariano_data_dir) / f"telegram_recv_{file_id[-6:]}.png"
            save_path.write_bytes(img_resp.content)
            return str(save_path)
        except Exception as exc:
            log.error("telegram.download_failed", error=str(exc))
            return None

    async def send_message(self, client: httpx.AsyncClient, chat_id: int, text: str) -> None:
        url = f"{self.api_url}/sendMessage"
        # Split message if it exceeds Telegram limits
        chunks = [text[i:i+4000] for i in range(0, len(text), 4000)]
        for chunk in chunks:
            await client.post(url, json={
                "chat_id": chat_id,
                "text": chunk,
                "parse_mode": "Markdown",
            })

    async def send_chat_action(self, client: httpx.AsyncClient, chat_id: int, action: str) -> None:
        url = f"{self.api_url}/sendChatAction"
        await client.post(url, json={"chat_id": chat_id, "action": action})
