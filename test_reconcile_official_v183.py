import copy
import unittest
from reconcile_official_v183 import parse_official_html, reconcile, OFFICIAL_SOURCE


def sample_html():
    return '<table>' + ''.join(
        '<tr><td>{}</td><td>{}(二)</td><td>{}</td><td>{}</td><td>100</td></tr>'.format(i,d,r,b)
        for i,d,r,b in [
            ('2026129','2026-11-10','030916202530','05'),
            ('2026128','2026-11-08','050610252730','11'),
            ('2026127','2026-11-05','131419252932','12')]
    ) + '</table>'


class OfficialReconciliation(unittest.TestCase):
    def setUp(self):
        self.official = parse_official_html(sample_html())
        self.root = {'schema':'lottery-static-v12','ssq':[
            {'issue':'2026129','date':'2026-11-10','main':[3,9,16,20,25,30],
             'extra':[5],'verification':'single-source','sources':['yangxb919/lottery-data']}],
            'provenance':{'ssq':{'officialError':'HTTP 403'}},'quarantine':[]}

    def test_extract_numbers(self):
        self.assertEqual(len(self.official), 3)
        self.assertEqual(self.official['2026129']['main'],[3,9,16,20,25,30])
        self.assertEqual(self.official['2026129']['extra'],[5])

    def test_cross_check_and_official_only(self):
        a, counts, changed = reconcile(copy.deepcopy(self.root),self.official)
        self.assertTrue(changed)
        self.assertEqual(counts,{'checked':1,'officialOnlyInserted':2,'conflicts':0})
        self.assertEqual(a['ssq'][0]['issue'],'2026129')
        self.assertEqual(a['ssq'][0]['verification'],'cross-checked')
        self.assertEqual(a['ssq'][1]['verification'],'official-only')
        self.assertIn(OFFICIAL_SOURCE,a['ssq'][0]['sources'])
        self.assertEqual(a['provenance']['ssq']['primaryOfficialError'],'HTTP 403')

    def test_conflict_never_overwrites_mirror(self):
        data=copy.deepcopy(self.root)
        data['ssq'][0]['main']=[1,2,3,4,5,6]
        out,st,_=reconcile(data,self.official)
        self.assertEqual(st['conflicts'],1)
        self.assertEqual(out['ssq'][0]['main'],[1,2,3,4,5,6])
        self.assertEqual(out['ssq'][0]['verification'],'single-source')
        self.assertTrue(out['quarantine'])

    def test_bad_html_raises(self):
        with self.assertRaises(ValueError):parse_official_html('<html><table></table></html>')

    def test_repeated_execution_no_duplicate(self):
        a,_,_=reconcile(copy.deepcopy(self.root),self.official)
        b,_,changed=reconcile(a,self.official)
        self.assertEqual(len(b['ssq']),3)
        self.assertEqual(len(b['ssq'][0]['sources']),2)
        self.assertFalse(changed)

    def test_not_crosschecked_without_independent_mirror(self):
        data=copy.deepcopy(self.root)
        data['ssq'][0]['sources']=['仓库既有快照']
        out,stats,_=reconcile(data,self.official)
        self.assertEqual(stats['checked'],0)
        self.assertEqual(out['ssq'][0]['verification'],'single-source')


if __name__ == '__main__':
    unittest.main()
