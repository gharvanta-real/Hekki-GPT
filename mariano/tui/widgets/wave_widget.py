"""MARIANO TUI — Monochrome Dot-Matrix Waveform Telemetry Widget."""
from __future__ import annotations

import math
from typing import List

from textual.widget import Widget
from textual.widgets import Static
from textual.reactive import reactive


class TelemetryWaveWidget(Static):
    """Draws real-time stippled mathematical wave patterns on a Sky Blue background."""

    DEFAULT_CSS = """
    TelemetryWaveWidget {
        background: #0284c7;
        color: #ffffff;
        height: 12;
        width: 100%;
        border-top: solid #ffffff 30%;
        border-bottom: solid #ffffff 30%;
        padding: 0;
        margin: 0;
    }
    """

    def on_mount(self) -> None:
        self._time = 0.0
        # Refresh at 20 frames per second (every 0.05 seconds) for smooth rolling waveforms
        self.set_interval(0.05, self.update_wave)

    def update_wave(self) -> None:
        self._time += 0.15
        width = self.size.width or 80
        height = self.size.height or 12

        if width < 5 or height < 3:
            return

        # Prepare character grid buffer (list of lists of spaces)
        grid = [[" " for _ in range(width)] for _ in range(height)]

        # Render 3 overlapping wave paths representing neural metrics (Dopamine, Serotonin, ACh)
        for x in range(width):
            # Phase formulas
            y1 = (height / 2) + (height / 3) * math.sin(0.08 * x + self._time)
            y2 = (height / 2) + (height / 4) * math.cos(0.12 * x - self._time * 0.7)
            y3 = (height / 2) + (height / 5) * math.sin(0.04 * x + self._time * 1.3)

            # Draw stippled points on the grid
            for idx, y_val in enumerate([y1, y2, y3]):
                y_int = int(y_val)
                if 0 <= y_int < height:
                    # Stippling characters: newer waves are lighter, older ones are dot patterns
                    char = "." if idx == 0 else ":" if idx == 1 else "*"
                    grid[y_int][x] = char

            # Draw thin white vertical grids intermittently
            if x % 10 == 0:
                for y in range(height):
                    if grid[y][x] == " ":
                        grid[y][x] = "·"

        # Join the grid into lines
        lines = ["".join(row) for row in grid]
        frame = "\n".join(lines)
        self.update(frame)
