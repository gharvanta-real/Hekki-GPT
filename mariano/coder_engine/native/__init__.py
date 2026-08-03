"""
Hekki Native Autonomous Coding Engine
In-process ReAct loop, 2-phase AST diffing, pre-flight linter, and 7 native tools.
"""

from mariano.coder_engine.native.agent_loop import run_native_agent_loop as run_native_coder_stream

__all__ = ["run_native_coder_stream"]
