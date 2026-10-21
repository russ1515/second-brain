"""Safe deterministic V2 signal errors; no transcript, recording or path logs."""


class V2EvidenceError(Exception):
    def __init__(self, code):
        super().__init__(code)
        self.code = code
