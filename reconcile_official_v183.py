#!/usr/bin/env python3
"""V18.3 Shanghai Welfare Lottery official fallback (best effort).

Runs AFTER sync_history.py and BEFORE automation_research.mjs.
Does not fabricate draws, overwrite conflicting historical records or silently
mark an official-only result as independently cross-checked.

No credentials or third-party dependencies. HTTP failures leave data intact.
"""
from __future__ import annotations

from datetime import datetime, timezone
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import urllib.parse
import urllib.request

BASE = Path(__file__).resolve().parent
HISTORY = BASE / 'history.json'
OFFICIAL_URL = 'https://www.swlc.net.cn/lottery/ssq.html?limit=30&view=previous'
OFFICIAL_SOURCE = '上海市福利彩票发行中心(www.swlc.net.cn)'
MIRROR_TOKENS = ('yangxb919', '500.com')


class Rows(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.rows = []
        self.current_row = None
        self.current_cell = None
        self.cell_depth = 0

    def handle_starttag(self, tag, attrs):
        tag = tag.lower()
        if tag == 'tr':
            self.current_row = []
        elif tag == 'td' and self.current_row is not None:
            self.current_cell = []
            self.cell_depth = 1
        elif self.current_cell is not None:
            self.cell_depth += 1

    def handle_data(self, data):
        if self.current_cell is not None:
            self.current_cell.append(data)

    def handle_endtag(self, tag):
        tag = tag.lower()
        if tag == 'td' and self.current_cell is not None:
            v = re.sub(r'\s+', ' ', ''.join(self.current_cell)).strip()
            self.current_row.append(v)
            self.current_cell = None
            self.cell_depth = 0
        elif tag == 'tr' and self.current_row is not None:
            if self.current_row:
                self.rows.append(self.current_row)
            self.current_row = None
            self.current_cell = None


def parse_official_html(raw: str):
    parser = Rows()
    parser.feed(raw)
    out = {}
    for cells in parser.rows:
        if len(cells) < 4:
            continue
        issue = re.search(r'\b(20\d{5})\b', cells[0])
        date = re.search(r'\b(20\d{2}-\d{2}-\d{2})\b', cells[1])
        red = re.findall(r'\d+', cells[2])
        if len(red) == 1 and len(red[0]) == 12:
            red = [red[0][i:i + 2] for i in range(0, 12, 2)]
        elif len(red) != 6:
            # Chinese HTML may render all balls in separate spans; also allow adjacent 2-digit nums.
            combined = ''.join(red)
            if len(combined) == 12 and combined.isdigit():
                red = [combined[i:i + 2] for i in range(0, 12, 2)]
        blue = re.findall(r'\d+', cells[3])
        if not issue or not date or len(red) != 6 or not blue:
            continue
        nums = [int(x) for x in red]
        extra = [int(blue[0])]
        if not (nums == sorted(set(nums)) and all(1 <= x <= 33 for x in nums) and 1 <= extra[0] <= 16):
            continue
        try:
            day = datetime.strptime(date.group(1), '%Y-%m-%d').date()
        except ValueError:
            continue
        if day.year != int(issue.group(1)[:4]):
            continue
        row = {'issue': issue.group(1), 'date': date.group(1), 'main': nums, 'extra': extra}
        old = out.get(row['issue'])
        if old and any(old[k] != row[k] for k in ('date', 'main', 'extra')):
            # Conflicting official HTML rows cannot be assumed authoritative.
            raise ValueError('官方页面存在相同期号但开奖号码不一致')
        out[row['issue']] = row
    if len(out) < 3:
        raise ValueError('未从官方页面解析出足够有效期次（可能页面结构改变或数据动态加载）')
    return out


def fetch_official():
    headers = {
        'User-Agent': 'Mozilla/5.0 (compatible; LotteryResearchIntegrity/18.3; +https://www.swlc.net.cn/)',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'zh-CN,zh;q=0.9',
    }
    req = urllib.request.Request(OFFICIAL_URL, headers=headers)
    with urllib.request.urlopen(req, timeout=18) as response:
        netloc = urllib.parse.urlsplit(response.geturl()).hostname
        if netloc not in ('www.swlc.net.cn', 'swlc.net.cn'):
            raise ValueError('官方域名发生不可信重定向')
        raw = response.read(2_000_001)
    if len(raw) > 2_000_000:
        raise ValueError('官方页面长度超过安全阈值')
    return parse_official_html(raw.decode('utf-8', errors='replace'))


def match(a, b):
    return all(a.get(k) == b.get(k) for k in ('issue', 'date', 'main', 'extra'))


def reconcile(history, official):
    """Pure reconciliation. Returns (mutated_history, counters, changed)."""
    if history.get('schema') != 'lottery-static-v12' or not isinstance(history.get('ssq'), list):
        raise ValueError('历史数据结构异常，不作更改')
    rows = history['ssq']
    by_issue = {str(r.get('issue')): r for r in rows if isinstance(r, dict)}
    quarantine = history.setdefault('quarantine', [])
    checked = inserted = conflict = 0
    changed = False
    for issue, source in official.items():
        previous = by_issue.get(issue)
        if previous:
            if not match(previous, source):
                conflict += 1
                info = {'game': 'ssq', 'issue': issue, 'reason': '上海福彩官网与仓库历史记录不一致（V18.3待人工复核）'}
                if info not in quarantine:
                    quarantine.append(info)
                    changed = True
                continue
            sources = [s for s in previous.get('sources', []) if isinstance(s, str)]
            independent = any(token in v for v in sources for token in MIRROR_TOKENS)
            expected = 'cross-checked' if independent else (previous.get('verification') or 'official-only')
            if previous.get('verification') == 'cross-checked':
                expected = 'cross-checked'
            if previous.get('verification') != expected:
                previous['verification'] = expected
                changed = True
            if independent:
                checked += 1
            if OFFICIAL_SOURCE not in sources:
                previous['sources'] = sources + [OFFICIAL_SOURCE]
                changed = True
        else:
            if issue in [str(q.get('issue')) for q in quarantine if isinstance(q, dict) and q.get('game') == 'ssq']:
                continue
            new = {**source, 'verification': 'official-only', 'sources': [OFFICIAL_SOURCE]}
            rows.append(new)
            by_issue[issue] = new
            inserted += 1
            changed = True
    if checked or inserted or conflict:
        p = history.setdefault('provenance', {}).setdefault('ssq', {})
        previous_counts = (p.get('officialSupplementSource'), p.get('officialSupplementChecked'),
                           p.get('officialSupplementInserted'), p.get('officialSupplementConflicts'))
        new_counts = (OFFICIAL_SOURCE, checked, int(p.get('officialSupplementInserted') or 0) + inserted, max(int(p.get('officialSupplementConflicts') or 0), conflict))
        p['officialSupplementSource'], p['officialSupplementChecked'], p['officialSupplementInserted'], p['officialSupplementConflicts'] = new_counts
        if previous_counts != new_counts:
            changed = True
        if checked or inserted:
            p['primaryOfficialError'] = p.get('officialError', '') or p.get('primaryOfficialError', '')
            p['officialError'] = ''  # Backup official source succeeded; primary problem still documented.
            p['status'] = f'备用官方核验与镜像一致{checked}期；官方单源补入{inserted}期；冲突{conflict}期'
        rows.sort(key=lambda x: str(x.get('issue', '')), reverse=True)
        p['latestIssue'] = rows[0]['issue']
        p['rows'] = len(rows)
    return history, {'checked': checked, 'officialOnlyInserted': inserted, 'conflicts': conflict}, changed


def main():
    if not HISTORY.exists():
        print('::warning::V18.3 找不到 history.json，保留原同步流程')
        return
    try:
        official = fetch_official()
        history = json.loads(HISTORY.read_text(encoding='utf-8'))
        history, stats, changed = reconcile(history, official)
        if changed:
            history['generatedAt'] = datetime.now(timezone.utc).isoformat()
            tmp = HISTORY.with_name(HISTORY.name + '.v183.tmp')
            tmp.write_text(json.dumps(history, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')
            tmp.replace(HISTORY)
        print(f'V18.3 上海福彩官方备用核验：{stats}；历史写入：{changed}')
        if stats['conflicts']:
            print('::warning::发现官方与镜像开奖不一致；旧记录已保留，需人工核对')
    except Exception as exc:
        print('::warning::V18.3 官方备用核验未成功：' + str(exc)[:240] + '；保留已有文件与单源提醒')


if __name__ == '__main__':
    main()
