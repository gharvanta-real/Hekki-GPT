"""
Hekki Coder Engine — IPC Bridge

Provides memory-mapped file operations (mmap wrapper) for zero-copy IPC
communication between the Hekki core and execution sandboxes,
ensuring high performance on local laptops without cloud databases.
"""
from __future__ import annotations
import mmap
import os
from pathlib import Path
from typing import Optional
import structlog

log = structlog.get_logger(__name__)

class MemoryMappedBridge:
    """
    Wraps standard Python mmap to map files directly into memory space,
    avoiding duplicate disk read/write cycles during validation passes.
    """
    def __init__(self, file_path: str, size_bytes: int = 4096) -> None:
        self.file_path = Path(file_path).resolve()
        self.size = size_bytes
        self.mmap_obj: Optional[mmap.mmap] = None
        self._file_handle = None
        self._init_mmap()

    def _init_mmap(self) -> None:
        """Opens or creates the file, structures its size, and maps it."""
        try:
            if not self.file_path.exists():
                self.file_path.parent.mkdir(parents=True, exist_ok=True)
                with open(self.file_path, "wb") as f:
                    # Write zeroes to pre-allocate size
                    f.write(b"\x00" * self.size)

            # Open file descriptor for read/write sharing
            self._file_handle = open(self.file_path, "r+b")
            self.mmap_obj = mmap.mmap(self._file_handle.fileno(), self.size, access=mmap.ACCESS_WRITE)
            log.info("ipc.mmap_initialized", file_path=str(self.file_path), size=self.size)
        except Exception as e:
            log.error("ipc.mmap_failed", error=str(e))
            self.close()

    def write_payload(self, data: bytes) -> bool:
        """Writes bytes into the shared memory segment."""
        if not self.mmap_obj:
            return False
        try:
            if len(data) > self.size:
                log.error("ipc.payload_overflow", payload_size=len(data), mmap_size=self.size)
                return False
                
            self.mmap_obj.seek(0)
            self.mmap_obj.write(data)
            # Pad remaining space with zero bytes
            remaining = self.size - len(data)
            if remaining > 0:
                self.mmap_obj.write(b"\x00" * remaining)
            self.mmap_obj.flush()
            log.debug("ipc.write_success", bytes_written=len(data))
            return True
        except Exception as e:
            log.error("ipc.write_failed", error=str(e))
            return False

    def read_payload(self) -> bytes:
        """Reads bytes from the memory-mapped segment, stripping trailing zero bytes."""
        if not self.mmap_obj:
            return b""
        try:
            self.mmap_obj.seek(0)
            data = self.mmap_obj.read(self.size)
            # Remove trailing padding nulls
            return data.rstrip(b"\x00")
        except Exception as e:
            log.error("ipc.read_failed", error=str(e))
            return b""

    def close(self) -> None:
        """Safely closes file descriptors and flushes memory-mapped segment."""
        if self.mmap_obj:
            try:
                self.mmap_obj.close()
            except Exception:
                pass
            self.mmap_obj = None
            
        if self._file_handle:
            try:
                self._file_handle.close()
            except Exception:
                pass
            self._file_handle = None
        log.info("ipc.mmap_closed")
