import tempfile
import unittest
from pathlib import Path
from apply_v183_integration import apply, ANCHOR, MARKER, STYLE_MARKER


class Integration(unittest.TestCase):
    def test_install_and_rerun_are_identical(self):
        with tempfile.TemporaryDirectory() as p:
            root = Path(p)
            (root / 'index.html').write_text('<nav>'+ANCHOR+'</nav>')
            (root / 'styles.css').write_text('.nav button{color:white}')
            apply(root)
            original=(root/'index.html').read_text(),(root/'styles.css').read_text()
            apply(root)
            self.assertEqual(original, ((root/'index.html').read_text(),(root/'styles.css').read_text()))
            self.assertIn('audit-v183.html?v=18.3',original[0]);self.assertIn(MARKER,original[0]);self.assertIn(STYLE_MARKER,original[1])

    def test_unknown_index_not_mutilated(self):
        with tempfile.TemporaryDirectory() as p:
            root=Path(p)
            (root/'index.html').write_text('<nav>unknown</nav>')
            (root/'styles.css').write_text('hello')
            with self.assertRaises(ValueError):apply(root)
            self.assertEqual((root/'index.html').read_text(),'<nav>unknown</nav>')
            self.assertEqual((root/'styles.css').read_text(),'hello')


if __name__=='__main__':unittest.main()
