import os
import pty
import select
import termios
import struct
import fcntl
import asyncio
import signal
from typing import Dict, Optional, Callable

class PtySession:
    def __init__(self, session_id: str, shell: str = "/bin/bash", rows: int = 24, cols: int = 80):
        self.session_id = session_id
        self.shell = shell
        self.rows = rows
        self.cols = cols
        self.master_fd: Optional[int] = None
        self.pid: Optional[int] = None
        self.active = False
        self._spawn()

    def _spawn(self):
        master_fd, slave_fd = pty.openpty()
        self.master_fd = master_fd
        
        # Set initial terminal size
        self.resize(self.rows, self.cols)

        env = os.environ.copy()
        env["TERM"] = "xterm-256color"
        env["COLORTERM"] = "truecolor"

        pid = os.fork()
        if pid == 0:
            # Child process
            os.close(master_fd)
            os.setsid()
            fcntl.ioctl(slave_fd, termios.TIOCSCTTY, 0)
            os.dup2(slave_fd, 0)
            os.dup2(slave_fd, 1)
            os.dup2(slave_fd, 2)
            if slave_fd > 2:
                os.close(slave_fd)
            
            # Execute shell
            shell_bin = self.shell if os.path.exists(self.shell) else "/bin/sh"
            os.execvpe(shell_bin, [shell_bin, "-l"], env)
        else:
            # Parent process
            os.close(slave_fd)
            self.pid = pid
            self.active = True
            
            # Set non-blocking mode on master_fd
            fl = fcntl.fcntl(self.master_fd, fcntl.F_GETFL)
            fcntl.fcntl(self.master_fd, fcntl.F_SETFL, fl | os.O_NONBLOCK)

    def write(self, data: str | bytes):
        if not self.active or self.master_fd is None:
            return
        if isinstance(data, str):
            data = data.encode("utf-8")
        try:
            os.write(self.master_fd, data)
        except (OSError, BrokenPipeError):
            self.close()

    def resize(self, rows: int, cols: int):
        self.rows = max(1, rows)
        self.cols = max(1, cols)
        if self.master_fd is not None:
            try:
                winsize = struct.pack("HHHH", self.rows, self.cols, 0, 0)
                fcntl.ioctl(self.master_fd, termios.TIOCSWINSZ, winsize)
            except OSError:
                pass

    def read(self, max_bytes: int = 4096) -> bytes:
        if not self.active or self.master_fd is None:
            return b""
        try:
            r, _, _ = select.select([self.master_fd], [], [], 0.01)
            if r:
                return os.read(self.master_fd, max_bytes)
            return b""
        except (OSError, BrokenPipeError):
            self.close()
            return b""

    def close(self):
        if not self.active:
            return
        self.active = False
        if self.master_fd is not None:
            try:
                os.close(self.master_fd)
            except OSError:
                pass
            self.master_fd = None
        if self.pid is not None:
            try:
                os.kill(self.pid, signal.SIGHUP)
                os.kill(self.pid, signal.SIGTERM)
                os.waitpid(self.pid, os.WNOHANG)
            except (OSError, ProcessLookupError):
                pass
            self.pid = None

class PtyManager:
    def __init__(self):
        self.sessions: Dict[str, PtySession] = {}

    def get_or_create(self, session_id: str, rows: int = 24, cols: int = 80) -> PtySession:
        if session_id in self.sessions and self.sessions[session_id].active:
            return self.sessions[session_id]
        
        session = PtySession(session_id=session_id, rows=rows, cols=cols)
        self.sessions[session_id] = session
        return session

    def remove(self, session_id: str):
        if session_id in self.sessions:
            self.sessions[session_id].close()
            del self.sessions[session_id]

    def list_sessions(self):
        return [
            {"id": sid, "active": sess.active, "rows": sess.rows, "cols": sess.cols}
            for sid, sess in self.sessions.items()
        ]

pty_manager = PtyManager()
