#!/usr/bin/env python3
"""Idempotently add the V18.3 audit entry to the existing V18 landing page.

Only modifies index.html and styles.css; never touches history or user records.
Fails closed if the expected V18 navigation anchor is absent.
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parent
ANCHOR = '<button data-page="review">复盘诊断 V18</button>'
MARKER = '<!-- v183-evidence-entry -->'
ENTRY = MARKER + '<a class="nav-link-v183" href="./audit-v183.html?v=18.3">V18.3 实盘核奖</a>'
STYLE_MARKER = '/* V18.3 audit link; original navigation preserved. */'
STYLE = '\n' + STYLE_MARKER + '\n.nav a.nav-link-v183{display:inline-flex;align-items:center;flex:0 0 auto;white-space:nowrap;padding:9px 12px;border:1px solid #3c82aa;border-radius:8px;background:#183c57;color:#d9f0ff;text-decoration:none;font-weight:700;font-size:12px}\n'


def apply(root: Path = ROOT):
    index_path = root / 'index.html'
    css_path = root / 'styles.css'
    html = index_path.read_text(encoding='utf-8')
    css = css_path.read_text(encoding='utf-8')
    if MARKER not in html:
        if html.count(ANCHOR) != 1:
            raise ValueError('Cannot find unique V18 navigation anchor; original index.html remains unchanged')
        html = html.replace(ANCHOR, ANCHOR + ENTRY, 1)

    # V18.3 UI layer is installed around the unmodified V18.0 forecasting core.
    # These substitutions are idempotent and do not touch any stored records.
    replacements = (
        ('<title>双彩研究工作台 V18.0 · 选号决策中心</title>',
         '<title>双彩研究工作台 V18.3 · 选号决策与实盘核奖</title>'),
        ('<h1>双彩研究工作台 <span>V18.0</span></h1>',
         '<h1>双彩研究工作台 <span>V18.3</span></h1>'),
        ('V18 新增“下一期选号决策中心”',
         'V18.3 已接入实盘核奖复盘；核心选号沿用 V18.0，保留“下一期选号决策中心”'),
        ('双彩研究工作台 V18.0 · 下一期30期数据决策',
         '双彩研究工作台 V18.3 · 核心选号 V18.0 · 下一期30期数据决策'),
        ('href="styles.css?v=18.0"', 'href="styles.css?v=18.3"'),
    )
    for before, after in replacements:
        if before in html:
            html = html.replace(before, after)
    if STYLE_MARKER not in css:
        css += STYLE
    index_path.write_text(html, encoding='utf-8')
    css_path.write_text(css, encoding='utf-8')
    return True


if __name__ == '__main__':
    apply()
    print('V18.3: navigation link installed without touching existing app or historical records')
