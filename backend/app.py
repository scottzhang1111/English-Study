import importlib.util
import sys
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parent.parent
ROOT_APP_PATH = ROOT_DIR / "app.py"

if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

spec = importlib.util.spec_from_file_location("english_study_root_app", ROOT_APP_PATH)
root_app = importlib.util.module_from_spec(spec)
spec.loader.exec_module(root_app)

app = root_app.app
