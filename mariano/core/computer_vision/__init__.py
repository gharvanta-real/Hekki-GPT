"""mariano.core.computer_vision
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
High-Performance, Scalable Computer Control & Vision Grounding System.
Provides screen capture, smooth cursor glide, keyboard typing,
native Windows accessibility tree navigation, and vision grounding.
"""

from .screen_capture import ScreenCaptureManager
from .cursor_engine import CursorMotionEngine
from .keyboard_engine import KeyboardAutomationEngine
from .ui_tree_grounding import UITreeGroundingEngine
from .vision_grounding import VisionGroundingEngine
from .action_executor import ComputerVisionController, ActionExecutionResult

__all__ = [
    "ScreenCaptureManager",
    "CursorMotionEngine",
    "KeyboardAutomationEngine",
    "UITreeGroundingEngine",
    "VisionGroundingEngine",
    "ComputerVisionController",
    "ActionExecutionResult",
]
