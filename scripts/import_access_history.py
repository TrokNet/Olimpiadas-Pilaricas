"""Recover successful HTML accesses from a private journalctl JSONL export.

No raw log, IP address or request URL is copied into the database. Idempotent.
Historical accesses cannot establish unique people or modern browser sessions.
"""
import argparse
import hashlib
import json
import re
from pathlib import Path
from sqlalchemy.orm import Session
from backend.database import HistoricalAccess, Metadata, engine_for, initialize
from backend.analytics import lima_day

HTML_ACCESS = re.compile(r'"GET /(?:\?[^\s"]*)? HTTP/[\d.]+" 200(?:\s|$)')

def import_history(engine, path):
    recovered = 0
    earliest = None
    with Session(engine) as s, s.begin():
        started = s.get(Metadata, 'analytics_started_at')
        cutoff = int(started.value) if started else None
        for line in Path(path).read_text(encoding='utf-8').splitlines():
            try:
                entry = json.loads(line)
                stamp = int(entry['__REALTIME_TIMESTAMP']) // 1_000_000
                message = entry['MESSAGE']
            except (ValueError, KeyError, TypeError):
                continue
            if ' HTTP/' not in message or (cutoff is not None and stamp >= cutoff):
                continue
            earliest = stamp if earliest is None else min(earliest, stamp)
            if not HTML_ACCESS.search(message):
                continue
            fingerprint = hashlib.sha256((str(entry['__REALTIME_TIMESTAMP'])+'|'+message).encode()).hexdigest()
            if not s.get(HistoricalAccess, fingerprint):
                s.add(HistoricalAccess(id=fingerprint, day=lima_day(stamp), timestamp=stamp))
                recovered += 1
        if earliest is not None:
            previous = s.get(Metadata, 'analytics_journal_coverage')
            coverage = min(previous.value, lima_day(earliest)) if previous else lima_day(earliest)
            s.merge(Metadata(key='analytics_journal_coverage', value=coverage))
    return recovered

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('journal')
    args = parser.parse_args()
    engine = engine_for()
    initialize(engine)
    print(json.dumps({'recovered_html_accesses': import_history(engine, args.journal)}))
