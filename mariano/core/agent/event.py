class AgentEvent:
    """Events emitted during agent execution for streaming to TUI."""

    def __init__(self, kind: str, data: str, metadata: dict | None = None):
        self.kind = kind  # thinking | tool_call | tool_result | response | error
        self.data = data
        self.metadata = metadata or {}
