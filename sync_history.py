#!/usr/bin/env python3
"""双彩研究工作台 · 无密钥静态数据更新器。

数据镜像与官方独立验证严格区分；失败不伪造数据。需要 Python 3.11+，仅使用标准库。
Usage: python sync_history.py
"""
from __future__ import annotations
import datetime as dt
import json
import os
import pathlib
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

BASE = pathlib.Path(__file__).resolve().parent
DEST = BASE / 'history.json'
MIRRORS = [
    'https://raw.githubusercontent.com/yangxb919/lottery-data/main/data/{game}.json',
    'https://cdn.jsdelivr.net/gh/yangxb919/lottery-data@main/data/{game}.json',
]
GAME = {'ssq': (33, 16, 6, 1), 'dlt': (35, 12, 5, 2)}

def get_json(url: str, timeout=30):
    request = urllib.request.Request(url, headers={
        'User-Agent': 'LotteryResearchLab/12 (+static-data-integrity-check)',
        'Accept': 'application/json', 'Referer': 'https://www.lottery.gov.cn/'
    })
    with urllib.request.urlopen(request, timeout=timeout) as res:
        if res.status != 200:
            raise ValueError('HTTP ' + str(res.status))
        payload = res.read(6_000_001)
        if len(payload) > 6_000_000:
            raise ValueError('文件超过6MB')
        return json.loads(payload)

def issue_canonical(issue, date):
    value = str(issue).strip()
    if not re.fullmatch(r'\d{5}|\d{7}', value):
        raise ValueError('issue invalid')
    value = '20' + value if len(value) == 5 else value
    if int(value[:4]) != int(date[:4]) or not 1 <= int(value[4:]) <= 366:
        raise ValueError('issue/date mismatch')
    return value

def balls(data, length, maximum):
    if isinstance(data, str):
        data = re.findall(r'\d+', data)
    if not isinstance(data, list):
        raise ValueError('balls not array')
    a = sorted(int(x) for x in data)
    if len(a) != length or len(set(a)) != length or min(a) < 1 or max(a) > maximum:
        raise ValueError('balls invalid')
    return a

def norm(obj, game, source):
    d = str(obj.get('date') or obj.get('lotteryDrawTime') or '')[:10]
    dd = dt.date.fromisoformat(d)
    if dd > dt.date.today() + dt.timedelta(days=1):
        raise ValueError('future date')
    a, b, c, e = GAME[game]
    main = balls(obj.get('main', obj.get('red' if game == 'ssq' else 'front')), c, a)
    extra = balls(obj.get('extra', obj.get('blue' if game == 'ssq' else 'back')), e, b)
    return {'issue': issue_canonical(obj.get('issue') or obj.get('lotteryDrawNum'), d),
            'date': d, 'main': main, 'extra': extra,
            'verification': 'single-source', 'sources': [source]}

def fetch_mirror(game):
    errors = []
    for template in MIRRORS:
        try:
            raw = get_json(template.format(game=game))
            if not isinstance(raw, list) or len(raw) < 20:
                raise ValueError('not enough rows')
            return raw
        except Exception as exc:
            errors.append(str(exc)[:160])
    raise RuntimeError('两条镜像线路均失败（同一底层数据源）：' + ' / '.join(errors))

def official_ssq():
    # 中国福利彩票管理中心公开开奖 JSON；接口变动/禁止访问时不得声称核验成功。
    base = 'https://www.cwl.gov.cn/cwl_admin/front/cwlkj/search/kjxx/findDrawNotice'
    args = {'name': 'ssq', 'issueCount': '50', 'issueStart': '', 'issueEnd': '',
            'dayStart': '', 'dayEnd': '', 'pageNo': '1', 'pageSize': '50',
            'week': '', 'systemType': 'PC'}
    x = get_json(base + '?' + urllib.parse.urlencode(args), timeout=18)
    if not isinstance(x, dict) or not isinstance(x.get('result'), list):
        raise ValueError('官方双色球结构变化')
    out = {}
    for item in x['result']:
        try:
            row = norm({'issue': item.get('code'), 'date': item.get('date'),
                        'main': item.get('red'), 'extra': item.get('blue')}, 'ssq', 'www.cwl.gov.cn')
            out[row['issue']] = row
        except (TypeError, ValueError):
            pass
    if len(out) < 5:
        raise ValueError('官方双色球有效记录不足')
    return out

def official_dlt():
    # 中国体育彩票公开的大乐透历史 API；失败时仅标记单源，绝不冒充官方交叉验证。
    base = 'https://webapi.sporttery.cn/gateway/lottery/getHistoryPageListV1.qry'
    args = {'gameNo': '85', 'provinceId': '0', 'pageSize': '50', 'isVerify': '1', 'pageNo': '1'}
    x = get_json(base + '?' + urllib.parse.urlencode(args), timeout=18)
    data = x.get('value') if isinstance(x, dict) else None
    raw = data.get('list') if isinstance(data, dict) else None
    if not isinstance(raw, list):
        raise ValueError('官方大乐透结构变化')
    out = {}
    for item in raw:
        try:
            numbers = [int(n) for n in re.findall(r'\d+', item['lotteryDrawResult'])]
            if len(numbers) != 7:
                continue
            row = norm({'issue': item['lotteryDrawNum'], 'date': item['lotteryDrawTime'][:10],
                        'main': numbers[:5], 'extra': numbers[5:]}, 'dlt', 'webapi.sporttery.cn')
            out[row['issue']] = row
        except (KeyError, TypeError, ValueError):
            pass
    if len(out) < 5:
        raise ValueError('官方大乐透有效记录不足')
    return out

def equal(a, b):
    return all(a[k] == b[k] for k in ('issue', 'date', 'main', 'extra'))

def load_previous():
    if DEST.exists():
        try:
            data = json.loads(DEST.read_text('utf-8'))
            return data if isinstance(data, dict) else {}
        except Exception:
            pass
    return {}

def run():
    previous = load_previous()
    output = {'schema': 'lottery-static-v12', 'generatedAt': dt.datetime.now(dt.timezone.utc).isoformat(),
              'ssq': [], 'dlt': [], 'provenance': {}, 'quarantine': []}
    succeeded = 0
    for game in GAME:
        try:
            mirror_error = ''
            try:
                source_rows = fetch_mirror(game)
            except Exception as exc:
                source_rows = []
                mirror_error = str(exc)[:200]
                print(game + ' 第三方历史库暂不可用：' + mirror_error)
            mirror = {}
            for item in source_rows:
                try:
                    row = norm(item, game, 'yangxb919/lottery-data (来源声明500.com)')
                    old = mirror.get(row['issue'])
                    if old and not equal(old, row):
                        output['quarantine'].append({'game': game, 'issue': row['issue'], 'reason': '镜像内部冲突'})
                        mirror.pop(row['issue'], None)
                    else:
                        mirror[row['issue']] = row
                except (ValueError, TypeError, KeyError):
                    pass
            official, reason = {}, ''
            try:
                official = official_ssq() if game == 'ssq' else official_dlt()
            except Exception as exc:
                reason = str(exc)[:200]
                print(game + ' 官方独立核验暂不可用：' + reason)
            checked, conflicts, official_only = 0, 0, 0
            # Do not implicitly trust pre-existing repository records: validate them again.
            old_rows = {}
            for old in previous.get(game, []):
                try:
                    row = norm(old, game, '仓库既有快照')
                    row['verification'] = old.get('verification') if old.get('verification') in ('cross-checked','single-source','official-only','manual-import') else 'single-source'
                    row['sources'] = [str(v)[:120] for v in old.get('sources', [])[:5] if isinstance(v, str)] or ['仓库既有快照']
                    old_rows[row['issue']] = row
                except (TypeError, ValueError, KeyError, AttributeError):
                    continue
            if len(mirror) < 20 and not official and len(old_rows) < 20:
                raise RuntimeError('没有足够可用数据，不能生成研究快照')
            for issue, row in list(mirror.items()):
                cross = official.get(issue)
                if cross:
                    if equal(row, cross):
                        row['verification'] = 'cross-checked'
                        row['sources'].append('www.cwl.gov.cn' if game == 'ssq' else 'webapi.sporttery.cn')
                        checked += 1
                    else:
                        conflicts += 1
                        output['quarantine'].append({'game': game, 'issue': issue, 'reason': '官方与镜像不一致'})
                        # 不将冲突记录作为最新数据；若旧版有该期，只留原本可用的旧记录。
                        if issue in old_rows:
                            mirror[issue] = old_rows[issue]
                        else:
                            del mirror[issue]
            # Official results missing from the third-party historical mirror may be used as
            # official-only evidence. They are NOT 'cross-checked' until mirror independently agrees.
            for issue, row in official.items():
                if issue in mirror or any(x['game'] == game and x['issue'] == issue for x in output['quarantine']):
                    continue
                if issue in old_rows and not equal(old_rows[issue], row):
                    conflicts += 1
                    output['quarantine'].append({'game': game, 'issue': issue, 'reason': '官方新记录与旧快照冲突，等待人工核对'})
                    mirror[issue] = old_rows[issue]  # preserve last known record, but quarantine the discrepancy
                    continue
                mirror[issue] = dict(row, verification='official-only', sources=['www.cwl.gov.cn' if game == 'ssq' else 'webapi.sporttery.cn'])
                official_only += 1
            for issue, old in old_rows.items():
                if issue not in mirror and not any(x['game'] == game and x['issue'] == issue for x in output['quarantine']):
                    mirror[issue] = old
                elif issue in mirror and not equal(mirror[issue], old):
                    conflicts += 1
                    output['quarantine'].append({'game': game, 'issue': issue, 'reason': '新旧快照不一致，保留旧版'})
                    mirror[issue] = old
                elif issue in mirror and old.get('verification') == 'cross-checked':
                    mirror[issue]['verification'] = 'cross-checked'
                    mirror[issue]['sources'] = sorted(set(mirror[issue]['sources'] + old.get('sources', [])))
            output[game] = sorted(mirror.values(), key=lambda x: x['issue'], reverse=True)
            output['provenance'][game] = {
                'status': f'双源核验{checked}期；官方单源补入{official_only}期；其余单源' if checked else f'尚无交叉核验；官方单源补入{official_only}期；其余单源',
                'officialRows': len(official), 'checked': checked, 'conflicts': conflicts,
                'mirrorSource': 'yangxb919/lottery-data', 'mirrorError': mirror_error, 'officialError': reason,
                'latestIssue': output[game][0]['issue'], 'rows': len(output[game])}
            print(game, '记录', len(output[game]), '核验', checked, '冲突', conflicts)
            succeeded += 1
        except Exception as exc:
            print(game, '同步失败：', exc, file=sys.stderr)
            output[game] = previous.get(game, [])
            output['provenance'][game] = previous.get('provenance', {}).get(game, {'status': '同步失败，沿用本地旧数据'})
    if not succeeded:
        raise RuntimeError('两个彩种均无法更新；保留仓库已有快照')
    DEST.parent.mkdir(parents=True, exist_ok=True)
    tmp = DEST.with_suffix('.json.tmp')
    tmp.write_text(json.dumps(output, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')
    tmp.replace(DEST)

if __name__ == '__main__':
    run()
